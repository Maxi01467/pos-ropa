"use client"

import { Home, Folder, Star, Clock, Trash2, Settings, ChevronDown, ChevronRight } from "lucide-react"
import { useState } from "react"

interface SidebarProps {
  activeView: string
  onViewChange: (view: string) => void
}

export function Sidebar({ activeView, onViewChange }: SidebarProps) {
  const [expandedSections, setExpandedSections] = useState<string[]>(["Favorites"])

  const sidebarItems = [
    { icon: Home, label: "Home" },
    { icon: Folder, label: "Documents" },
    { icon: Star, label: "Favorites" },
    { icon: Clock, label: "Recent" },
    { icon: Trash2, label: "Trash" },
    { icon: Settings, label: "Settings" },
  ]

  const favoriteItems = ["Important Files", "Work Projects", "Personal Photos", "Music Library"]

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => (prev.includes(section) ? prev.filter((s) => s !== section) : [...prev, section]))
  }

  const handleItemClick = (item: string) => {
    onViewChange(item)
  }

  return (
    <div className="w-64 bg-white/10 backdrop-blur-md border-r border-white/20 p-4 h-full overflow-y-auto scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
      <div className="space-y-1">
        {sidebarItems.map((item, index) => (
          <div key={index}>
            <button
              onClick={() => handleItemClick(item.label)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-all duration-200 group interactive-button focus-ring ${
                activeView === item.label
                  ? "bg-white/20 text-gray-800 shadow-sm backdrop-blur-sm scale-[1.02] pulse-glow"
                  : "text-gray-600 hover:bg-white/10 hover:text-gray-800 hover:scale-[1.01] selectable"
              }`}
            >
              <item.icon
                className={`w-4 h-4 transition-transform duration-200 ${activeView === item.label ? "scale-110" : "group-hover:scale-105"}`}
              />
              <span className="text-sm font-medium">{item.label}</span>
              {item.label === "Favorites" && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleSection("Favorites")
                  }}
                  className="ml-auto p-0.5 rounded hover:bg-white/10 transition-all duration-200 interactive-button focus-ring"
                >
                  {expandedSections.includes("Favorites") ? (
                    <ChevronDown className="w-3 h-3 transition-transform duration-200" />
                  ) : (
                    <ChevronRight className="w-3 h-3 transition-transform duration-200" />
                  )}
                </button>
              )}
            </button>

            {item.label === "Favorites" && expandedSections.includes("Favorites") && (
              <div className="ml-6 mt-1 space-y-1 animate-in slide-in-from-top-2 duration-200">
                {favoriteItems.map((fav, favIndex) => (
                  <button
                    key={favIndex}
                    onClick={() => handleItemClick(fav)}
                    className={`w-full text-left px-3 py-1.5 rounded-md text-xs transition-all duration-150 interactive-button focus-ring selectable ${
                      activeView === fav
                        ? "bg-white/15 text-gray-800 selected"
                        : "text-gray-500 hover:bg-white/8 hover:text-gray-700"
                    }`}
                  >
                    {fav}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-8 p-4 rounded-xl bg-gradient-to-br from-white/20 to-white/10 backdrop-blur-sm border border-white/30 shadow-lg hover:shadow-xl hover:from-white/25 hover:to-white/15 transition-all duration-300 cursor-pointer group glass-morphism float-animation">
        <h3 className="text-sm font-semibold text-gray-800 mb-2 group-hover:text-gray-900 transition-colors">
          Liquid Glass
        </h3>
        <p className="text-xs text-gray-600 leading-relaxed group-hover:text-gray-700 transition-colors">
          Experience the new translucent design language that reflects and refracts its surroundings.
        </p>
        <div className="mt-3 w-full h-1 bg-gradient-to-r from-blue-400/30 to-purple-400/30 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full w-0 group-hover:w-full transition-all duration-1000 ease-out"></div>
        </div>
      </div>
    </div>
  )
}
