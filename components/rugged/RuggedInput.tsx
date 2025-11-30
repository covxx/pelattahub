"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

export interface RuggedInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const RuggedInput = React.forwardRef<HTMLInputElement, RuggedInputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex w-full rounded-lg border-2 border-gray-300 bg-white px-6 py-6 text-2xl transition-colors",
          "placeholder:text-gray-400",
          "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-500 focus-visible:border-blue-500",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "dark:border-gray-700 dark:bg-gray-800 dark:text-white",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
RuggedInput.displayName = "RuggedInput"

export { RuggedInput }

