"use client"

import type React from "react"

import { useState } from "react"
import { MacOSWindow } from "@/components/macos-window"
import { Sidebar } from "@/components/sidebar"
import { Toolbar } from "@/components/toolbar"
import { ContentArea } from "@/components/content-area"
import { HomeMenu } from "@/components/home-menu"
import { Calculator } from "@/components/apps/calculator"
import { Notes } from "@/components/apps/notes"
import { Music } from "@/components/apps/music"
import { Photos } from "@/components/apps/photos"
import { Settings } from "@/components/apps/settings"
import { AppStore } from "@/components/apps/app-store"
import { Excel } from "@/components/apps/excel"
import { PowerPoint } from "@/components/apps/powerpoint"
import { Word } from "@/components/apps/word"
import { Photoshop } from "@/components/apps/photoshop"
import { Illustrator } from "@/components/apps/illustrator"
import { Premiere } from "@/components/apps/premiere"
import { VSCode } from "@/components/apps/vscode"
import { Terminal } from "@/components/apps/terminal"
import { GitHub } from "@/components/apps/github"
import { Netflix } from "@/components/apps/netflix"
import { Spotify } from "@/components/apps/spotify"
import { Chess } from "@/components/apps/chess"
import { Browser } from "@/components/apps/browser"
import { Mail } from "@/components/apps/mail"
import { Finder } from "@/components/apps/finder"
import { WallpaperSelector } from "@/components/wallpaper-selector"
import { WidgetSystem } from "@/components/widgets/widget-system"

interface Wallpaper {
  id: string
  name: string
  type: "gradient" | "image" | "animated"
  preview: string
  className: string
}

// Updated wallpaper configurations to match official macOS backgrounds
const wallpaperConfigs: { [key: string]: { className: string; animated: boolean } } = {
  "tahoe-default": {
    className: "bg-gradient-to-br from-blue-400 via-purple-500 to-pink-500",
    animated: true,
  },
  monterey: {
    className: "bg-gradient-to-br from-purple-600 via-blue-600 to-teal-500",
    animated: false,
  },
  "big-sur": {
    className: "bg-gradient-to-br from-pink-400 via-purple-400 to-indigo-600",
    animated: false,
  },
  ventura: {
    className: "bg-gradient-to-br from-blue-500 via-cyan-400 to-teal-400",
    animated: true,
  },
  sonoma: {
    className: "bg-gradient-to-br from-orange-400 via-red-500 to-pink-600",
    animated: false,
  },
  sequoia: {
    className: "bg-gradient-to-br from-green-500 via-emerald-500 to-teal-600",
    animated: true,
  },
  catalina: {
    className: "bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-800",
    animated: false,
  },
  "mojave-light": {
    className: "bg-gradient-to-br from-yellow-300 via-orange-400 to-red-500",
    animated: false,
  },
  "mojave-dark": {
    className: "bg-gradient-to-br from-gray-800 via-gray-900 to-black",
    animated: true,
  },
  "high-sierra": {
    className: "bg-gradient-to-br from-blue-400 via-indigo-500 to-purple-600",
    animated: false,
  },
  sierra: {
    className: "bg-gradient-to-br from-gray-400 via-gray-600 to-gray-800",
    animated: false,
  },
  "el-capitan": {
    className: "bg-gradient-to-br from-blue-300 via-blue-500 to-blue-700",
    animated: false,
  },
  yosemite: {
    className: "bg-gradient-to-br from-green-400 via-blue-500 to-purple-600",
    animated: true,
  },
  mavericks: {
    className: "bg-gradient-to-br from-blue-500 via-teal-500 to-cyan-600",
    animated: false,
  },
  "mountain-lion": {
    className: "bg-gradient-to-br from-gray-600 via-gray-700 to-gray-900",
    animated: false,
  },
  lion: {
    className: "bg-gradient-to-br from-purple-500 via-indigo-600 to-blue-700",
    animated: true,
  },
}

export default function Home() {
  const [activeView, setActiveView] = useState("Home")
  const [launchedApps, setLaunchedApps] = useState<string[]>([])
  const [installedApps, setInstalledApps] = useState<string[]>([])
  const [currentWallpaper, setCurrentWallpaper] = useState("tahoe-default")
  const [showWallpaperSelector, setShowWallpaperSelector] = useState(false)
  const [showWidgets, setShowWidgets] = useState(false)
  const [windowPositions, setWindowPositions] = useState<{ [key: string]: { x: number; y: number; zIndex: number } }>(
    {},
  )
  const [draggedWindow, setDraggedWindow] = useState<string | null>(null)
  const [maxZIndex, setMaxZIndex] = useState(1000)
  // Added system state management
  const [isRestarting, setIsRestarting] = useState(false)
  const [isShuttingDown, setIsShuttingDown] = useState(false)

  // Added system control handlers
  const handleRestart = () => {
    setIsRestarting(true)
    // Simulate restart process
    setTimeout(() => {
      // Reset all app states
      setLaunchedApps([])
      setActiveView("Home")
      setWindowPositions({})
      setIsRestarting(false)
      // Show restart animation
      document.body.style.filter = "brightness(0)"
      setTimeout(() => {
        document.body.style.filter = "brightness(1)"
      }, 1000)
    }, 2000)
  }

  const handleShutdown = () => {
    setIsShuttingDown(true)
    // Simulate shutdown process
    setTimeout(() => {
      document.body.style.filter = "brightness(0)"
      document.body.innerHTML =
        '<div style="position: fixed; inset: 0; background: black; display: flex; align-items: center; justify-content: center; color: white; font-size: 24px;">System Shut Down</div>'
    }, 2000)
  }

  const handleAppLaunch = (appName: string) => {
    if (!launchedApps.includes(appName)) {
      setLaunchedApps((prev) => [...prev, appName])
    }
    setActiveView(appName)
  }

  const handleAppClose = (appName: string) => {
    setLaunchedApps((prev) => prev.filter((app) => app !== appName))
    if (activeView === appName) {
      setActiveView("Home")
    }
  }

  const handleAppInstall = (appId: string) => {
    if (!installedApps.includes(appId)) {
      setInstalledApps((prev) => [...prev, appId])

      // Auto-launch the app in a new tab after installation
      setTimeout(() => {
        handleAppLaunch(appId)
      }, 500)
    }
  }

  const handleWallpaperChange = (wallpaper: Wallpaper) => {
    setCurrentWallpaper(wallpaper.id)
  }

  const handleDesktopRightClick = (e: React.MouseEvent) => {
    e.preventDefault()
    setShowWallpaperSelector(true)
  }

  const handleWindowDrag = (appName: string, deltaX: number, deltaY: number) => {
    setWindowPositions((prev) => ({
      ...prev,
      [appName]: {
        ...prev[appName],
        x: (prev[appName]?.x || 0) + deltaX,
        y: (prev[appName]?.y || 0) + deltaY,
        zIndex: prev[appName]?.zIndex || maxZIndex,
      },
    }))
  }

  const handleWindowFocus = (appName: string) => {
    const newZIndex = maxZIndex + 1
    setMaxZIndex(newZIndex)
    setWindowPositions((prev) => ({
      ...prev,
      [appName]: {
        ...prev[appName],
        x: prev[appName]?.x || 0,
        y: prev[appName]?.y || 0,
        zIndex: newZIndex,
      },
    }))
    setActiveView(appName)
  }

  const renderActiveContent = () => {
    switch (activeView) {
      case "Mail":
        return <Mail onClose={() => handleAppClose("Mail")} />
      case "Finder":
        return <Finder onClose={() => handleAppClose("Finder")} />
      case "Calculator":
        return <Calculator onClose={() => handleAppClose("Calculator")} />
      case "Notes":
        return <Notes onClose={() => handleAppClose("Notes")} />
      case "Music":
        return <Music onClose={() => handleAppClose("Music")} />
      case "Photos":
        return <Photos onClose={() => handleAppClose("Photos")} />
      case "Settings":
        return <Settings onClose={() => handleAppClose("Settings")} />
      case "App Store":
        return <AppStore onClose={() => handleAppClose("App Store")} onAppInstall={handleAppInstall} />
      case "Browser":
        return <Browser onClose={() => handleAppClose("Browser")} />
      case "excel":
        return <Excel onClose={() => handleAppClose("excel")} />
      case "powerpoint":
        return <PowerPoint onClose={() => handleAppClose("powerpoint")} />
      case "word":
        return <Word onClose={() => handleAppClose("word")} />
      case "photoshop":
        return <Photoshop onClose={() => handleAppClose("photoshop")} />
      case "illustrator":
        return <Illustrator onClose={() => handleAppClose("illustrator")} />
      case "premiere":
        return <Premiere onClose={() => handleAppClose("premiere")} />
      case "vscode":
        return <VSCode onClose={() => handleAppClose("vscode")} />
      case "terminal":
        return <Terminal onClose={() => handleAppClose("terminal")} />
      case "github":
        return <GitHub onClose={() => handleAppClose("github")} />
      case "netflix":
        return <Netflix onClose={() => handleAppClose("netflix")} />
      case "spotify":
        return <Spotify onClose={() => handleAppClose("spotify")} />
      case "chess":
        return <Chess onClose={() => handleAppClose("chess")} />
      case "figma":
        return (
          <div className="flex-1 p-6 text-center">
            <div className="text-6xl mb-4">🎯</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Figma</h2>
            <p className="text-gray-600">Collaborative interface design tool for teams.</p>
          </div>
        )
      case "slack":
        return (
          <div className="flex-1 p-6 text-center">
            <div className="text-6xl mb-4">💬</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Slack</h2>
            <p className="text-gray-600">Team communication and collaboration platform.</p>
          </div>
        )
      case "zoom":
        return (
          <div className="flex-1 p-6 text-center">
            <div className="text-6xl mb-4">📹</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Zoom</h2>
            <p className="text-gray-600">Video conferencing and online meetings platform.</p>
          </div>
        )
      case "notion":
        return (
          <div className="flex-1 p-6 text-center">
            <div className="text-6xl mb-4">📋</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Notion</h2>
            <p className="text-gray-600">All-in-one workspace for notes, tasks, wikis, and databases.</p>
          </div>
        )
      case "discord":
        return (
          <div className="flex-1 p-6 text-center">
            <div className="text-6xl mb-4">🎮</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Discord</h2>
            <p className="text-gray-600">Voice, video and text communication for gamers and communities.</p>
          </div>
        )
      case "blender":
        return (
          <div className="flex-1 p-6 text-center">
            <div className="text-6xl mb-4">🎲</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Blender</h2>
            <p className="text-gray-600">Free and open source 3D creation suite.</p>
          </div>
        )
      case "xcode":
        return (
          <div className="flex-1 p-6 text-center">
            <div className="text-6xl mb-4">🔨</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Xcode</h2>
            <p className="text-gray-600">Complete developer toolset for creating apps for Mac, iPhone, and iPad.</p>
          </div>
        )
      case "safari":
        return <Browser onClose={() => handleAppClose("safari")} />
      default:
        return <ContentArea />
    }
  }

  const wallpaperConfig = wallpaperConfigs[currentWallpaper] || wallpaperConfigs["tahoe-default"]

  return (
    <div
      className={`min-h-screen p-8 relative overflow-hidden ${wallpaperConfig.className}`}
      onContextMenu={handleDesktopRightClick}
      style={{ height: "100vh", overflowY: "auto", scrollBehavior: "smooth" }}
    >
      {wallpaperConfig.animated && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gradient-to-r from-blue-400/20 to-purple-400/20 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-gradient-to-r from-teal-400/20 to-blue-400/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-gradient-to-r from-purple-400/20 to-pink-400/20 rounded-full blur-3xl animate-pulse delay-500"></div>
          <div className="absolute top-10 right-10 w-32 h-32 bg-gradient-to-r from-yellow-400/20 to-orange-400/20 rounded-full blur-2xl animate-bounce"></div>
          <div className="absolute bottom-10 left-10 w-40 h-40 bg-gradient-to-r from-green-400/20 to-teal-400/20 rounded-full blur-2xl animate-bounce delay-700"></div>
        </div>
      )}

      {/* Added system status overlays */}
      {isRestarting && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[9999]">
          <div className="text-center text-white">
            <div className="animate-spin w-12 h-12 border-4 border-white border-t-transparent rounded-full mx-auto mb-4"></div>
            <h2 className="text-2xl font-semibold mb-2">Restarting...</h2>
            <p className="text-white/80">Please wait while macOS Tahoe restarts</p>
          </div>
        </div>
      )}

      {isShuttingDown && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[9999]">
          <div className="text-center text-white">
            <div className="animate-pulse w-12 h-12 bg-white rounded-full mx-auto mb-4"></div>
            <h2 className="text-2xl font-semibold mb-2">Shutting Down...</h2>
            <p className="text-white/80">Saving your work and closing applications</p>
          </div>
        </div>
      )}

      <div className="fixed top-0 left-0 right-0 z-50">
        <HomeMenu
          onAppLaunch={handleAppLaunch}
          installedApps={installedApps}
          onShowWidgets={() => setShowWidgets(true)}
          onRestart={handleRestart}
          onShutdown={handleShutdown}
        />
      </div>

      <div className="pt-16 h-full">
        <MacOSWindow>
          <div className="flex h-full overflow-hidden">
            <Sidebar activeView={activeView} onViewChange={setActiveView} />
            <div className="flex-1 flex flex-col overflow-hidden">
              <Toolbar />
              <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
                {renderActiveContent()}
              </div>
            </div>
          </div>
        </MacOSWindow>
      </div>

      {launchedApps.map((appName, index) => {
        if (appName === activeView) return null
        const position = windowPositions[appName] || { x: 100 + index * 50, y: 100 + index * 50, zIndex: 1000 + index }

        return (
          <div
            key={appName}
            className="fixed bg-white/10 backdrop-blur-xl border border-white/20 rounded-xl shadow-2xl transition-all duration-200 hover:shadow-3xl"
            style={{
              left: `${position.x}px`,
              top: `${position.y}px`,
              zIndex: position.zIndex,
              width: "700px",
              height: "500px",
              minWidth: "500px",
              minHeight: "400px",
            }}
            onClick={() => handleWindowFocus(appName)}
          >
            <div
              className="flex items-center justify-between p-3 bg-white/5 border-b border-white/10 cursor-move hover:bg-white/10 transition-colors"
              onMouseDown={(e) => {
                setDraggedWindow(appName)
                const startX = e.clientX - position.x
                const startY = e.clientY - position.y

                const handleMouseMove = (e: MouseEvent) => {
                  handleWindowDrag(appName, e.clientX - startX - position.x, e.clientY - startY - position.y)
                }

                const handleMouseUp = () => {
                  setDraggedWindow(null)
                  document.removeEventListener("mousemove", handleMouseMove)
                  document.removeEventListener("mouseup", handleMouseUp)
                }

                document.addEventListener("mousemove", handleMouseMove)
                document.addEventListener("mouseup", handleMouseUp)
              }}
            >
              <div className="flex items-center space-x-2">
                <div
                  className="w-3 h-3 bg-red-500 rounded-full hover:bg-red-400 cursor-pointer transition-colors"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleAppClose(appName)
                  }}
                ></div>
                <div className="w-3 h-3 bg-yellow-500 rounded-full hover:bg-yellow-400 cursor-pointer transition-colors"></div>
                <div
                  className="w-3 h-3 bg-green-500 rounded-full hover:bg-green-400 cursor-pointer transition-colors"
                  onClick={(e) => {
                    e.stopPropagation()
                    setActiveView(appName)
                  }}
                ></div>
              </div>
              <span className="text-white/80 text-sm font-medium capitalize">{appName}</span>
              <div className="w-16"></div>
            </div>

            <div className="h-full overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
              <div className="p-6 text-center">
                <div className="text-white/60 mb-4">
                  <div className="text-4xl mb-2">📱</div>
                  <h3 className="text-lg font-medium capitalize">{appName}</h3>
                  <p className="text-sm">Running in background mode</p>
                </div>
                <button
                  className="px-6 py-3 bg-blue-500/20 hover:bg-blue-500/30 rounded-lg border border-blue-400/30 text-blue-200 transition-all duration-200 hover:scale-105"
                  onClick={(e) => {
                    e.stopPropagation()
                    setActiveView(appName)
                  }}
                >
                  Focus Window
                </button>
              </div>
            </div>
          </div>
        )
      })}

      {showWallpaperSelector && (
        <WallpaperSelector
          onClose={() => setShowWallpaperSelector(false)}
          onWallpaperChange={handleWallpaperChange}
          currentWallpaper={currentWallpaper}
        />
      )}

      {showWidgets && <WidgetSystem onClose={() => setShowWidgets(false)} />}
    </div>
  )
}
