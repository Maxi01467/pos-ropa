"use client"

import { useState, useEffect } from "react"
import { Globe } from "lucide-react"

interface TimeWidgetProps {
  size?: "small" | "medium" | "large"
  showDate?: boolean
  showWorldClock?: boolean
  className?: string
}

export function TimeWidget({
  size = "medium",
  showDate = true,
  showWorldClock = false,
  className = "",
}: TimeWidgetProps) {
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const timeZones = [
    { name: "New York", timezone: "America/New_York" },
    { name: "London", timezone: "Europe/London" },
    { name: "Tokyo", timezone: "Asia/Tokyo" },
    { name: "Sydney", timezone: "Australia/Sydney" },
  ]

  const sizeClasses = {
    small: "text-sm",
    medium: "text-base",
    large: "text-lg",
  }

  return (
    <div className={`glass-morphism rounded-xl p-4 ${className}`}>
      {/* Main Time Display */}
      <div className="text-center mb-4">
        <div
          className={`font-bold text-high-contrast ${size === "large" ? "text-4xl" : size === "medium" ? "text-2xl" : "text-xl"} mb-2`}
        >
          {currentTime.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: size === "large" ? "2-digit" : undefined,
          })}
        </div>

        {showDate && (
          <div className={`text-medium-contrast ${sizeClasses[size]}`}>
            {currentTime.toLocaleDateString([], {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </div>
        )}
      </div>

      {/* World Clock */}
      {showWorldClock && (
        <div className="space-y-2 border-t border-white/20 pt-4">
          <div className="flex items-center gap-2 mb-3">
            <Globe className="w-4 h-4 text-medium-contrast" />
            <span className="text-sm font-medium text-medium-contrast">World Clock</span>
          </div>
          {timeZones.map((tz) => (
            <div key={tz.timezone} className="flex justify-between items-center">
              <span className="text-sm text-medium-contrast">{tz.name}</span>
              <span className="text-sm font-mono text-high-contrast">
                {new Date().toLocaleTimeString("en-US", {
                  timeZone: tz.timezone,
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
