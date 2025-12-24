"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { signIn } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getVersionInfo } from "@/lib/version"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const versionInfo = getVersionInfo()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    startTransition(async () => {
      try {
        const result = await signIn("credentials", {
          email,
          password,
          redirect: false,
        })

        if (result?.error) {
          setError("Invalid email or password")
        } else {
          router.push("/dashboard/inventory")
          router.refresh()
        }
      } catch (err) {
        setError("An error occurred during login")
      }
    })
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">
            PalettaHub
          </CardTitle>
          <CardDescription className="text-center">
            Enter your credentials to access PalettaHub
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="user@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isPending}
              />
            </div>

            {error && (
              <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded dark:bg-red-950 dark:border-red-800 dark:text-red-200">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? "Signing in..." : "Sign In"}
            </Button>

            <div className="text-center">
              <Link
                href="/login/forgot-password"
                className="text-sm text-blue-600 hover:underline dark:text-blue-300"
              >
                Forgot password?
              </Link>
            </div>
          </form>

          {process.env.NODE_ENV === "development" && (
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded text-sm dark:bg-blue-950 dark:border-blue-800">
              <p className="font-semibold text-blue-900 dark:text-blue-200 mb-1">
                Default Credentials:
              </p>
              <p className="text-blue-800 dark:text-blue-300">
                Email: user@example.com
                <br />
                Password: admin123
              </p>
            </div>
          )}

          {/* Version Info */}
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <p className="text-base font-medium text-center text-muted-foreground">
              PalettaHub v{versionInfo.version} "{versionInfo.name}"
              {versionInfo.commitId !== 'dev' && (
                <span className="ml-2 font-mono">({versionInfo.commitId})</span>
              )}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

