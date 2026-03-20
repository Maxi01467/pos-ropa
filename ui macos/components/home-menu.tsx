"use client"

import { useState, useEffect } from "react"
import { Apple, Wifi, Battery, Settings, Search, Grid3X3, Calendar, Power, RotateCcw, Moon } from "lucide-react"

interface HomeMenuProps {
  onAppLaunch: (app: string) => void
  installedApps?: string[]
  onShowWidgets?: () => void
  onRestart?: () => void
  onShutdown?: () => void
}

export function HomeMenu({ onAppLaunch, installedApps = [], onShowWidgets, onRestart, onShutdown }: HomeMenuProps) {
  const [showAppleMenu, setShowAppleMenu] = useState(false)
  const [showControlCenter, setShowControlCenter] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [showSpotlight, setShowSpotlight] = useState(false)
  const [spotlightQuery, setSpotlightQuery] = useState("")
  const [currentTime, setCurrentTime] = useState(new Date())
  // Added time display dropdown state
  const [showTimeDropdown, setShowTimeDropdown] = useState(false)

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === " ") {
        e.preventDefault()
        setShowSpotlight(true)
      }
      if (e.key === "Escape") {
        setShowSpotlight(false)
        setSpotlightQuery("")
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  const apps = [
    { name: "Finder", icon: "📁", color: "bg-blue-500" }, // Added Finder app
    { name: "Mail", icon: "📧", color: "bg-blue-600" }, // Added Mail app
    { name: "Calculator", icon: "🧮", color: "bg-gray-800" },
    { name: "Notes", icon: "📝", color: "bg-yellow-400" },
    { name: "Music", icon: "🎵", color: "bg-red-500" },
    { name: "Photos", icon: "🖼️", color: "bg-blue-500" },
    { name: "Browser", icon: "🌐", color: "bg-blue-600" },
    { name: "Settings", icon: "⚙️", color: "bg-gray-600" },
    { name: "App Store", icon: "🛍️", color: "bg-blue-600" },
    ...installedApps.slice(0, 3).map((app) => ({
      name: app,
      icon: "📱",
      color: "bg-purple-500",
    })),
  ]

  const allApps = [
    "Finder", // Added Finder to searchable apps
    "Mail", // Added Mail to searchable apps
    "Calculator",
    "Notes",
    "Music",
    "Photos",
    "Browser",
    "Settings",
    "App Store",
    "Excel",
    "PowerPoint",
    "Word",
    "Photoshop",
    "Illustrator",
    "Premiere",
    "VS Code",
    "Terminal",
    "GitHub",
    "Netflix",
    "Spotify",
    "Chess",
    ...installedApps,
  ]

  const filteredApps = allApps.filter((app) => app.toLowerCase().includes(spotlightQuery.toLowerCase())).slice(0, 8)

  const handleSpotlightLaunch = (appName: string) => {
    onAppLaunch(appName.toLowerCase().replace(/\s+/g, ""))
    setShowSpotlight(false)
    setSpotlightQuery("")
  }

  // Added system control functions
  const handleRestart = () => {
    setShowAppleMenu(false)
    if (onRestart) {
      onRestart()
    }
  }

  const handleShutdown = () => {
    setShowAppleMenu(false)
    if (onShutdown) {
      onShutdown()
    }
  }

  const handleSleep = () => {
    setShowAppleMenu(false)
    // Simulate sleep mode by dimming the screen
    document.body.style.filter = "brightness(0.1)"
    setTimeout(() => {
      document.body.style.filter = "brightness(1)"
    }, 2000)
  }

  // Added world clock data for time dropdown
  const worldClocks = [
    { city: "Cupertino", timezone: "America/Los_Angeles", flag: "🇺🇸" },
    { city: "New York", timezone: "America/New_York", flag: "🇺🇸" },
    { city: "London", timezone: "Europe/London", flag: "🇬🇧" },
    { city: "Paris", timezone: "Europe/Paris", flag: "🇫🇷" },
    { city: "Tokyo", timezone: "Asia/Tokyo", flag: "🇯🇵" },
    { city: "Sydney", timezone: "Australia/Sydney", flag: "🇦🇺" },
  ]

  return (
    <>
      {/* Menu Bar */}
      <div className="fixed top-0 left-0 right-0 h-8 bg-black/20 backdrop-blur-xl border-b border-white/10 flex items-center justify-between px-4 z-50">
        {/* Left side - Apple menu */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowAppleMenu(!showAppleMenu)}
            className="p-1 hover:bg-white/10 rounded transition-colors transform hover:scale-105"
          >
            <Apple className="w-4 h-4 text-white" />
          </button>
          <span className="text-sm font-medium text-white">macOS Tahoe</span>
        </div>

        {/* Center - Enhanced time display and spotlight */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowSpotlight(true)}
            className="p-1 hover:bg-white/10 rounded transition-colors transform hover:scale-105"
            title="Spotlight Search (⌘+Space)"
          >
            <Search className="w-4 h-4 text-white" />
          </button>
          {/* Enhanced time display with dropdown */}
          <button
            onClick={() => setShowTimeDropdown(!showTimeDropdown)}
            className="flex items-center gap-2 px-2 py-1 hover:bg-white/10 rounded transition-colors transform hover:scale-105"
            title="Click for world clock"
          >
            <Calendar className="w-3 h-3 text-white/80" />
            <div className="text-sm text-white font-medium">
              {currentTime.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}
            </div>
            <div className="text-sm text-white font-bold">
              {currentTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </div>
          </button>
        </div>

        {/* Right side - Control Center */}
        <div className="flex items-center gap-2">
          {onShowWidgets && (
            <button
              onClick={onShowWidgets}
              className="p-1 hover:bg-white/10 rounded transition-colors transform hover:scale-105"
              title="Show Widgets"
            >
              <Grid3X3 className="w-4 h-4 text-white" />
            </button>
          )}
          <button className="p-1 hover:bg-white/10 rounded transition-colors transform hover:scale-105">
            <Wifi className="w-4 h-4 text-white" />
          </button>
          <button className="p-1 hover:bg-white/10 rounded transition-colors transform hover:scale-105">
            <Battery className="w-4 h-4 text-white" />
          </button>
          <button
            onClick={() => setShowControlCenter(!showControlCenter)}
            className="p-1 hover:bg-white/10 rounded transition-colors transform hover:scale-105"
          >
            <Settings className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>

      {/* Enhanced Apple Menu with system controls */}
      {showAppleMenu && (
        <div className="fixed top-8 left-4 w-64 bg-white/20 backdrop-blur-xl border border-white/30 rounded-xl shadow-2xl z-50 animate-in slide-in-from-top-2 duration-200">
          <div className="p-2">
            <div className="space-y-1">
              <button
                onClick={() => {
                  onAppLaunch("Settings")
                  setShowAppleMenu(false)
                }}
                className="w-full flex items-center gap-3 p-3 hover:bg-white/10 rounded-lg transition-colors text-left text-white/90"
              >
                <Settings className="w-4 h-4" />
                <span className="text-sm">System Preferences...</span>
              </button>

              <div className="border-t border-white/20 my-2"></div>

              <button
                onClick={handleSleep}
                className="w-full flex items-center gap-3 p-3 hover:bg-white/10 rounded-lg transition-colors text-left text-white/90"
              >
                <Moon className="w-4 h-4" />
                <span className="text-sm">Sleep</span>
              </button>

              <button
                onClick={handleRestart}
                className="w-full flex items-center gap-3 p-3 hover:bg-white/10 rounded-lg transition-colors text-left text-white/90"
              >
                <RotateCcw className="w-4 h-4" />
                <span className="text-sm">Restart...</span>
              </button>

              <button
                onClick={handleShutdown}
                className="w-full flex items-center gap-3 p-3 hover:bg-white/10 rounded-lg transition-colors text-left text-white/90"
              >
                <Power className="w-4 h-4" />
                <span className="text-sm">Shut Down...</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Spotlight Search Modal */}
      {showSpotlight && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center pt-32 z-50">
          <div className="w-full max-w-2xl bg-white/20 backdrop-blur-xl border border-white/30 rounded-xl shadow-2xl animate-in slide-in-from-top-4 duration-300">
            <div className="p-4">
              <div className="relative mb-4">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-white/60" />
                <input
                  type="text"
                  placeholder="Spotlight Search"
                  value={spotlightQuery}
                  onChange={(e) => setSpotlightQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-transparent text-white placeholder-white/60 text-lg focus:outline-none"
                  autoFocus
                />
              </div>

              {spotlightQuery && (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {filteredApps.map((app, index) => (
                    <button
                      key={app}
                      onClick={() => handleSpotlightLaunch(app)}
                      className="w-full flex items-center gap-4 p-3 hover:bg-white/10 rounded-lg transition-colors text-left"
                    >
                      <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center text-white font-bold">
                        {app[0]}
                      </div>
                      <div>
                        <div className="text-white font-medium">{app}</div>
                        <div className="text-white/60 text-sm">Application</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Added enhanced time dropdown with world clock */}
      {showTimeDropdown && (
        <div className="fixed top-8 left-1/2 transform -translate-x-1/2 w-80 bg-white/20 backdrop-blur-xl border border-white/30 rounded-xl shadow-2xl z-50 animate-in slide-in-from-top-2 duration-200">
          <div className="p-4">
            {/* Current Date and Time */}
            <div className="text-center mb-6 pb-4 border-b border-white/20">
              <div className="text-2xl font-bold text-white mb-1">
                {currentTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </div>
              <div className="text-sm text-white/80">
                {currentTime.toLocaleDateString([], {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </div>
            </div>

            {/* World Clock */}
            <div>
              <h3 className="text-white font-medium mb-3 flex items-center gap-2">
                <span>🌍</span>
                World Clock
              </h3>
              <div className="space-y-2">
                {worldClocks.map((clock) => (
                  <div
                    key={clock.timezone}
                    className="flex items-center justify-between p-2 hover:bg-white/10 rounded-lg transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{clock.flag}</span>
                      <span className="text-sm text-white">{clock.city}</span>
                    </div>
                    <div className="text-sm font-mono text-white/90">
                      {new Date().toLocaleTimeString("en-US", {
                        timeZone: clock.timezone,
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="mt-4 pt-4 border-t border-white/20">
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    onAppLaunch("Calendar")
                    setShowTimeDropdown(false)
                  }}
                  className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-sm text-white flex items-center gap-2"
                >
                  <Calendar className="w-4 h-4" />
                  Calendar
                </button>
                <button className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-sm text-white flex items-center gap-2">
                  <span>⏰</span>
                  Alarms
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Dock with better animations */}
      <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-40">
        <div className="flex items-center gap-2 px-4 py-3 bg-white/20 backdrop-blur-xl border border-white/30 rounded-2xl shadow-2xl">
          {apps.map((app, index) => (
            <button
              key={index}
              onClick={() => onAppLaunch(app.name === "App Store" ? "App Store" : app.name)}
              className={`w-12 h-12 ${app.color} rounded-xl flex items-center justify-center text-xl hover:scale-125 hover:-translate-y-2 transition-all duration-300 shadow-lg hover:shadow-2xl transform-gpu`}
              title={app.name}
              style={{
                transitionDelay: `${index * 50}ms`,
              }}
            >
              {app.icon}
            </button>
          ))}
        </div>
      </div>

      {/* Click outside to close menus */}
      {(showAppleMenu || showControlCenter || showTimeDropdown || showSpotlight) && (
        <div
          className="fixed inset-0 z-30"
          onClick={() => {
            setShowAppleMenu(false)
            setShowControlCenter(false)
            setShowTimeDropdown(false)
            setShowSpotlight(false)
            setSpotlightQuery("")
          }}
        />
      )}
    </>
  )
}
