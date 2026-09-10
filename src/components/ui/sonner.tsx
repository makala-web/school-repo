"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, ToasterProps } from "sonner"
import { useState, useEffect } from "react"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Prevent hydration mismatch on mobile
  if (!mounted) {
    return null
  }

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

// Safe toast wrapper that works even without Toaster mounted
export const toast = {
  success: (message: string) => {
    try {
      const { toast } = require("sonner")
      toast.success(message)
    } catch {
      console.log("✅", message)
    }
  },
  error: (message: string) => {
    try {
      const { toast } = require("sonner")
      toast.error(message)
    } catch {
      console.error("❌", message)
      alert(message)
    }
  },
  info: (message: string) => {
    try {
      const { toast } = require("sonner")
      toast.info(message)
    } catch {
      console.log("ℹ️", message)
    }
  },
}

export { Toaster }
