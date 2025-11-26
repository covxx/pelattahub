"use client"

import { useState, useCallback } from "react"

interface Toast {
  id: string
  message: string
  type?: "success" | "error" | "info"
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((message: string, type: "success" | "error" | "info" = "info") => {
    const id = Math.random().toString(36).substring(2, 9)
    setToasts((prev) => [...prev, { id, message, type }])
    return id
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [])

  const toast = useCallback(
    (message: string, type: "success" | "error" | "info" = "info") => {
      return addToast(message, type)
    },
    [addToast]
  )

  return {
    toasts,
    toast,
    addToast,
    removeToast,
  }
}

