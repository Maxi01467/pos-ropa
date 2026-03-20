"use client"
import { Button } from "@/components/ui/button"
import { X, Check } from "lucide-react"

interface Wallpaper {
  id: string
  name: string
  type: "gradient" | "image" | "animated"
  preview: string
  className: string
}

interface WallpaperSelectorProps {
  onClose: () => void
  onWallpaperChange: (wallpaper: Wallpaper) => void
  currentWallpaper: string
}

export function WallpaperSelector({ onClose, onWallpaperChange, currentWallpaper }: WallpaperSelectorProps) {
  const wallpapers: Wallpaper[] = [
    {
      id: "tahoe-default",
      name: "Tahoe",
      type: "animated",
      preview: "macOS Tahoe default wallpaper",
      className: "bg-gradient-to-br from-blue-400 via-purple-500 to-pink-500",
    },
    {
      id: "monterey",
      name: "Monterey",
      type: "gradient",
      preview: "macOS Monterey inspired",
      className: "bg-gradient-to-br from-purple-600 via-blue-600 to-teal-500",
    },
    {
      id: "big-sur",
      name: "Big Sur",
      type: "gradient",
      preview: "macOS Big Sur inspired",
      className: "bg-gradient-to-br from-pink-400 via-purple-400 to-indigo-600",
    },
    {
      id: "ventura",
      name: "Ventura",
      type: "animated",
      preview: "macOS Ventura inspired",
      className: "bg-gradient-to-br from-blue-500 via-cyan-400 to-teal-400",
    },
    {
      id: "sonoma",
      name: "Sonoma",
      type: "gradient",
      preview: "macOS Sonoma inspired",
      className: "bg-gradient-to-br from-orange-400 via-red-500 to-pink-600",
    },
    {
      id: "sequoia",
      name: "Sequoia",
      type: "animated",
      preview: "macOS Sequoia inspired",
      className: "bg-gradient-to-br from-green-500 via-emerald-500 to-teal-600",
    },
    {
      id: "catalina",
      name: "Catalina",
      type: "gradient",
      preview: "macOS Catalina inspired",
      className: "bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-800",
    },
    {
      id: "mojave-light",
      name: "Mojave Light",
      type: "gradient",
      preview: "macOS Mojave day mode",
      className: "bg-gradient-to-br from-yellow-300 via-orange-400 to-red-500",
    },
    {
      id: "mojave-dark",
      name: "Mojave Dark",
      type: "animated",
      preview: "macOS Mojave night mode",
      className: "bg-gradient-to-br from-gray-800 via-gray-900 to-black",
    },
    {
      id: "high-sierra",
      name: "High Sierra",
      type: "gradient",
      preview: "macOS High Sierra inspired",
      className: "bg-gradient-to-br from-blue-400 via-indigo-500 to-purple-600",
    },
    {
      id: "sierra",
      name: "Sierra",
      type: "gradient",
      preview: "macOS Sierra inspired",
      className: "bg-gradient-to-br from-gray-400 via-gray-600 to-gray-800",
    },
    {
      id: "el-capitan",
      name: "El Capitan",
      type: "gradient",
      preview: "macOS El Capitan inspired",
      className: "bg-gradient-to-br from-blue-300 via-blue-500 to-blue-700",
    },
    {
      id: "yosemite",
      name: "Yosemite",
      type: "animated",
      preview: "macOS Yosemite inspired",
      className: "bg-gradient-to-br from-green-400 via-blue-500 to-purple-600",
    },
    {
      id: "mavericks",
      name: "Mavericks",
      type: "gradient",
      preview: "macOS Mavericks inspired",
      className: "bg-gradient-to-br from-blue-500 via-teal-500 to-cyan-600",
    },
    {
      id: "mountain-lion",
      name: "Mountain Lion",
      type: "gradient",
      preview: "macOS Mountain Lion inspired",
      className: "bg-gradient-to-br from-gray-600 via-gray-700 to-gray-900",
    },
    {
      id: "lion",
      name: "Lion",
      type: "animated",
      preview: "macOS Lion inspired",
      className: "bg-gradient-to-br from-purple-500 via-indigo-600 to-blue-700",
    },
  ]

  const handleWallpaperSelect = (wallpaper: Wallpaper) => {
    onWallpaperChange(wallpaper)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white/90 backdrop-blur-xl border border-white/30 rounded-2xl p-6 max-w-5xl w-full mx-4 max-h-[85vh] overflow-y-auto scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Desktop & Screen Saver</h2>
            <p className="text-sm text-gray-600 mt-1">Choose a wallpaper for your desktop</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="hover:bg-white/20">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-3">macOS Wallpapers</h3>
          <p className="text-sm text-gray-500 mb-4">Official macOS-inspired wallpapers from different versions</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {wallpapers.map((wallpaper) => (
            <div
              key={wallpaper.id}
              className="relative group cursor-pointer"
              onClick={() => handleWallpaperSelect(wallpaper)}
            >
              <div
                className={`w-full h-32 rounded-lg border-2 transition-all duration-200 ${
                  currentWallpaper === wallpaper.id
                    ? "border-blue-500 ring-2 ring-blue-200 shadow-lg"
                    : "border-white/30 hover:border-white/50 hover:shadow-md"
                } ${wallpaper.className} relative overflow-hidden`}
              >
                {wallpaper.type === "animated" && (
                  <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute top-1/4 left-1/4 w-20 h-20 bg-white/15 rounded-full blur-xl animate-pulse"></div>
                    <div className="absolute bottom-1/4 right-1/4 w-16 h-16 bg-white/10 rounded-full blur-lg animate-pulse delay-1000"></div>
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-12 h-12 bg-white/12 rounded-full blur-md animate-pulse delay-500"></div>
                    <div className="absolute top-3/4 left-1/3 w-8 h-8 bg-white/8 rounded-full blur-sm animate-pulse delay-1500"></div>
                  </div>
                )}

                {/* Selection indicator */}
                {currentWallpaper === wallpaper.id && (
                  <div className="absolute top-2 right-2 bg-blue-500 text-white rounded-full p-1.5 shadow-lg">
                    <Check className="h-3 w-3" />
                  </div>
                )}

                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-all duration-200 flex items-center justify-center rounded-lg">
                  <div className="text-white text-sm font-medium bg-black/20 px-3 py-1 rounded-full backdrop-blur-sm">
                    Select
                  </div>
                </div>
              </div>

              <div className="mt-3 text-center">
                <h3 className="font-medium text-gray-800 text-sm">{wallpaper.name}</h3>
                <p className="text-xs text-gray-600 mt-1">{wallpaper.preview}</p>
                <div className="flex items-center justify-center gap-1 mt-2">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      wallpaper.type === "gradient"
                        ? "bg-blue-400"
                        : wallpaper.type === "animated"
                          ? "bg-purple-400"
                          : "bg-green-400"
                    }`}
                  ></div>
                  <span className="text-xs text-gray-500 capitalize">{wallpaper.type}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 text-center border-t border-white/20 pt-6">
          <p className="text-sm text-gray-600">Wallpapers inspired by macOS versions from Lion to Tahoe</p>
          <p className="text-xs text-gray-500 mt-1">
            Animated wallpapers include floating elements • Gradient wallpapers are static
          </p>
        </div>
      </div>
    </div>
  )
}
