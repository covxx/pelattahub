"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { RefreshCw, Trash2, Recycle } from "lucide-react"
import { getSystemHealth, purgeCache, runGarbageCollection } from "@/app/actions/health"
import { format } from "date-fns"
import { getVersionInfo } from "@/lib/version"
import type { SystemHealth } from "@/app/actions/health"

interface SystemHealthDashboardProps {
  initialHealth: SystemHealth
}

export function SystemHealthDashboard({ initialHealth }: SystemHealthDashboardProps) {
  const [health, setHealth] = useState<SystemHealth>(initialHealth)
  const [isRefreshing, startRefresh] = useTransition()
  const [isPurging, startPurge] = useTransition()
  const [isRunningGC, startGC] = useTransition()
  const router = useRouter()
  const versionInfo = getVersionInfo()

  const handleRefresh = () => {
    startRefresh(async () => {
      try {
        const newHealth = await getSystemHealth()
        setHealth(newHealth)
        // Also refresh the router to ensure fresh data on next render
        router.refresh()
      } catch (error) {
        console.error("Failed to refresh health:", error)
      }
    })
  }

  const handlePurgeCache = () => {
    startPurge(async () => {
      try {
        const result = await purgeCache()
        if (result.success) {
          // Refresh health after purge
          const newHealth = await getSystemHealth()
          setHealth(newHealth)
        }
      } catch (error) {
        console.error("Failed to purge cache:", error)
      }
    })
  }

  const handleRunGC = () => {
    startGC(async () => {
      try {
        const result = await runGarbageCollection()
        if (result.success) {
          // Refresh health after GC
            const newHealth = await getSystemHealth()
            setHealth(newHealth)
        }
      } catch (error) {
        console.error("Failed to run garbage collection:", error)
      }
    })
  }

  // Determine overall status: OPERATIONAL if latency < 100ms, DEGRADED otherwise
  const overallStatus = health.latency < 100 && health.status === "OK" ? "OPERATIONAL" : "DEGRADED"
  const isOperational = overallStatus === "OPERATIONAL"

  // Get latency color: Red if > 200ms
  const getLatencyColor = (latency: number) => {
    return latency > 200 ? "text-red-600" : "text-foreground"
  }

  // Get memory warning: Warn if > 3000MB (VPS limit ~4000MB)
  const isMemoryWarning = health.memoryMB > 3000

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">System Status</h2>
          <p className="text-muted-foreground">
            Real-time system health metrics and diagnostics
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            PalettaHub v{versionInfo.version} "{versionInfo.name}"
            {versionInfo.commitId !== 'dev' && (
              <span className="ml-2 font-mono">({versionInfo.commitId})</span>
            )}
          </p>
        </div>
        <Button
          onClick={handleRefresh}
          disabled={isRefreshing}
          variant="outline"
          size="sm"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Overall Status Badge */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center">
            <Badge
              className={`text-2xl px-8 py-4 font-semibold ${
                isOperational
                  ? "bg-green-500 text-white hover:bg-green-600"
                  : "bg-red-500 text-white hover:bg-red-600"
              }`}
            >
              {overallStatus}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Metrics Grid - 4 Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* DB Latency */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">DB Latency</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getLatencyColor(health.latency)}`}>
              {health.latency.toFixed(2)}ms
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Database response time
            </p>
          </CardContent>
        </Card>

        {/* Memory Usage */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${isMemoryWarning ? "text-orange-600" : "text-foreground"}`}>
              {health.memoryMB}MB
            </div>
            <p className={`text-xs mt-1 ${isMemoryWarning ? "text-orange-600 font-medium" : "text-muted-foreground"}`}>
              {isMemoryWarning ? "Warning: Near VPS limit (4000MB)" : "Resident Set Size"}
            </p>
          </CardContent>
        </Card>

        {/* Uptime */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Uptime</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{health.uptime}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Since last Docker restart
            </p>
          </CardContent>
        </Card>

        {/* Error Rate */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${health.errorCount > 0 ? "text-red-600" : "text-foreground"}`}>
              {health.errorCount}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Errors today
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <Button
              onClick={handlePurgeCache}
              disabled={isPurging}
              variant="outline"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {isPurging ? "Purging..." : "Purge Cache"}
            </Button>
            <Button
              onClick={handleRunGC}
              disabled={isRunningGC}
              variant="outline"
            >
              <Recycle className="h-4 w-4 mr-2" />
              {isRunningGC ? "Running..." : "Run Garbage Collection"}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Purge Cache: Clears Next.js cache if data looks stale. Garbage Collection: Runs maintenance and logs activity.
          </p>
        </CardContent>
      </Card>

      {/* Recent System Logs */}
      <Card>
        <CardHeader>
          <CardTitle>Recent System Logs</CardTitle>
        </CardHeader>
        <CardContent>
          {health.recentLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No logs available</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>User</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {health.recentLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-sm">
                      {format(new Date(log.createdAt), "MM/dd/yyyy HH:mm:ss")}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">
                        {log.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm font-mono">
                      {log.entity_type}
                    </TableCell>
                    <TableCell className="text-sm">
                      {log.user.name || log.user.email || "Unknown"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
