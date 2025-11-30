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
            console.log("[Auth] Missing email or password")
            return null
          }

          console.log("[Auth] Looking up user:", credentials.email)
          
          const user = await prisma.user.findUnique({
            where: { email: credentials.email as string },
          })

          if (!user) {
            console.log("[Auth] User not found")
            return null
          }

          if (!user.password) {
            console.log("[Auth] User has no password")
            return null
          }

          console.log("[Auth] Comparing passwords")
          console.log("[Auth] Input password length:", (credentials.password as string).length)
          console.log("[Auth] Stored hash:", user.password.substring(0, 30) + "...")
          
          const isPasswordValid = await bcrypt.compare(
            credentials.password as string,
            user.password
          )

          console.log("[Auth] Comparison result:", isPasswordValid)
          
          if (!isPasswordValid) {
            console.log("[Auth] Password invalid")
            return null
          }

          console.log("[Auth] Login successful for:", user.email)
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
          }
        } catch (error) {
          console.error("[Auth] Error during authorization:", error)
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
  debug: true,
})
