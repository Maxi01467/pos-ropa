"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Search, Star, X, Download, Check } from "lucide-react"

interface App {
  id: string
  name: string
  developer: string
  category: string
  rating: number
  price: string
  description: string
  icon: string
  screenshots: string[]
  size: string
  version: string
  installed: boolean
}

const apps: App[] = [
  {
    id: "excel",
    name: "Microsoft Excel",
    developer: "Microsoft Corporation",
    category: "Productivity",
    rating: 4.5,
    price: "$6.99/month",
    description: "Create, view, edit, and share spreadsheets using the Excel spreadsheet app.",
    icon: "📊",
    screenshots: ["/excel-spreadsheet.png"],
    size: "1.2 GB",
    version: "16.77",
    installed: false,
  },
  {
    id: "powerpoint",
    name: "Microsoft PowerPoint",
    developer: "Microsoft Corporation",
    category: "Productivity",
    rating: 4.4,
    price: "$6.99/month",
    description: "Create, edit, view, present, or share presentations quickly and easily.",
    icon: "📽️",
    screenshots: ["/powerpoint-presentation.png"],
    size: "1.1 GB",
    version: "16.77",
    installed: false,
  },
  {
    id: "word",
    name: "Microsoft Word",
    developer: "Microsoft Corporation",
    category: "Productivity",
    rating: 4.6,
    price: "$6.99/month",
    description: "Write and edit documents with rich formatting tools and collaboration features.",
    icon: "📝",
    screenshots: ["/word-document.png"],
    size: "1.3 GB",
    version: "16.77",
    installed: false,
  },
  {
    id: "photoshop",
    name: "Adobe Photoshop",
    developer: "Adobe Inc.",
    category: "Graphics & Design",
    rating: 4.7,
    price: "$20.99/month",
    description: "Professional image editing and graphic design software.",
    icon: "🎨",
    screenshots: ["/photoshop-interface.png"],
    size: "2.1 GB",
    version: "24.7",
    installed: false,
  },
  {
    id: "illustrator",
    name: "Adobe Illustrator",
    developer: "Adobe Inc.",
    category: "Graphics & Design",
    rating: 4.5,
    price: "$20.99/month",
    description: "Create vector graphics, logos, and illustrations.",
    icon: "✏️",
    screenshots: ["/abstract-vector-design.png"],
    size: "1.8 GB",
    version: "27.9",
    installed: false,
  },
  {
    id: "premiere",
    name: "Adobe Premiere Pro",
    developer: "Adobe Inc.",
    category: "Video",
    rating: 4.6,
    price: "$20.99/month",
    description: "Professional video editing software for filmmakers and content creators.",
    icon: "🎬",
    screenshots: ["/premiere-pro-editing.png"],
    size: "3.2 GB",
    version: "23.6",
    installed: false,
  },
  {
    id: "vscode",
    name: "Visual Studio Code",
    developer: "Microsoft Corporation",
    category: "Developer Tools",
    rating: 4.8,
    price: "Free",
    description: "Lightweight but powerful source code editor with IntelliSense and debugging.",
    icon: "💻",
    screenshots: ["/vscode-code-editor.png"],
    size: "85 MB",
    version: "1.84",
    installed: false,
  },
  {
    id: "terminal",
    name: "Terminal Pro",
    developer: "Apple Inc.",
    category: "Developer Tools",
    rating: 4.3,
    price: "Free",
    description: "Advanced terminal emulator with modern features and customization.",
    icon: "⌨️",
    screenshots: ["/terminal-command-line.png"],
    size: "45 MB",
    version: "2.13",
    installed: false,
  },
  {
    id: "github",
    name: "GitHub Desktop",
    developer: "GitHub, Inc.",
    category: "Developer Tools",
    rating: 4.4,
    price: "Free",
    description: "Simplify your Git workflow with a beautiful desktop application.",
    icon: "🐙",
    screenshots: ["/github-desktop-interface.png"],
    size: "120 MB",
    version: "3.3.4",
    installed: false,
  },
  {
    id: "netflix",
    name: "Netflix",
    developer: "Netflix, Inc.",
    category: "Entertainment",
    rating: 4.2,
    price: "Free",
    description: "Watch TV shows and movies recommended just for you.",
    icon: "🎭",
    screenshots: ["/netflix-streaming-interface.png"],
    size: "180 MB",
    version: "15.42",
    installed: false,
  },
  {
    id: "spotify",
    name: "Spotify",
    developer: "Spotify AB",
    category: "Music",
    rating: 4.5,
    price: "Free",
    description: "Music for everyone. Millions of songs, podcasts and playlists.",
    icon: "🎵",
    screenshots: ["/generic-music-player.png"],
    size: "140 MB",
    version: "1.2.25",
    installed: false,
  },
  {
    id: "chess",
    name: "Chess Master",
    developer: "Game Studio",
    category: "Games",
    rating: 4.7,
    price: "$4.99",
    description: "Play chess against AI or friends with beautiful 3D graphics.",
    icon: "♟️",
    screenshots: ["/3d-chess-game.png"],
    size: "250 MB",
    version: "3.1",
    installed: false,
  },
  {
    id: "figma",
    name: "Figma",
    developer: "Figma, Inc.",
    category: "Graphics & Design",
    rating: 4.8,
    price: "Free",
    description: "Collaborative interface design tool for teams.",
    icon: "🎯",
    screenshots: ["/figma-design-interface.png"],
    size: "95 MB",
    version: "116.15",
    installed: false,
  },
  {
    id: "slack",
    name: "Slack",
    developer: "Slack Technologies",
    category: "Business",
    rating: 4.3,
    price: "Free",
    description: "Team communication and collaboration platform.",
    icon: "💬",
    screenshots: ["/placeholder-8vn5t.png"],
    size: "170 MB",
    version: "4.34",
    installed: false,
  },
  {
    id: "zoom",
    name: "Zoom",
    developer: "Zoom Video Communications",
    category: "Business",
    rating: 4.1,
    price: "Free",
    description: "Video conferencing and online meetings platform.",
    icon: "📹",
    screenshots: ["/placeholder.svg?height=300&width=400"],
    size: "85 MB",
    version: "5.16",
    installed: false,
  },
  {
    id: "notion",
    name: "Notion",
    developer: "Notion Labs, Inc.",
    category: "Productivity",
    rating: 4.6,
    price: "Free",
    description: "All-in-one workspace for notes, tasks, wikis, and databases.",
    icon: "📋",
    screenshots: ["/placeholder.svg?height=300&width=400"],
    size: "120 MB",
    version: "2.0.34",
    installed: false,
  },
  {
    id: "discord",
    name: "Discord",
    developer: "Discord Inc.",
    category: "Social Networking",
    rating: 4.4,
    price: "Free",
    description: "Voice, video and text communication for gamers and communities.",
    icon: "🎮",
    screenshots: ["/placeholder.svg?height=300&width=400"],
    size: "95 MB",
    version: "0.0.280",
    installed: false,
  },
  {
    id: "blender",
    name: "Blender",
    developer: "Blender Foundation",
    category: "Graphics & Design",
    rating: 4.7,
    price: "Free",
    description: "Free and open source 3D creation suite.",
    icon: "🎲",
    screenshots: ["/placeholder.svg?height=300&width=400"],
    size: "280 MB",
    version: "4.0",
    installed: false,
  },
  {
    id: "xcode",
    name: "Xcode",
    developer: "Apple Inc.",
    category: "Developer Tools",
    rating: 4.2,
    price: "Free",
    description: "Complete developer toolset for creating apps for Mac, iPhone, and iPad.",
    icon: "🔨",
    screenshots: ["/placeholder.svg?height=300&width=400"],
    size: "11.2 GB",
    version: "15.0",
    installed: false,
  },
  {
    id: "safari",
    name: "Safari",
    developer: "Apple Inc.",
    category: "Web Browsers",
    rating: 4.5,
    price: "Free",
    description: "Fast, secure web browser with privacy features built-in.",
    icon: "🧭",
    screenshots: ["/placeholder.svg?height=300&width=400"],
    size: "75 MB",
    version: "17.0",
    installed: false,
  },
]

interface AppStoreProps {
  onClose: () => void
  onAppInstall: (appId: string) => void
}

export function AppStore({ onClose, onAppInstall }: AppStoreProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("All")
  const [selectedApp, setSelectedApp] = useState<App | null>(null)
  const [installedApps, setInstalledApps] = useState<string[]>([])
  const [installingApps, setInstallingApps] = useState<string[]>([])

  const categories = [
    "All",
    "Productivity",
    "Graphics & Design",
    "Developer Tools",
    "Entertainment",
    "Music",
    "Games",
    "Business",
    "Social Networking",
    "Video",
    "Web Browsers",
  ]

  const filteredApps = apps.filter((app) => {
    const matchesSearch =
      app.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.developer.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = selectedCategory === "All" || app.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  const handleInstall = (app: App) => {
    setInstallingApps((prev) => [...prev, app.id])

    // Simulate installation process
    setTimeout(() => {
      setInstalledApps((prev) => [...prev, app.id])
      setInstallingApps((prev) => prev.filter((id) => id !== app.id))
      onAppInstall(app.id)
      setSelectedApp(null)
    }, 2000)
  }

  const isInstalled = (appId: string) => installedApps.includes(appId)
  const isInstalling = (appId: string) => installingApps.includes(appId)

  return (
    <div className="h-full bg-white/20 backdrop-blur-xl border border-white/30 rounded-xl overflow-hidden glass-morphism">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/20 bg-white/5">
        <h1 className="text-2xl font-bold text-gray-800">App Store</h1>
        <Button variant="ghost" size="sm" onClick={onClose} className="hover:bg-white/20 interactive-button focus-ring">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {selectedApp ? (
        // App Detail View
        <div className="h-full overflow-y-auto scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent p-6">
          <Button
            variant="ghost"
            onClick={() => setSelectedApp(null)}
            className="mb-4 hover:bg-white/20 interactive-button focus-ring"
          >
            ← Back to Store
          </Button>

          <div className="flex gap-6 mb-6">
            <div className="text-6xl float-animation">{selectedApp.icon}</div>
            <div className="flex-1">
              <h2 className="text-3xl font-bold text-gray-800 mb-2">{selectedApp.name}</h2>
              <p className="text-gray-600 mb-2">{selectedApp.developer}</p>
              <div className="flex items-center gap-4 mb-4">
                <div className="flex items-center gap-1">
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  <span className="font-medium">{selectedApp.rating}</span>
                </div>
                <Badge variant="secondary" className="glass-morphism">
                  {selectedApp.category}
                </Badge>
                <span className="text-sm text-gray-600">{selectedApp.size}</span>
              </div>

              <div className="flex items-center gap-4 mb-6">
                <div className="text-2xl font-bold text-blue-600">{selectedApp.price}</div>
                <Button
                  onClick={() => handleInstall(selectedApp)}
                  disabled={isInstalled(selectedApp.id) || isInstalling(selectedApp.id)}
                  className={`px-8 interactive-button focus-ring transition-all duration-300 ${
                    isInstalled(selectedApp.id)
                      ? "bg-green-500 hover:bg-green-600 text-white"
                      : isInstalling(selectedApp.id)
                        ? "bg-blue-400 text-white cursor-not-allowed loading-shimmer"
                        : "bg-blue-500 hover:bg-blue-600 text-white pulse-glow"
                  }`}
                >
                  {isInstalled(selectedApp.id) ? (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Installed
                    </>
                  ) : isInstalling(selectedApp.id) ? (
                    <>
                      <Download className="h-4 w-4 mr-2 animate-bounce" />
                      Installing...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      Install
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

          <div className="mb-6 glass-morphism p-4 rounded-lg">
            <h3 className="text-xl font-semibold mb-3">Description</h3>
            <p className="text-gray-700 leading-relaxed">{selectedApp.description}</p>
          </div>

          <div className="glass-morphism p-4 rounded-lg">
            <h3 className="text-xl font-semibold mb-3">Screenshots</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 overflow-y-auto max-h-96 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
              {selectedApp.screenshots.map((screenshot, index) => (
                <img
                  key={index}
                  src={screenshot || "/placeholder.svg"}
                  alt={`${selectedApp.name} screenshot ${index + 1}`}
                  className="rounded-lg border border-white/30 w-full h-48 object-cover hover:scale-105 transition-transform duration-300 cursor-pointer selectable"
                />
              ))}
            </div>
          </div>
        </div>
      ) : (
        // Main Store View
        <div className="h-full flex flex-col">
          {/* Search and Filters */}
          <div className="p-4 border-b border-white/20 bg-white/5">
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search apps..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-white/30 border-white/30 placeholder:text-gray-500 focus-ring interactive-button"
              />
            </div>

            <div className="flex gap-2 overflow-x-auto scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent pb-2">
              {categories.map((category) => (
                <Button
                  key={category}
                  variant={selectedCategory === category ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setSelectedCategory(category)}
                  className={`whitespace-nowrap interactive-button focus-ring transition-all duration-200 ${
                    selectedCategory === category ? "bg-blue-500 text-white pulse-glow" : "hover:bg-white/20 selectable"
                  }`}
                >
                  {category}
                </Button>
              ))}
            </div>
          </div>

          {/* Apps Grid */}
          <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredApps.map((app) => (
                <div
                  key={app.id}
                  className="glass-morphism rounded-xl p-4 cursor-pointer selectable interactive-button focus-ring transition-all duration-300"
                  onClick={() => setSelectedApp(app)}
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && setSelectedApp(app)}
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div className="text-3xl float-animation">{app.icon}</div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-800 truncate">{app.name}</h3>
                      <p className="text-sm text-gray-600 truncate">{app.developer}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1">
                      <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                      <span className="text-sm font-medium">{app.rating}</span>
                    </div>
                    <Badge variant="secondary" className="text-xs glass-morphism">
                      {app.category}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="font-bold text-blue-600">{app.price}</span>
                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleInstall(app)
                      }}
                      disabled={isInstalled(app.id) || isInstalling(app.id)}
                      className={`text-xs px-3 interactive-button focus-ring transition-all duration-300 ${
                        isInstalled(app.id)
                          ? "bg-green-500 hover:bg-green-600 text-white"
                          : isInstalling(app.id)
                            ? "bg-blue-400 text-white cursor-not-allowed loading-shimmer"
                            : "bg-blue-500 hover:bg-blue-600 text-white"
                      }`}
                    >
                      {isInstalled(app.id) ? (
                        <>
                          <Check className="h-3 w-3 mr-1" />
                          Installed
                        </>
                      ) : isInstalling(app.id) ? (
                        <>
                          <Download className="h-3 w-3 mr-1 animate-spin" />
                          Installing
                        </>
                      ) : (
                        <>
                          <Download className="h-3 w-3 mr-1" />
                          Install
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
