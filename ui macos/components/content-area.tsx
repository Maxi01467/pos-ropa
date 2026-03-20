"use client"

import { Apple, Sparkles, Zap, Globe, Shield, Heart } from "lucide-react"
import { useState } from "react"

export function ContentArea() {
  const [selectedFeature, setSelectedFeature] = useState<number | null>(null)

  const features = [
    {
      name: "Liquid Glass Design",
      description: "Experience the revolutionary translucent interface that adapts to your workflow",
      icon: Sparkles,
      color: "blue",
      gradient: "from-blue-400 to-cyan-500",
    },
    {
      name: "Enhanced Performance",
      description: "Lightning-fast operations with optimized system architecture",
      icon: Zap,
      color: "yellow",
      gradient: "from-yellow-400 to-orange-500",
    },
    {
      name: "Advanced Security",
      description: "Next-generation privacy protection with built-in encryption",
      icon: Shield,
      color: "green",
      gradient: "from-green-400 to-emerald-500",
    },
    {
      name: "Seamless Integration",
      description: "Connect all your devices and services in perfect harmony",
      icon: Globe,
      color: "purple",
      gradient: "from-purple-400 to-pink-500",
    },
    {
      name: "Intuitive Experience",
      description: "Designed for humans, powered by intelligence",
      icon: Heart,
      color: "red",
      gradient: "from-red-400 to-rose-500",
    },
  ]

  return (
    <div className="flex-1 p-8 overflow-auto">
      {/* Welcome Section */}
      <div className="text-center mb-12">
        <div className="flex items-center justify-center mb-6">
          <Apple className="w-16 h-16 text-white/80 mr-4" />
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Welcome to macOS Tahoe</h1>
            <p className="text-xl text-white/80">The future of computing, today</p>
          </div>
        </div>

        <div className="max-w-2xl mx-auto">
          <p className="text-lg text-white/70 leading-relaxed">
            Experience the next evolution of macOS with revolutionary Liquid Glass design, enhanced performance, and
            seamless integration across all your devices.
          </p>
        </div>
      </div>

      {/* Features Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
        {features.map((feature, index) => (
          <div
            key={index}
            onMouseEnter={() => setSelectedFeature(index)}
            onMouseLeave={() => setSelectedFeature(null)}
            className={`group relative p-6 rounded-2xl backdrop-blur-sm border transition-all duration-500 cursor-pointer shadow-lg hover:shadow-2xl transform hover:scale-[1.02] ${
              selectedFeature === index
                ? "bg-white/25 border-white/40 shadow-white/20"
                : "bg-gradient-to-br from-white/15 to-white/5 border-white/20 hover:border-white/40 hover:bg-white/20"
            }`}
          >
            {/* Animated background gradient */}
            <div
              className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-500`}
            />

            <div className="relative z-10">
              <div
                className={`p-3 rounded-xl backdrop-blur-sm transition-all duration-300 mb-4 ${
                  selectedFeature === index
                    ? `bg-gradient-to-br ${feature.gradient} text-white`
                    : "bg-white/20 text-white/80"
                }`}
              >
                <feature.icon className="w-6 h-6" />
              </div>

              <h3 className="font-semibold text-white text-lg mb-2 group-hover:text-white transition-colors">
                {feature.name}
              </h3>

              <p className="text-white/70 text-sm leading-relaxed group-hover:text-white/90 transition-colors">
                {feature.description}
              </p>
            </div>

            {/* Hover effect overlay */}
            {selectedFeature === index && (
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/5 to-transparent animate-in fade-in duration-300" />
            )}
          </div>
        ))}
      </div>

      {/* Interactive Components Showcase */}
      <div className="space-y-8">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-white mb-2">Interactive Liquid Glass Components</h2>
          <p className="text-white/70">Experience the beauty of translucent design</p>
        </div>

        <InteractiveComponentsShowcase />
      </div>

      {/* Getting Started Section */}
      <div className="mt-12 p-8 rounded-2xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-sm border border-white/20">
        <div className="text-center">
          <h3 className="text-xl font-semibold text-white mb-4">Ready to Get Started?</h3>
          <p className="text-white/70 mb-6 max-w-md mx-auto">
            Explore the dock below to launch your favorite apps, or use Spotlight search to find anything instantly.
          </p>
          <div className="flex items-center justify-center gap-4 text-sm text-white/60">
            <div className="flex items-center gap-2">
              <kbd className="px-2 py-1 bg-white/20 rounded text-xs">⌘</kbd>
              <span>+</span>
              <kbd className="px-2 py-1 bg-white/20 rounded text-xs">Space</kbd>
              <span>for Spotlight</span>
            </div>
            <div className="w-px h-4 bg-white/20" />
            <span>Click dock icons to launch apps</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function InteractiveComponentsShowcase() {
  const [sliderValue, setSliderValue] = useState(50)
  const [toggleStates, setToggleStates] = useState({ notifications: true, darkMode: false, autoSave: true })
  const [selectedTab, setSelectedTab] = useState("overview")

  const toggleSetting = (key: keyof typeof toggleStates) => {
    setToggleStates((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Interactive Controls */}
      <div className="p-6 rounded-xl bg-gradient-to-br from-white/15 to-white/5 backdrop-blur-sm border border-white/20 hover:border-white/30 transition-all duration-300">
        <h3 className="font-medium text-white mb-4">Interactive Controls</h3>
        <div className="space-y-4">
          {/* Slider */}
          <div>
            <label className="text-sm text-white/80 mb-2 block">Volume: {sliderValue}%</label>
            <input
              type="range"
              min="0"
              max="100"
              value={sliderValue}
              onChange={(e) => setSliderValue(Number(e.target.value))}
              className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer slider"
            />
          </div>

          {/* Toggles */}
          <div className="space-y-3">
            {Object.entries(toggleStates).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-sm text-white/80 capitalize">{key.replace(/([A-Z])/g, " $1")}</span>
                <button
                  onClick={() => toggleSetting(key as keyof typeof toggleStates)}
                  className={`relative w-11 h-6 rounded-full transition-all duration-200 ${
                    value ? "bg-blue-500" : "bg-white/20"
                  }`}
                >
                  <div
                    className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all duration-200 ${
                      value ? "left-6" : "left-1"
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabbed Interface */}
      <div className="p-6 rounded-xl bg-gradient-to-br from-white/15 to-white/5 backdrop-blur-sm border border-white/20 hover:border-white/30 transition-all duration-300">
        <h3 className="font-medium text-white mb-4">Tabbed Interface</h3>
        <div className="space-y-4">
          <div className="flex gap-1 p-1 rounded-lg bg-white/10">
            {["overview", "details", "settings"].map((tab) => (
              <button
                key={tab}
                onClick={() => setSelectedTab(tab)}
                className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                  selectedTab === tab
                    ? "bg-white/20 text-white shadow-sm"
                    : "text-white/70 hover:text-white hover:bg-white/10"
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
          <div className="p-4 rounded-lg bg-white/10 min-h-[80px] flex items-center justify-center">
            <p className="text-sm text-white/70 text-center">
              {selectedTab === "overview" && "Overview content with charts and summaries"}
              {selectedTab === "details" && "Detailed information and specifications"}
              {selectedTab === "settings" && "Configuration options and preferences"}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
