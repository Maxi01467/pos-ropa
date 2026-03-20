"use client"

import { useState } from "react"
import {
  X,
  Monitor,
  Wifi,
  Bluetooth,
  Volume2,
  Bell,
  Shield,
  Users,
  Palette,
  Globe,
  ChevronRight,
  Moon,
  Sun,
  Eye,
} from "lucide-react"

interface SettingsProps {
  onClose: () => void
}

interface SettingCategory {
  id: string
  title: string
  icon: any
  description: string
}

export function Settings({ onClose }: SettingsProps) {
  const [selectedCategory, setSelectedCategory] = useState("general")
  const [accentColor, setAccentColor] = useState("blue")
  const [settings, setSettings] = useState({
    // General
    darkMode: false,
    autoUpdate: true,
    startupSound: true,
    // Display
    brightness: 75,
    nightShift: false,
    trueTone: true,
    resolution: "default",
    // Sound
    volume: 80,
    alertVolume: 60,
    soundEffects: true,
    // Network
    wifi: true,
    bluetooth: true,
    airdrop: "contacts",
    // Privacy
    locationServices: true,
    analytics: false,
    crashReports: true,
    // Notifications
    doNotDisturb: false,
    showPreviews: "always",
    badgeApp: true,
  })

  const applyAccentColor = (color: string) => {
    setAccentColor(color)
    // Apply to CSS custom properties for system-wide theming
    document.documentElement.style.setProperty("--accent-color", getAccentColorValue(color))
    document.documentElement.style.setProperty("--accent-color-light", getAccentColorValue(color, 0.2))
    document.documentElement.style.setProperty("--accent-color-dark", getAccentColorValue(color, 0.8))
  }

  const getAccentColorValue = (color: string, opacity = 1) => {
    const colors = {
      blue: `rgba(59, 130, 246, ${opacity})`,
      purple: `rgba(147, 51, 234, ${opacity})`,
      pink: `rgba(236, 72, 153, ${opacity})`,
      red: `rgba(239, 68, 68, ${opacity})`,
      orange: `rgba(249, 115, 22, ${opacity})`,
      yellow: `rgba(245, 158, 11, ${opacity})`,
      green: `rgba(34, 197, 94, ${opacity})`,
    }
    return colors[color as keyof typeof colors] || colors.blue
  }

  const updateSetting = (key: string, value: any) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  const renderSettingContent = () => {
    switch (selectedCategory) {
      case "general":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4">System Preferences</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-white/10 rounded-xl">
                  <div>
                    <h4 className="font-medium text-gray-800">Automatic Updates</h4>
                    <p className="text-sm text-gray-600">Keep your Mac up to date automatically</p>
                  </div>
                  <button
                    onClick={() => updateSetting("autoUpdate", !settings.autoUpdate)}
                    className={`relative w-11 h-6 rounded-full transition-all duration-200 ${
                      settings.autoUpdate ? "bg-blue-500" : "bg-gray-300"
                    }`}
                  >
                    <div
                      className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all duration-200 ${
                        settings.autoUpdate ? "left-6" : "left-1"
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between p-4 bg-white/10 rounded-xl">
                  <div>
                    <h4 className="font-medium text-gray-800">Startup Sound</h4>
                    <p className="text-sm text-gray-600">Play sound when Mac starts up</p>
                  </div>
                  <button
                    onClick={() => updateSetting("startupSound", !settings.startupSound)}
                    className={`relative w-11 h-6 rounded-full transition-all duration-200 ${
                      settings.startupSound ? "bg-blue-500" : "bg-gray-300"
                    }`}
                  >
                    <div
                      className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all duration-200 ${
                        settings.startupSound ? "left-6" : "left-1"
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Storage</h3>
              <div className="p-4 bg-white/10 rounded-xl">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-gray-800 font-medium">Macintosh HD</span>
                  <span className="text-gray-600">512 GB available of 1 TB</span>
                </div>
                <div className="w-full bg-gray-300 rounded-full h-2">
                  <div className="bg-blue-500 h-2 rounded-full" style={{ width: "50%" }}></div>
                </div>
                <div className="flex justify-between text-xs text-gray-600 mt-2">
                  <span>Used: 512 GB</span>
                  <span>Free: 512 GB</span>
                </div>
              </div>
            </div>
          </div>
        )

      case "display":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Display Settings</h3>
              <div className="space-y-4">
                <div className="p-4 bg-white/10 rounded-xl">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium text-gray-800">Brightness</h4>
                    <span className="text-gray-600">{settings.brightness}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={settings.brightness}
                    onChange={(e) => updateSetting("brightness", Number(e.target.value))}
                    className="w-full h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer slider"
                  />
                </div>

                <div className="flex items-center justify-between p-4 bg-white/10 rounded-xl">
                  <div className="flex items-center gap-3">
                    <Moon className="w-5 h-5 text-gray-600" />
                    <div>
                      <h4 className="font-medium text-gray-800">Night Shift</h4>
                      <p className="text-sm text-gray-600">Warmer colors at night</p>
                    </div>
                  </div>
                  <button
                    onClick={() => updateSetting("nightShift", !settings.nightShift)}
                    className={`relative w-11 h-6 rounded-full transition-all duration-200 ${
                      settings.nightShift ? "bg-orange-500" : "bg-gray-300"
                    }`}
                  >
                    <div
                      className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all duration-200 ${
                        settings.nightShift ? "left-6" : "left-1"
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between p-4 bg-white/10 rounded-xl">
                  <div>
                    <h4 className="font-medium text-gray-800">True Tone</h4>
                    <p className="text-sm text-gray-600">Automatically adjust display to ambient lighting</p>
                  </div>
                  <button
                    onClick={() => updateSetting("trueTone", !settings.trueTone)}
                    className={`relative w-11 h-6 rounded-full transition-all duration-200 ${
                      settings.trueTone ? "bg-blue-500" : "bg-gray-300"
                    }`}
                  >
                    <div
                      className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all duration-200 ${
                        settings.trueTone ? "left-6" : "left-1"
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )

      case "sound":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Sound Settings</h3>
              <div className="space-y-4">
                <div className="p-4 bg-white/10 rounded-xl">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium text-gray-800">Output Volume</h4>
                    <span className="text-gray-600">{settings.volume}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={settings.volume}
                    onChange={(e) => updateSetting("volume", Number(e.target.value))}
                    className="w-full h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer slider"
                  />
                </div>

                <div className="p-4 bg-white/10 rounded-xl">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium text-gray-800">Alert Volume</h4>
                    <span className="text-gray-600">{settings.alertVolume}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={settings.alertVolume}
                    onChange={(e) => updateSetting("alertVolume", Number(e.target.value))}
                    className="w-full h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer slider"
                  />
                </div>

                <div className="flex items-center justify-between p-4 bg-white/10 rounded-xl">
                  <div>
                    <h4 className="font-medium text-gray-800">Sound Effects</h4>
                    <p className="text-sm text-gray-600">Play user interface sound effects</p>
                  </div>
                  <button
                    onClick={() => updateSetting("soundEffects", !settings.soundEffects)}
                    className={`relative w-11 h-6 rounded-full transition-all duration-200 ${
                      settings.soundEffects ? "bg-blue-500" : "bg-gray-300"
                    }`}
                  >
                    <div
                      className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all duration-200 ${
                        settings.soundEffects ? "left-6" : "left-1"
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )

      case "network":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Network & Connectivity</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-white/10 rounded-xl">
                  <div className="flex items-center gap-3">
                    <Wifi className="w-5 h-5 text-gray-600" />
                    <div>
                      <h4 className="font-medium text-gray-800">Wi-Fi</h4>
                      <p className="text-sm text-gray-600">Connected to "Home Network"</p>
                    </div>
                  </div>
                  <button
                    onClick={() => updateSetting("wifi", !settings.wifi)}
                    className={`relative w-11 h-6 rounded-full transition-all duration-200 ${
                      settings.wifi ? "bg-green-500" : "bg-gray-300"
                    }`}
                  >
                    <div
                      className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all duration-200 ${
                        settings.wifi ? "left-6" : "left-1"
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between p-4 bg-white/10 rounded-xl">
                  <div className="flex items-center gap-3">
                    <Bluetooth className="w-5 h-5 text-gray-600" />
                    <div>
                      <h4 className="font-medium text-gray-800">Bluetooth</h4>
                      <p className="text-sm text-gray-600">2 devices connected</p>
                    </div>
                  </div>
                  <button
                    onClick={() => updateSetting("bluetooth", !settings.bluetooth)}
                    className={`relative w-11 h-6 rounded-full transition-all duration-200 ${
                      settings.bluetooth ? "bg-blue-500" : "bg-gray-300"
                    }`}
                  >
                    <div
                      className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all duration-200 ${
                        settings.bluetooth ? "left-6" : "left-1"
                      }`}
                    />
                  </button>
                </div>

                <div className="p-4 bg-white/10 rounded-xl">
                  <h4 className="font-medium text-gray-800 mb-3">AirDrop</h4>
                  <div className="space-y-2">
                    {["off", "contacts", "everyone"].map((option) => (
                      <button
                        key={option}
                        onClick={() => updateSetting("airdrop", option)}
                        className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                          settings.airdrop === option
                            ? "bg-blue-500/20 text-blue-700 font-medium"
                            : "text-gray-600 hover:bg-white/10"
                        }`}
                      >
                        {option === "off" ? "Receiving Off" : option === "contacts" ? "Contacts Only" : "Everyone"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )

      case "privacy":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Privacy & Security</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-white/10 rounded-xl">
                  <div className="flex items-center gap-3">
                    <Globe className="w-5 h-5 text-gray-600" />
                    <div>
                      <h4 className="font-medium text-gray-800">Location Services</h4>
                      <p className="text-sm text-gray-600">Allow apps to access your location</p>
                    </div>
                  </div>
                  <button
                    onClick={() => updateSetting("locationServices", !settings.locationServices)}
                    className={`relative w-11 h-6 rounded-full transition-all duration-200 ${
                      settings.locationServices ? "bg-blue-500" : "bg-gray-300"
                    }`}
                  >
                    <div
                      className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all duration-200 ${
                        settings.locationServices ? "left-6" : "left-1"
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between p-4 bg-white/10 rounded-xl">
                  <div>
                    <h4 className="font-medium text-gray-800">Analytics & Improvements</h4>
                    <p className="text-sm text-gray-600">Share analytics data with Apple</p>
                  </div>
                  <button
                    onClick={() => updateSetting("analytics", !settings.analytics)}
                    className={`relative w-11 h-6 rounded-full transition-all duration-200 ${
                      settings.analytics ? "bg-blue-500" : "bg-gray-300"
                    }`}
                  >
                    <div
                      className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all duration-200 ${
                        settings.analytics ? "left-6" : "left-1"
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between p-4 bg-white/10 rounded-xl">
                  <div>
                    <h4 className="font-medium text-gray-800">Crash Reports</h4>
                    <p className="text-sm text-gray-600">Automatically send crash reports</p>
                  </div>
                  <button
                    onClick={() => updateSetting("crashReports", !settings.crashReports)}
                    className={`relative w-11 h-6 rounded-full transition-all duration-200 ${
                      settings.crashReports ? "bg-blue-500" : "bg-gray-300"
                    }`}
                  >
                    <div
                      className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all duration-200 ${
                        settings.crashReports ? "left-6" : "left-1"
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )

      case "notifications":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Notifications</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-white/10 rounded-xl">
                  <div className="flex items-center gap-3">
                    <Moon className="w-5 h-5 text-gray-600" />
                    <div>
                      <h4 className="font-medium text-gray-800">Do Not Disturb</h4>
                      <p className="text-sm text-gray-600">Silence notifications and calls</p>
                    </div>
                  </div>
                  <button
                    onClick={() => updateSetting("doNotDisturb", !settings.doNotDisturb)}
                    className={`relative w-11 h-6 rounded-full transition-all duration-200 ${
                      settings.doNotDisturb ? "bg-purple-500" : "bg-gray-300"
                    }`}
                  >
                    <div
                      className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all duration-200 ${
                        settings.doNotDisturb ? "left-6" : "left-1"
                      }`}
                    />
                  </button>
                </div>

                <div className="p-4 bg-white/10 rounded-xl">
                  <h4 className="font-medium text-gray-800 mb-3">Show Previews</h4>
                  <div className="space-y-2">
                    {["always", "unlocked", "never"].map((option) => (
                      <button
                        key={option}
                        onClick={() => updateSetting("showPreviews", option)}
                        className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                          settings.showPreviews === option
                            ? "bg-blue-500/20 text-blue-700 font-medium"
                            : "text-gray-600 hover:bg-white/10"
                        }`}
                      >
                        {option === "always" ? "Always" : option === "unlocked" ? "When Unlocked" : "Never"}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-white/10 rounded-xl">
                  <div>
                    <h4 className="font-medium text-gray-800">Badge App Icon</h4>
                    <p className="text-sm text-gray-600">Show notification badges on app icons</p>
                  </div>
                  <button
                    onClick={() => updateSetting("badgeApp", !settings.badgeApp)}
                    className={`relative w-11 h-6 rounded-full transition-all duration-200 ${
                      settings.badgeApp ? "bg-red-500" : "bg-gray-300"
                    }`}
                  >
                    <div
                      className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all duration-200 ${
                        settings.badgeApp ? "left-6" : "left-1"
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )

      case "appearance":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Appearance</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-white/10 rounded-xl">
                  <div className="flex items-center gap-3">
                    {settings.darkMode ? (
                      <Moon className="w-5 h-5 text-gray-600" />
                    ) : (
                      <Sun className="w-5 h-5 text-gray-600" />
                    )}
                    <div>
                      <h4 className="font-medium text-gray-800">Dark Mode</h4>
                      <p className="text-sm text-gray-600">Use dark appearance</p>
                    </div>
                  </div>
                  <button
                    onClick={() => updateSetting("darkMode", !settings.darkMode)}
                    className={`relative w-11 h-6 rounded-full transition-all duration-200 ${
                      settings.darkMode ? "bg-gray-800" : "bg-gray-300"
                    }`}
                  >
                    <div
                      className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all duration-200 ${
                        settings.darkMode ? "left-6" : "left-1"
                      }`}
                    />
                  </button>
                </div>

                <div className="p-4 bg-white/10 rounded-xl">
                  <h4 className="font-medium text-gray-800 mb-3">Accent Color</h4>
                  <p className="text-sm text-gray-600 mb-4">
                    Choose an accent color for buttons, selections, and links
                  </p>
                  <div className="flex gap-3">
                    {[
                      { color: "blue", bg: "bg-blue-500", name: "Blue" },
                      { color: "purple", bg: "bg-purple-500", name: "Purple" },
                      { color: "pink", bg: "bg-pink-500", name: "Pink" },
                      { color: "red", bg: "bg-red-500", name: "Red" },
                      { color: "orange", bg: "bg-orange-500", name: "Orange" },
                      { color: "yellow", bg: "bg-yellow-500", name: "Yellow" },
                      { color: "green", bg: "bg-green-500", name: "Green" },
                    ].map((accent) => (
                      <button
                        key={accent.color}
                        onClick={() => applyAccentColor(accent.color)}
                        className={`w-10 h-10 rounded-full ${accent.bg} hover:scale-110 transition-all duration-200 border-2 ${
                          accentColor === accent.color ? "border-white shadow-lg scale-110" : "border-white/50"
                        } relative group`}
                        title={accent.name}
                      >
                        {accentColor === accent.color && (
                          <div className="absolute inset-0 rounded-full bg-white/30 animate-pulse" />
                        )}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Current: {accentColor.charAt(0).toUpperCase() + accentColor.slice(1)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )

      default:
        return (
          <div className="flex items-center justify-center h-64">
            <p className="text-gray-600">Select a category to view settings</p>
          </div>
        )
    }
  }

  return (
    <div className="flex-1 p-6">
      <div className="max-w-6xl mx-auto h-full">
        <div className="bg-white/20 backdrop-blur-xl border border-white/30 rounded-2xl shadow-2xl overflow-hidden h-full flex flex-col">
          {/* Title Bar */}
          <div className="flex items-center justify-between p-4 bg-white/10 border-b border-white/20">
            <h2 className="text-lg font-semibold text-gray-800">System Preferences</h2>
            <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-full transition-colors">
              <X className="w-4 h-4 text-gray-600" />
            </button>
          </div>

          <div className="flex flex-1 overflow-hidden">
            {/* Sidebar */}
            <div className="w-80 bg-white/10 border-r border-white/20 p-4 overflow-y-auto">
              <div className="space-y-2">
                {[
                  { id: "general", title: "General", icon: Monitor, description: "Software update, storage, AirDrop" },
                  { id: "display", title: "Display", icon: Eye, description: "Brightness, Night Shift, resolution" },
                  { id: "sound", title: "Sound", icon: Volume2, description: "Volume, sound effects, alerts" },
                  { id: "network", title: "Network", icon: Wifi, description: "Wi-Fi, Bluetooth, sharing" },
                  {
                    id: "privacy",
                    title: "Privacy & Security",
                    icon: Shield,
                    description: "Location, analytics, permissions",
                  },
                  { id: "notifications", title: "Notifications", icon: Bell, description: "Alerts, badges, sounds" },
                  { id: "users", title: "Users & Groups", icon: Users, description: "Account settings, login items" },
                  {
                    id: "appearance",
                    title: "Appearance",
                    icon: Palette,
                    description: "Theme, accent colors, sidebar",
                  },
                ].map((category) => (
                  <button
                    key={category.id}
                    onClick={() => setSelectedCategory(category.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200 ${
                      selectedCategory === category.id
                        ? "bg-blue-500/20 text-blue-700 shadow-sm scale-[1.02]"
                        : "text-gray-600 hover:bg-white/10 hover:text-gray-800 hover:scale-[1.01]"
                    }`}
                  >
                    <div
                      className={`p-2 rounded-lg ${
                        selectedCategory === category.id ? "bg-blue-500/30" : "bg-white/20"
                      }`}
                    >
                      <category.icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 text-left">
                      <h3 className="font-medium">{category.title}</h3>
                      <p className="text-xs opacity-70">{category.description}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 opacity-50" />
                  </button>
                ))}
              </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 p-6 overflow-y-auto">{renderSettingContent()}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
