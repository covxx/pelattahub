"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Loader2, Check } from "lucide-react"

interface BigButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  state?: "normal" | "loading" | "success"
}

const BigButton = React.forwardRef<HTMLButtonElement, BigButtonProps>(
  ({ className, children, state = "normal", disabled, ...props }, ref) => {
    return (
      <button
        className={cn(
          "w-full h-20 text-2xl font-bold rounded-lg transition-all",
          "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-offset-2",
          state === "normal" && "bg-blue-600 text-white hover:bg-blue-700 focus-visible:ring-blue-500",
          state === "loading" && "bg-gray-400 text-white cursor-not-allowed",
          state === "success" && "bg-green-600 text-white",
          disabled && "opacity-50 cursor-not-allowed",
          className
        )}
        disabled={disabled || state === "loading" || state === "success"}
        ref={ref}
        {...props}
      >
        <div className="flex items-center justify-center gap-3">
          {state === "loading" && <Loader2 className="h-8 w-8 animate-spin" />}
          {state === "success" && <Check className="h-8 w-8" />}
          {children}
        </div>
      </button>
    )
  }
)
BigButton.displayName = "BigButton"

export { BigButton }

