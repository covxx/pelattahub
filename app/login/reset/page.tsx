"use client"

import { Suspense, useEffect, useState, useTransition } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { resetPassword } from "@/app/actions/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

function ResetPasswordInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get("token") || ""

  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (!token) {
      setError("Reset link is missing. Request a new one.")
    }
  }, [token])

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!token) return
    setMessage(null)
    setError(null)

    if (password !== confirmPassword) {
      setError("Passwords do not match")
      return
    }

    startTransition(async () => {
      const result = await resetPassword({ token, newPassword: password })
      if (result.success) {
        setMessage("Password updated. Redirecting to login...")
        setTimeout(() => router.push("/login"), 1200)
      } else {
        setError(result.error || "Unable to reset password. Request a new link.")
      }
    })
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">Set a new password</CardTitle>
          <CardDescription className="text-center">
            Choose a strong password for your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!token ? (
            <div className="space-y-4">
              <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded dark:bg-red-950 dark:border-red-800 dark:text-red-200">
                {error}
              </div>
              <Link
                href="/login/forgot-password"
                className="text-sm text-blue-600 hover:underline dark:text-blue-300"
              >
                Request a new reset link
              </Link>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="password">New password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                  required
                  disabled={isPending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  minLength={8}
                  required
                  disabled={isPending}
                />
              </div>

              {message && (
                <div className="p-3 text-sm text-green-700 bg-green-50 border border-green-200 rounded dark:bg-green-950 dark:border-green-800 dark:text-green-200">
                  {message}
                </div>
              )}
              {error && (
                <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded dark:bg-red-950 dark:border-red-800 dark:text-red-200">
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full" disabled={isPending}>
                {isPending ? "Updating..." : "Update password"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Loading...</div>}>
      <ResetPasswordInner />
    </Suspense>
  )
}



