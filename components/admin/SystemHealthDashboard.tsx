"use client"

import { useState, useEffect, useTransition } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { RefreshCw, Trash2, Power } from "lucide-react"
import { getSystemHealth, purgeCache, disconnectPrisma } from "@/app/actions/health"
import { useToast } from "@/hooks/useToast"
import { ToastContainer } from "@/components/ui/toast"
import { format } from "date-fns"
import type { SystemHealth } from "@/app/actions/health"

interface SystemHealthDashboardProps {
  initialHealth: SystemHealth
}

export function SystemHealthDashboard({ initialHealth }: SystemHealthDashboardProps) {
  const [health, setHealth] = useState<SystemHealth>(initialHealth)
  const [isRefreshing, startRefresh] = useTransition()
  const [isPurging, startPurge] = useTransition()
  const [isDisconnecting, startDisconnect] = useTransition()
  const { toast, toasts, removeToast } = useToast()

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      startRefresh(async () => {
        try {
          const newHealth = await getSystemHealth()
          setHealth(newHealth)
        } catch (error) {
          console.error("Failed to refresh health:", error)
        }
      })
    }, 30000)

    return () => clearInterval(interval)
  }, [])

  const handleRefresh = () => {
    startRefresh(async () => {
      try {
        const newHealth = await getSystemHealth()
        setHealth(newHealth)
        toast("Health data refreshed", "success")
      } catch (error) {
        toast("Failed to refresh health data", "error")
      }
    })
  }

  const handlePurgeCache = () => {
    if (!confirm("Are you sure you want to purge the cache? This may impact performance temporarily.")) {
      return
    }

    startPurge(async () => {
      try {
        const result = await purgeCache()
        if (result.success) {
          toast(result.message || "Cache purged successfully", "success")
          // Refresh health after purge
          const newHealth = await getSystemHealth()
          setHealth(newHealth)
        } else {
          toast(result.error || "Failed to purge cache", "error")
        }
      } catch (error) {
        toast("Failed to purge cache", "error")
      }
    })
  }

  const handleDisconnectPrisma = () => {
    if (
      !confirm(
        "WARNING: This will force close all database connections. Use only if the connection pool is stuck. Continue?"
      )
    ) {
      return
    }

    startDisconnect(async () => {
      try {
        const result = await disconnectPrisma()
        if (result.success) {
          toast(result.message || "Prisma disconnected successfully", "success")
          // Refresh health after disconnect
          setTimeout(async () => {
            const newHealth = await getSystemHealth()
            setHealth(newHealth)
          }, 2000)
        } else {
          toast(result.error || "Failed to disconnect Prisma", "error")
        }
      } catch (error) {
        toast("Failed to disconnect Prisma", "error")
      }
    })
  }

  // Format memory in MB
  const formatMemory = (bytes: number) => {
    return `${(bytes / 1024 / 1024).toFixed(0)}MB`
  }

  // Format uptime
  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    if (days > 0) return `${days}d ${hours}h`
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
  }

  // Get latency color
  const getLatencyColor = (latency: number) => {
    if (latency < 50) return "text-green-400"
    if (latency < 200) return "text-yellow-400"
    return "text-red-400"
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">System Health Dashboard</h1>
          <p className="text-gray-400 mt-1">Real-time system metrics and diagnostics</p>
        </div>
        <Button
          onClick={handleRefresh}
          disabled={isRefreshing}
          variant="outline"
          className="bg-gray-800 border-gray-700 text-white hover:bg-gray-700"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Status Badge */}
      <Card className="bg-gray-800 border-gray-700">
        <CardContent className="pt-6">
          <div className="flex items-center justify-center">
            <Badge
              className={`text-2xl px-6 py-3 font-mono ${
                health.status === "OPERATIONAL"
                  ? "bg-green-600 text-white"
                  : "bg-red-600 text-white"
              }`}
            >
              {health.status}
            </Badge>
          </div>
          <p className="text-center text-gray-400 mt-2 text-sm">
            Database: {health.database.connected ? "Connected" : "Disconnected"} | Latency:{" "}
            <span className={getLatencyColor(health.database.latency)}>
              {health.database.latency}ms
            </span>
          </p>
        </CardContent>
      </Card>

      {/* Metrics Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* DB Latency */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-sm text-gray-400">DB Latency</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-mono font-bold ${getLatencyColor(health.database.latency)}`}>
              {health.database.latency}ms
            </div>
          </CardContent>
        </Card>

        {/* Memory */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-sm text-gray-400">Memory (RSS)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-mono font-bold text-blue-400">
              {formatMemory(health.memory.rss)}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Heap: {formatMemory(health.memory.heapUsed)} / {formatMemory(health.memory.heapTotal)}
            </div>
          </CardContent>
        </Card>

        {/* Active Lots */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-sm text-gray-400">Active Lots</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-mono font-bold text-green-400">
              {health.rowCounts.activeLots.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        {/* Pending Receives */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-sm text-gray-400">Pending Receives</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-mono font-bold text-yellow-400">
              {health.rowCounts.pendingReceives}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Additional Metrics */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Uptime */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-sm text-gray-400">Uptime</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-mono font-bold text-cyan-400">
              {formatUptime(health.uptime)}
            </div>
          </CardContent>
        </Card>

        {/* Error Rate */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-sm text-gray-400">Errors (24h)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-mono font-bold ${health.errorRate.count > 0 ? "text-red-400" : "text-green-400"}`}>
              {health.errorRate.count}
            </div>
          </CardContent>
        </Card>

        {/* Row Counts Summary */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-sm text-gray-400">Database Stats</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 text-sm font-mono">
              <div className="text-gray-300">
                Users: <span className="text-white">{health.rowCounts.users}</span>
              </div>
              <div className="text-gray-300">
                Products: <span className="text-white">{health.rowCounts.products}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent System Logs */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-sm text-gray-400">Recent System Logs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-black rounded-lg p-4 font-mono text-xs overflow-auto max-h-64">
            {health.recentLogs.length === 0 ? (
              <div className="text-gray-500">No logs available</div>
            ) : (
              <div className="space-y-1">
                {health.recentLogs.map((log) => (
                  <div key={log.id} className="text-gray-300">
                    <span className="text-gray-500">
                      [{format(new Date(log.createdAt), "HH:mm:ss")}]
                    </span>{" "}
                    <span className="text-yellow-400">{log.action}</span>{" "}
                    <span className="text-cyan-400">{log.entity_type}</span>{" "}
                    <span className="text-gray-500">
                      by {log.user.name || "Unknown"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Self-Repair Buttons */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-sm text-gray-400">Self-Repair Tools</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Button
              onClick={handlePurgeCache}
              disabled={isPurging}
              variant="outline"
              className="bg-gray-700 border-gray-600 text-white hover:bg-gray-600"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {isPurging ? "Purging..." : "Cache Purge"}
            </Button>
            <Button
              onClick={handleDisconnectPrisma}
              disabled={isDisconnecting}
              variant="outline"
              className="bg-red-900/30 border-red-700 text-red-400 hover:bg-red-900/50"
            >
              <Power className="h-4 w-4 mr-2" />
              {isDisconnecting ? "Disconnecting..." : "Prisma Disconnect"}
            </Button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Use these tools with caution. Cache purge may temporarily impact performance. Prisma
            disconnect will force close all database connections.
          </p>
        </CardContent>
      </Card>

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  )
}

