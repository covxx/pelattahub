"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface UnitToggleProps {
  value: "CASE" | "LBS"
  onChange: (value: "CASE" | "LBS") => void
  disabled?: boolean
}

export function UnitToggle({ value, onChange, disabled }: UnitToggleProps) {
  return (
    <div className="inline-flex rounded-lg border-2 border-gray-300 bg-gray-100 p-1 dark:border-gray-700 dark:bg-gray-800">
      <button
        type="button"
        onClick={() => onChange("CASE")}
        disabled={disabled}
        className={cn(
          "px-3 py-2 md:px-8 md:py-4 rounded-md text-sm md:text-lg font-semibold transition-all min-h-[44px] md:min-h-[60px]",
          value === "CASE"
            ? "bg-blue-600 text-white shadow-md"
            : "bg-transparent text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        CASES
      </button>
      <button
        type="button"
        onClick={() => onChange("LBS")}
        disabled={disabled}
        className={cn(
          "px-3 py-2 md:px-8 md:py-4 rounded-md text-sm md:text-lg font-semibold transition-all min-h-[44px] md:min-h-[60px]",
          value === "LBS"
            ? "bg-blue-600 text-white shadow-md"
            : "bg-transparent text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        LBS
      </button>
    </div>
  )
}

