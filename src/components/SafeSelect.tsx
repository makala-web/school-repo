// SafeSelect - A wrapper around Select that prevents "undefined open" errors
// This component ensures Radix UI Select doesn't crash on mobile

"use client"

import * as React from "react"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface SafeSelectProps {
  value?: string
  onValueChange?: (value: string) => void
  placeholder?: string
  children?: React.ReactNode
  disabled?: boolean
}

export function SafeSelect({ value, onValueChange, placeholder, children, disabled }: SafeSelectProps) {
  const [mounted, setMounted] = React.useState(false)
  const [safeValue, setSafeValue] = React.useState<string>(value || "")

  React.useEffect(() => {
    setMounted(true)
  }, [])

  // Sync with external value
  React.useEffect(() => {
    if (value !== undefined) {
      setSafeValue(value)
    }
  }, [value])

  const handleChange = (newValue: string) => {
    setSafeValue(newValue)
    if (onValueChange) {
      onValueChange(newValue)
    }
  }

  // Don't render until mounted (prevents hydration issues)
  if (!mounted) {
    return (
      <div className="h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm">
        {placeholder || "Loading..."}
      </div>
    )
  }

  return (
    <Select value={safeValue} onValueChange={handleChange} disabled={disabled}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {children}
      </SelectContent>
    </Select>
  )
}

export { SelectItem, SelectGroup, SelectLabel }
