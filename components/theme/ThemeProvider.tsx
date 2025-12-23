"use client"

import { createContext, useContext, useEffect, useState } from "react"

type Theme = "light" | "dark" | "system"

interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
  resolvedTheme: "light" | "dark"
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system")
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light")
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    // Load theme from localStorage
    const savedTheme = localStorage.getItem("theme") as Theme | null
    if (savedTheme && ["light", "dark", "system"].includes(savedTheme)) {
      setThemeState(savedTheme)
    }
  }, [])

  useEffect(() => {
    if (!mounted) return

    const root = document.documentElement
    let effectiveTheme: "light" | "dark"

    if (theme === "system") {
      effectiveTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
    } else {
      effectiveTheme = theme
    }

    setResolvedTheme(effectiveTheme)

    if (effectiveTheme === "dark") {
      root.classList.add("dark")
    } else {
      root.classList.remove("dark")
    }

    // Listen for system theme changes
    if (theme === "system") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
      const handleChange = (e: MediaQueryListEvent) => {
        if (e.matches) {
          root.classList.add("dark")
          setResolvedTheme("dark")
        } else {
          root.classList.remove("dark")
          setResolvedTheme("light")
        }
      }
      mediaQuery.addEventListener("change", handleChange)
      return () => mediaQuery.removeEventListener("change", handleChange)
    }
  }, [theme, mounted])

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme)
    localStorage.setItem("theme", newTheme)
  }

  // Prevent flash of wrong theme
  if (!mounted) {
    return <>{children}</>
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider")
  }
  return context
}
