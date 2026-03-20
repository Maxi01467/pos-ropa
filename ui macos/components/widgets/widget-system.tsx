"use client"

import { useState, useEffect } from "react"
import { X, Plus, Calendar, Clock, Thermometer, Activity, Music, Mail, Calculator } from "lucide-react"

interface Widget {
  id: string
  type: string
  title: string
  size: "small" | "medium" | "large"
  position: { x: number; y: number }
  data?: any
}

interface WidgetSystemProps {
  onClose: () => void
}

export function WidgetSystem({ onClose }: WidgetSystemProps) {
  const [widgets, setWidgets] = useState<Widget[]>([
    {
      id: "clock-1",
      type: "clock",
      title: "World Clock",
      size: "medium",
      position: { x: 50, y: 50 },
    },
    {
      id: "weather-1",
      type: "weather",
      title: "Weather",
      size: "large",
      position: { x: 300, y: 50 },
    },
    {
      id: "calendar-1",
      type: "calendar",
      title: "Calendar",
      size: "medium",
      position: { x: 50, y: 200 },
    },
  ])
  const [showWidgetGallery, setShowWidgetGallery] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const availableWidgets = [
    { type: "clock", title: "Clock", icon: Clock, description: "Display current time and world clocks" },
    { type: "weather", title: "Weather", icon: Thermometer, description: "Current weather and forecast" },
    { type: "calendar", title: "Calendar", icon: Calendar, description: "Upcoming events and schedule" },
    { type: "activity", title: "Activity", icon: Activity, description: "System performance monitor" },
    { type: "music", title: "Music", icon: Music, description: "Now playing and music controls" },
    { type: "mail", title: "Mail", icon: Mail, description: "Recent emails and notifications" },
    { type: "calculator", title: "Calculator", icon: Calculator, description: "Quick calculations" },
  ]

  const addWidget = (type: string) => {
    const newWidget: Widget = {
      id: `${type}-${Date.now()}`,
      type,
      title: availableWidgets.find((w) => w.type === type)?.title || type,
      size: "medium",
      position: { x: Math.random() * 200 + 100, y: Math.random() * 200 + 100 },
    }
    setWidgets((prev) => [...prev, newWidget])
    setShowWidgetGallery(false)
  }

  const removeWidget = (id: string) => {
    setWidgets((prev) => prev.filter((w) => w.id !== id))
  }

  const renderWidget = (widget: Widget) => {
    const sizeClasses = {
      small: "w-32 h-32",
      medium: "w-48 h-48",
      large: "w-64 h-64",
    }

    switch (widget.type) {
      case "clock":
        return (
          <div className={`${sizeClasses[widget.size]} glass-morphism rounded-2xl p-4 relative group`}>
            <button
              onClick={() => removeWidget(widget.id)}
              className="absolute top-2 right-2 w-6 h-6 bg-red-500/80 hover:bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="w-3 h-3 text-white" />
            </button>
            <div className="text-center h-full flex flex-col justify-center">
              <div className="text-2xl font-bold text-high-contrast mb-2">
                {currentTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </div>
              <div className="text-sm text-medium-contrast">
                {currentTime.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" })}
              </div>
              <div className="mt-4 space-y-1">
                <div className="text-xs text-low-contrast">
                  New York:{" "}
                  {new Date().toLocaleTimeString("en-US", {
                    timeZone: "America/New_York",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
                <div className="text-xs text-low-contrast">
                  London:{" "}
                  {new Date().toLocaleTimeString("en-US", {
                    timeZone: "Europe/London",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
                <div className="text-xs text-low-contrast">
                  Tokyo:{" "}
                  {new Date().toLocaleTimeString("en-US", {
                    timeZone: "Asia/Tokyo",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>
            </div>
          </div>
        )

      case "weather":
        return (
          <div className={`${sizeClasses[widget.size]} glass-morphism rounded-2xl p-4 relative group`}>
            <button
              onClick={() => removeWidget(widget.id)}
              className="absolute top-2 right-2 w-6 h-6 bg-red-500/80 hover:bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="w-3 h-3 text-white" />
            </button>
            <div className="h-full flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-high-contrast">San Francisco</h3>
                <div className="text-2xl">☀️</div>
              </div>
              <div className="text-3xl font-bold text-high-contrast mb-2">72°F</div>
              <div className="text-sm text-medium-contrast mb-4">Sunny</div>
              <div className="flex-1 space-y-2">
                <div className="flex justify-between text-xs text-low-contrast">
                  <span>Today</span>
                  <span>72° / 58°</span>
                </div>
                <div className="flex justify-between text-xs text-low-contrast">
                  <span>Tomorrow</span>
                  <span>75° / 61°</span>
                </div>
                <div className="flex justify-between text-xs text-low-contrast">
                  <span>Wednesday</span>
                  <span>68° / 55°</span>
                </div>
              </div>
            </div>
          </div>
        )

      case "calendar":
        return (
          <div className={`${sizeClasses[widget.size]} glass-morphism rounded-2xl p-4 relative group`}>
            <button
              onClick={() => removeWidget(widget.id)}
              className="absolute top-2 right-2 w-6 h-6 bg-red-500/80 hover:bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="w-3 h-3 text-white" />
            </button>
            <div className="h-full flex flex-col">
              <h3 className="font-semibold text-high-contrast mb-4">Today</h3>
              <div className="space-y-3 flex-1">
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                  <div>
                    <div className="text-sm font-medium text-high-contrast">Team Meeting</div>
                    <div className="text-xs text-medium-contrast">10:00 AM - 11:00 AM</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                  <div>
                    <div className="text-sm font-medium text-high-contrast">Lunch with Sarah</div>
                    <div className="text-xs text-medium-contrast">12:30 PM - 1:30 PM</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-orange-500 rounded-full mt-2"></div>
                  <div>
                    <div className="text-sm font-medium text-high-contrast">Project Review</div>
                    <div className="text-xs text-medium-contrast">3:00 PM - 4:00 PM</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )

      case "activity":
        return (
          <div className={`${sizeClasses[widget.size]} glass-morphism rounded-2xl p-4 relative group`}>
            <button
              onClick={() => removeWidget(widget.id)}
              className="absolute top-2 right-2 w-6 h-6 bg-red-500/80 hover:bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="w-3 h-3 text-white" />
            </button>
            <div className="h-full flex flex-col">
              <h3 className="font-semibold text-high-contrast mb-4">System Activity</h3>
              <div className="space-y-4 flex-1">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-medium-contrast">CPU</span>
                    <span className="text-high-contrast">23%</span>
                  </div>
                  <div className="w-full bg-white/20 rounded-full h-2">
                    <div className="bg-blue-500 h-2 rounded-full" style={{ width: "23%" }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-medium-contrast">Memory</span>
                    <span className="text-high-contrast">67%</span>
                  </div>
                  <div className="w-full bg-white/20 rounded-full h-2">
                    <div className="bg-green-500 h-2 rounded-full" style={{ width: "67%" }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-medium-contrast">Disk</span>
                    <span className="text-high-contrast">45%</span>
                  </div>
                  <div className="w-full bg-white/20 rounded-full h-2">
                    <div className="bg-orange-500 h-2 rounded-full" style={{ width: "45%" }}></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )

      case "music":
        return (
          <div className={`${sizeClasses[widget.size]} glass-morphism rounded-2xl p-4 relative group`}>
            <button
              onClick={() => removeWidget(widget.id)}
              className="absolute top-2 right-2 w-6 h-6 bg-red-500/80 hover:bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="w-3 h-3 text-white" />
            </button>
            <div className="h-full flex flex-col">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                  <Music className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-high-contrast truncate">Bohemian Rhapsody</div>
                  <div className="text-xs text-medium-contrast truncate">Queen</div>
                </div>
              </div>
              <div className="flex items-center justify-center gap-4">
                <button className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-colors">
                  <span className="text-white text-sm">⏮</span>
                </button>
                <button className="w-10 h-10 bg-white/30 hover:bg-white/40 rounded-full flex items-center justify-center transition-colors">
                  <span className="text-white text-lg">⏸</span>
                </button>
                <button className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-colors">
                  <span className="text-white text-sm">⏭</span>
                </button>
              </div>
            </div>
          </div>
        )

      case "mail":
        return (
          <div className={`${sizeClasses[widget.size]} glass-morphism rounded-2xl p-4 relative group`}>
            <button
              onClick={() => removeWidget(widget.id)}
              className="absolute top-2 right-2 w-6 h-6 bg-red-500/80 hover:bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="w-3 h-3 text-white" />
            </button>
            <div className="h-full flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-high-contrast">Mail</h3>
                <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                  <span className="text-xs text-white font-bold">3</span>
                </div>
              </div>
              <div className="space-y-3 flex-1">
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-high-contrast truncate">Project Update</div>
                    <div className="text-xs text-medium-contrast truncate">john@company.com</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-high-contrast truncate">Meeting Notes</div>
                    <div className="text-xs text-medium-contrast truncate">sarah@team.com</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-orange-500 rounded-full mt-2"></div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-high-contrast truncate">Weekly Report</div>
                    <div className="text-xs text-medium-contrast truncate">manager@company.com</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )

      case "calculator":
        return (
          <div className={`${sizeClasses[widget.size]} glass-morphism rounded-2xl p-4 relative group`}>
            <button
              onClick={() => removeWidget(widget.id)}
              className="absolute top-2 right-2 w-6 h-6 bg-red-500/80 hover:bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="w-3 h-3 text-white" />
            </button>
            <div className="h-full flex flex-col">
              <div className="bg-black/20 rounded-lg p-3 mb-3">
                <div className="text-right text-lg font-mono text-high-contrast">1,234.56</div>
              </div>
              <div className="grid grid-cols-3 gap-2 flex-1">
                {["C", "±", "%", "7", "8", "9", "4", "5", "6", "1", "2", "3", "0"].map((btn, i) => (
                  <button
                    key={i}
                    className="bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium text-high-contrast transition-colors"
                  >
                    {btn}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )

      default:
        return (
          <div className={`${sizeClasses[widget.size]} glass-morphism rounded-2xl p-4 relative group`}>
            <button
              onClick={() => removeWidget(widget.id)}
              className="absolute top-2 right-2 w-6 h-6 bg-red-500/80 hover:bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="w-3 h-3 text-white" />
            </button>
            <div className="text-center text-high-contrast">
              <div className="text-lg font-semibold">{widget.title}</div>
              <div className="text-sm text-medium-contrast">Widget content</div>
            </div>
          </div>
        )
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="w-full h-full relative overflow-hidden">
        {/* Widget Gallery Button */}
        <button
          onClick={() => setShowWidgetGallery(true)}
          className="fixed top-20 right-6 w-12 h-12 bg-blue-500/80 hover:bg-blue-500 rounded-full flex items-center justify-center transition-colors shadow-lg"
        >
          <Plus className="w-6 h-6 text-white" />
        </button>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="fixed top-20 left-6 w-12 h-12 bg-red-500/80 hover:bg-red-500 rounded-full flex items-center justify-center transition-colors shadow-lg"
        >
          <X className="w-6 h-6 text-white" />
        </button>

        {/* Widgets */}
        {widgets.map((widget) => (
          <div
            key={widget.id}
            className="absolute"
            style={{
              left: `${widget.position.x}px`,
              top: `${widget.position.y}px`,
            }}
          >
            {renderWidget(widget)}
          </div>
        ))}

        {/* Widget Gallery */}
        {showWidgetGallery && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-60">
            <div className="w-full max-w-2xl mx-4 bg-white/90 backdrop-blur-xl border border-white/30 rounded-2xl shadow-2xl">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-gray-800">Widget Gallery</h2>
                  <button
                    onClick={() => setShowWidgetGallery(false)}
                    className="w-8 h-8 bg-gray-200 hover:bg-gray-300 rounded-full flex items-center justify-center transition-colors"
                  >
                    <X className="w-4 h-4 text-gray-600" />
                  </button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {availableWidgets.map((widget) => (
                    <button
                      key={widget.type}
                      onClick={() => addWidget(widget.type)}
                      className="p-4 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors text-left"
                    >
                      <widget.icon className="w-8 h-8 text-blue-500 mb-2" />
                      <div className="font-medium text-gray-800">{widget.title}</div>
                      <div className="text-sm text-gray-600">{widget.description}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
