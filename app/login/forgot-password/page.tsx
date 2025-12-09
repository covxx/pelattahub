"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { requestPasswordReset } from "@/app/actions/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function ForgotPasswordPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    setMessage(null)
    setError(null)

    startTransition(async () => {
      try {
        const result = await requestPasswordReset({ email })
        if (result?.success) {
          setMessage("If an account exists for this email, a reset link has been sent.")
          setEmail("")
          // small delay then return to login
          setTimeout(() => router.push("/login"), 1200)
        } else {
          setError("Unable to send reset link. Try again.")
        }
      } catch (err) {
        setError("Unable to send reset link. Try again.")
      }
    })
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">Reset your password</CardTitle>
          <CardDescription className="text-center">
            Enter the email associated with your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
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
              {isPending ? "Sending..." : "Send reset link"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
