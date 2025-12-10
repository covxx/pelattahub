import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { prisma } from "./prisma"
import bcrypt from "bcryptjs"
import { Role } from "@prisma/client"

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  trustHost: true,
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        try {
          if (!credentials?.email || !credentials?.password) {
            if (process.env.NODE_ENV === "development") {
              console.log("[Auth] Missing email or password")
            }
            return null
          }

          const email = (credentials.email as string).toLowerCase().trim()
          const password = credentials.password as string

          // Database connection check
          try {
            await prisma.$connect()
          } catch (dbError) {
            console.error("[Auth] Database connection failed:", dbError)
            throw new Error("Database connection failed. Please check your database configuration.")
          }

          if (process.env.NODE_ENV === "development") {
            console.log("[Auth] Looking up user:", email)
          }
          
          const user = await prisma.user.findUnique({
            where: { email },
          })

          if (!user) {
            if (process.env.NODE_ENV === "development") {
              console.log("[Auth] User not found:", email)
            }
            return null
          }

          if (!user.password) {
            console.error("[Auth] User has no password set:", email)
            return null
          }

          if (process.env.NODE_ENV === "development") {
            console.log("[Auth] Comparing passwords for:", email)
          }
          
          const isPasswordValid = await bcrypt.compare(password, user.password)

          if (!isPasswordValid) {
            if (process.env.NODE_ENV === "development") {
              console.log("[Auth] Password invalid for:", email)
            }
            return null
          }

          if (process.env.NODE_ENV === "development") {
            console.log("[Auth] Login successful for:", user.email)
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
          }
        } catch (error) {
          console.error("[Auth] Error during authorization:", error)
          // Don't expose internal errors to users
          return null
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role
        token.id = user.id
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as Role
      }
      return session
    },
  },
  debug: process.env.NODE_ENV === "development",
})
