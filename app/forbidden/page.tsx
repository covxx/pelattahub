import Link from "next/link"
import { ShieldAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

export default function ForbiddenPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center pb-2">
          <div className="flex justify-center mb-4">
            <div className="rounded-full bg-red-100 dark:bg-red-900/30 p-6">
              <ShieldAlert className="h-16 w-16 text-red-600 dark:text-red-400" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Access Denied
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-400">
              403 - Forbidden
            </p>
          </div>

          <div className="py-4">
            <p className="text-gray-700 dark:text-gray-300">
              You do not have permission to view this page.
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              This area is restricted to administrators only. Please contact
              your System Administrator if you believe you should have access.
            </p>
          </div>

          <div className="pt-4">
            <Link href="/dashboard">
              <Button size="lg" className="w-full">
                Return to Dashboard
              </Button>
            </Link>
          </div>

          <div className="text-xs text-gray-500 dark:text-gray-400 pt-2">
            If you need assistance, please contact your system administrator.
          </div>
        </CardContent>
      </Card>
    </div>
  )
}


