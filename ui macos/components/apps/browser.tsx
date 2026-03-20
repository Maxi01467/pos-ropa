"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Search, ArrowLeft, ArrowRight, RotateCcw, Star, Plus, X, Globe, Shield, BookmarkIcon } from "lucide-react"

interface BrowserProps {
  onClose: () => void
}

interface Tab {
  id: string
  title: string
  url: string
  favicon?: string
  isLoading?: boolean
}

interface Bookmark {
  id: string
  title: string
  url: string
  favicon?: string
}

const searchResults = [
  {
    title: "macOS Tahoe - Apple's Latest Operating System",
    url: "https://apple.com/macos/tahoe",
    description:
      "Discover the new features and improvements in macOS Tahoe, including the revolutionary Liquid Glass design language.",
  },
  {
    title: "Liquid Glass Design - The Future of UI",
    url: "https://developer.apple.com/design/liquid-glass",
    description: "Learn about Apple's new Liquid Glass design system that creates translucent, reflective interfaces.",
  },
  {
    title: "Web Development Best Practices 2024",
    url: "https://vercel.com/blog/web-dev-2024",
    description: "Modern web development techniques and frameworks for building fast, scalable applications.",
  },
  {
    title: "React 18 Features and Updates",
    url: "https://react.dev/blog/react-18",
    description: "Explore the latest features in React 18 including concurrent rendering and automatic batching.",
  },
  {
    title: "TypeScript Advanced Patterns",
    url: "https://typescript.org/docs/advanced",
    description: "Master advanced TypeScript patterns for better type safety and developer experience.",
  },
]

const mockWebsites = [
  {
    url: "https://google.com",
    title: "Google",
    content: (searchQuery?: string) => (
      <div className="bg-white min-h-screen">
        <div className="flex flex-col items-center justify-center min-h-screen bg-white">
          <div className="text-6xl font-light text-blue-600 mb-8">Google</div>
          <div className="w-full max-w-md">
            <div className="relative">
              <input
                type="text"
                placeholder="Search Google or type a URL"
                defaultValue={searchQuery || ""}
                className="w-full px-4 py-3 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <Search className="absolute right-4 top-3.5 w-5 h-5 text-gray-400" />
            </div>
            <div className="flex justify-center space-x-4 mt-8">
              <button className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded text-sm">Google Search</button>
              <button className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded text-sm">I'm Feeling Lucky</button>
            </div>
          </div>

          {searchQuery && (
            <div className="w-full max-w-2xl mt-12 px-4">
              <div className="text-sm text-gray-600 mb-4">
                About {Math.floor(Math.random() * 1000000).toLocaleString()} results (
                {(Math.random() * 0.5 + 0.1).toFixed(2)} seconds)
              </div>
              <div className="space-y-6">
                {searchResults
                  .filter(
                    (result) =>
                      result.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      result.description.toLowerCase().includes(searchQuery.toLowerCase()),
                  )
                  .slice(0, 5)
                  .map((result, index) => (
                    <div key={index} className="group cursor-pointer">
                      <div className="text-sm text-green-700 mb-1">{result.url}</div>
                      <h3 className="text-xl text-blue-600 hover:underline group-hover:underline mb-1">
                        {result.title}
                      </h3>
                      <p className="text-gray-700 text-sm leading-relaxed">{result.description}</p>
                    </div>
                  ))}

                {searchResults.filter(
                  (result) =>
                    result.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    result.description.toLowerCase().includes(searchQuery.toLowerCase()),
                ).length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-gray-600">No results found for "{searchQuery}"</p>
                    <p className="text-sm text-gray-500 mt-2">Try different keywords or check your spelling</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    ),
  },
  {
    url: "https://github.com",
    title: "GitHub",
    content: () => (
      <div className="bg-gray-900 min-h-screen text-white">
        <div className="bg-gray-800 p-4 border-b border-gray-700">
          <div className="flex items-center justify-between max-w-6xl mx-auto">
            <div className="flex items-center space-x-4">
              <div className="text-2xl font-bold">GitHub</div>
              <nav className="flex space-x-6">
                <a href="#" className="hover:text-gray-300">
                  Product
                </a>
                <a href="#" className="hover:text-gray-300">
                  Solutions
                </a>
                <a href="#" className="hover:text-gray-300">
                  Open Source
                </a>
                <a href="#" className="hover:text-gray-300">
                  Pricing
                </a>
              </nav>
            </div>
            <div className="flex items-center space-x-4">
              <button className="px-4 py-2 border border-gray-600 rounded hover:bg-gray-700">Sign in</button>
              <button className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded">Sign up</button>
            </div>
          </div>
        </div>
        <div className="max-w-6xl mx-auto p-8">
          <div className="text-center py-16">
            <h1 className="text-5xl font-bold mb-6">Let's build from here</h1>
            <p className="text-xl text-gray-400 mb-8">The world's leading AI-powered developer platform.</p>
            <div className="flex justify-center space-x-4">
              <button className="px-6 py-3 bg-green-600 hover:bg-green-700 rounded-lg font-semibold">
                Start a free enterprise trial
              </button>
              <button className="px-6 py-3 border border-gray-600 hover:bg-gray-800 rounded-lg">
                Sign up for GitHub
              </button>
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    url: "https://vercel.com",
    title: "Vercel",
    content: () => (
      <div className="bg-black min-h-screen text-white">
        <div className="border-b border-gray-800 p-4">
          <div className="flex items-center justify-between max-w-6xl mx-auto">
            <div className="flex items-center space-x-8">
              <div className="text-2xl font-bold">▲ Vercel</div>
              <nav className="flex space-x-6">
                <a href="#" className="hover:text-gray-300">
                  Products
                </a>
                <a href="#" className="hover:text-gray-300">
                  Solutions
                </a>
                <a href="#" className="hover:text-gray-300">
                  Resources
                </a>
                <a href="#" className="hover:text-gray-300">
                  Pricing
                </a>
              </nav>
            </div>
            <div className="flex items-center space-x-4">
              <button className="px-4 py-2 hover:bg-gray-900 rounded">Login</button>
              <button className="px-4 py-2 bg-white text-black hover:bg-gray-200 rounded">Sign Up</button>
            </div>
          </div>
        </div>
        <div className="max-w-6xl mx-auto p-8">
          <div className="text-center py-20">
            <h1 className="text-6xl font-bold mb-6">Develop. Preview. Ship.</h1>
            <p className="text-xl text-gray-400 mb-8 max-w-2xl mx-auto">
              Vercel is the platform for frontend developers, providing the speed and reliability innovators need to
              create at the moment of inspiration.
            </p>
            <div className="flex justify-center space-x-4">
              <button className="px-6 py-3 bg-white text-black hover:bg-gray-200 rounded font-semibold">
                Start Deploying
              </button>
              <button className="px-6 py-3 border border-gray-600 hover:bg-gray-900 rounded">Get a Demo</button>
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    url: "https://apple.com",
    title: "Apple",
    content: () => (
      <div className="bg-white min-h-screen">
        <div className="bg-gray-900 text-white p-4">
          <div className="flex items-center justify-center max-w-6xl mx-auto">
            <nav className="flex space-x-8">
              <a href="#" className="hover:text-gray-300">
                🍎
              </a>
              <a href="#" className="hover:text-gray-300">
                Store
              </a>
              <a href="#" className="hover:text-gray-300">
                Mac
              </a>
              <a href="#" className="hover:text-gray-300">
                iPad
              </a>
              <a href="#" className="hover:text-gray-300">
                iPhone
              </a>
              <a href="#" className="hover:text-gray-300">
                Watch
              </a>
              <a href="#" className="hover:text-gray-300">
                AirPods
              </a>
              <a href="#" className="hover:text-gray-300">
                TV & Home
              </a>
              <a href="#" className="hover:text-gray-300">
                Support
              </a>
            </nav>
          </div>
        </div>
        <div className="text-center py-16 bg-gradient-to-b from-blue-50 to-white">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">iPhone 15 Pro</h1>
          <p className="text-xl text-gray-600 mb-8">Titanium. So strong. So light. So Pro.</p>
          <div className="flex justify-center space-x-4">
            <button className="px-6 py-3 bg-blue-600 text-white hover:bg-blue-700 rounded-full">Learn more</button>
            <button className="px-6 py-3 border border-blue-600 text-blue-600 hover:bg-blue-50 rounded-full">
              Buy
            </button>
          </div>
        </div>
      </div>
    ),
  },
  {
    url: "https://youtube.com",
    title: "YouTube",
    content: () => (
      <div className="bg-white min-h-screen">
        <div className="bg-white border-b p-4">
          <div className="flex items-center justify-between max-w-6xl mx-auto">
            <div className="flex items-center space-x-4">
              <div className="text-2xl font-bold text-red-600">YouTube</div>
            </div>
            <div className="flex-1 max-w-2xl mx-8">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search"
                  className="w-full pl-10 pr-4 py-2 bg-white/10 border border-white/20 rounded-l-full focus:outline-none focus:ring-2 focus:ring-blue-400/50"
                />
                <button className="px-6 py-2 bg-gray-100 border border-l-0 border-gray-300 rounded-r-full hover:bg-gray-200">
                  <Search className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <button className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50">Sign in</button>
            </div>
          </div>
        </div>
        <div className="max-w-6xl mx-auto p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow">
                <div className="w-full h-48 bg-gray-200 rounded-t-lg flex items-center justify-center">
                  <div className="text-4xl">▶️</div>
                </div>
                <div className="p-4">
                  <h3 className="font-semibold mb-2">Sample Video Title {i}</h3>
                  <p className="text-gray-600 text-sm">Channel Name • 1M views • 2 days ago</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
  },
]

export function Browser({ onClose }: BrowserProps) {
  const [tabs, setTabs] = useState<Tab[]>([{ id: "1", title: "New Tab", url: "about:blank" }])
  const [activeTabId, setActiveTabId] = useState("1")
  const [addressBarValue, setAddressBarValue] = useState("")
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([
    { id: "1", title: "Google", url: "https://google.com" },
    { id: "2", title: "GitHub", url: "https://github.com" },
    { id: "3", title: "Vercel", url: "https://vercel.com" },
    { id: "4", title: "Apple", url: "https://apple.com" },
  ])
  const [showBookmarks, setShowBookmarks] = useState(false)
  const [history, setHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [draggedTab, setDraggedTab] = useState<string | null>(null)
  const [dragOverTab, setDragOverTab] = useState<string | null>(null)
  const [currentSearchQuery, setCurrentSearchQuery] = useState<string>("")

  const activeTab = tabs.find((tab) => tab.id === activeTabId)

  const isSearchQuery = (input: string): boolean => {
    // If it contains spaces, it's likely a search query
    if (input.includes(" ")) return true

    // If it doesn't contain a dot and doesn't start with http, it's likely a search
    if (!input.includes(".") && !input.startsWith("http")) return true

    // If it's a single word without common TLDs, treat as search
    const commonTLDs = [".com", ".org", ".net", ".edu", ".gov", ".io", ".co", ".app"]
    const hasCommonTLD = commonTLDs.some((tld) => input.toLowerCase().includes(tld))

    return !hasCommonTLD
  }

  const createNewTab = () => {
    const newTab: Tab = {
      id: Date.now().toString(),
      title: "New Tab",
      url: "about:blank",
    }
    setTabs((prev) => [...prev, newTab])
    setActiveTabId(newTab.id)
    setAddressBarValue("")
    setCurrentSearchQuery("")
  }

  const closeTab = (tabId: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation()
    }

    if (tabs.length === 1) {
      onClose()
      return
    }

    const tabIndex = tabs.findIndex((tab) => tab.id === tabId)
    const newTabs = tabs.filter((tab) => tab.id !== tabId)
    setTabs(newTabs)

    if (activeTabId === tabId) {
      const newActiveIndex = Math.min(tabIndex, newTabs.length - 1)
      setActiveTabId(newTabs[newActiveIndex].id)
      setAddressBarValue(newTabs[newActiveIndex].url)
    }
  }

  const handleTabDragStart = (e: React.DragEvent, tabId: string) => {
    setDraggedTab(tabId)
    e.dataTransfer.effectAllowed = "move"
  }

  const handleTabDragOver = (e: React.DragEvent, tabId: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    setDragOverTab(tabId)
  }

  const handleTabDragLeave = () => {
    setDragOverTab(null)
  }

  const handleTabDrop = (e: React.DragEvent, targetTabId: string) => {
    e.preventDefault()

    if (!draggedTab || draggedTab === targetTabId) {
      setDraggedTab(null)
      setDragOverTab(null)
      return
    }

    const draggedIndex = tabs.findIndex((tab) => tab.id === draggedTab)
    const targetIndex = tabs.findIndex((tab) => tab.id === targetTabId)

    const newTabs = [...tabs]
    const [draggedTabObj] = newTabs.splice(draggedIndex, 1)
    newTabs.splice(targetIndex, 0, draggedTabObj)

    setTabs(newTabs)
    setDraggedTab(null)
    setDragOverTab(null)
  }

  const handleTabDragEnd = () => {
    setDraggedTab(null)
    setDragOverTab(null)
  }

  const navigateToUrl = (input: string) => {
    let url = input
    let searchQuery = ""

    // Determine if this is a search query or URL
    if (isSearchQuery(input)) {
      // It's a search query - redirect to Google with search
      url = "https://google.com"
      searchQuery = input
      setCurrentSearchQuery(input)
    } else {
      // It's a URL
      if (!input.startsWith("http://") && !input.startsWith("https://") && !input.startsWith("about:")) {
        url = "https://" + input
      }
      setCurrentSearchQuery("")
    }

    const updatedTabs = tabs.map((tab) =>
      tab.id === activeTabId
        ? {
            ...tab,
            url,
            title: searchQuery
              ? `Search: ${searchQuery}`
              : url.includes("://")
                ? url.split("://")[1].split("/")[0]
                : url,
            isLoading: true,
          }
        : tab,
    )
    setTabs(updatedTabs)

    // Add to history
    setHistory((prev) => [...prev, url])
    setHistoryIndex((prev) => prev + 1)

    // Simulate loading
    setTimeout(() => {
      const mockSite = mockWebsites.find((site) => url.includes(site.url.replace("https://", "")))
      const finalTabs = tabs.map((tab) =>
        tab.id === activeTabId
          ? {
              ...tab,
              title: searchQuery
                ? `Search: ${searchQuery}`
                : mockSite?.title || url.split("://")[1]?.split("/")[0] || url,
              isLoading: false,
            }
          : tab,
      )
      setTabs(finalTabs)
    }, 1000)
  }

  const handleAddressBarSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (addressBarValue.trim()) {
      navigateToUrl(addressBarValue.trim())
    }
  }

  const goBack = () => {
    if (historyIndex > 0) {
      setHistoryIndex((prev) => prev - 1)
      const previousUrl = history[historyIndex - 1]
      setAddressBarValue(previousUrl)
      navigateToUrl(previousUrl)
    }
  }

  const goForward = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex((prev) => prev + 1)
      const nextUrl = history[historyIndex + 1]
      setAddressBarValue(nextUrl)
      navigateToUrl(nextUrl)
    }
  }

  const refresh = () => {
    if (activeTab?.url && activeTab.url !== "about:blank") {
      navigateToUrl(activeTab.url)
    }
  }

  const addBookmark = () => {
    if (activeTab && activeTab.url !== "about:blank") {
      const newBookmark: Bookmark = {
        id: Date.now().toString(),
        title: activeTab.title,
        url: activeTab.url,
      }
      setBookmarks((prev) => [...prev, newBookmark])
    }
  }

  const renderWebContent = () => {
    if (!activeTab || activeTab.url === "about:blank") {
      return (
        <div className="flex-1 bg-white flex flex-col items-center justify-center">
          <div className="text-center">
            <Globe className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-2xl font-semibold text-gray-700 mb-2">Welcome to Safari</h2>
            <p className="text-gray-500 mb-8">Start browsing by entering a URL or search term</p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl">
              {mockWebsites.slice(0, 4).map((site) => (
                <button
                  key={site.url}
                  onClick={() => {
                    setAddressBarValue(site.url)
                    navigateToUrl(site.url)
                  }}
                  className="p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <div className="w-12 h-12 bg-blue-500 rounded-lg mx-auto mb-2 flex items-center justify-center text-white font-bold">
                    {site.title[0]}
                  </div>
                  <div className="text-sm font-medium">{site.title}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )
    }

    if (activeTab.isLoading) {
      return (
        <div className="flex-1 bg-white flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      )
    }

    const mockSite = mockWebsites.find((site) => activeTab.url.includes(site.url.replace("https://", "")))

    if (mockSite) {
      return <div className="flex-1 overflow-y-auto">{mockSite.content(currentSearchQuery)}</div>
    }

    return (
      <div className="flex-1 bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🌐</div>
          <h2 className="text-xl font-semibold text-gray-700 mb-2">Page not found</h2>
          <p className="text-gray-500">This is a demo browser with limited websites</p>
        </div>
      </div>
    )
  }

  useEffect(() => {
    if (activeTab) {
      setAddressBarValue(activeTab.url === "about:blank" ? "" : activeTab.url)
    }
  }, [activeTabId, activeTab])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) {
        switch (e.key) {
          case "t":
            e.preventDefault()
            createNewTab()
            break
          case "w":
            e.preventDefault()
            if (tabs.length > 1) {
              closeTab(activeTabId)
            }
            break
          case "r":
            e.preventDefault()
            refresh()
            break
          case "[":
            e.preventDefault()
            goBack()
            break
          case "]":
            e.preventDefault()
            goForward()
            break
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [activeTabId, tabs.length])

  return (
    <div className="h-full bg-white/5 backdrop-blur-xl border border-white/20 rounded-xl overflow-hidden flex flex-col">
      {/* Browser Header */}
      <div className="bg-white/10 border-b border-white/20 p-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <button onClick={onClose} className="w-3 h-3 bg-red-500 rounded-full hover:bg-red-400 transition-colors" />
            <button className="w-3 h-3 bg-yellow-500 rounded-full hover:bg-yellow-400 transition-colors" />
            <button className="w-3 h-3 bg-green-500 rounded-full hover:bg-green-400 transition-colors" />
          </div>
          <span className="text-white/80 text-sm font-medium">Safari</span>
          <div className="w-16" />
        </div>

        {/* Tab Bar */}
        <div className="flex items-center space-x-1 mb-3 overflow-x-auto">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              draggable
              onDragStart={(e) => handleTabDragStart(e, tab.id)}
              onDragOver={(e) => handleTabDragOver(e, tab.id)}
              onDragLeave={handleTabDragLeave}
              onDrop={(e) => handleTabDrop(e, tab.id)}
              onDragEnd={handleTabDragEnd}
              className={`flex items-center space-x-2 px-3 py-2 rounded-t-lg cursor-pointer transition-all duration-200 min-w-0 max-w-48 group ${
                tab.id === activeTabId
                  ? "bg-white/20 text-white shadow-lg"
                  : "bg-white/5 text-white/60 hover:bg-white/10"
              } ${dragOverTab === tab.id && draggedTab !== tab.id ? "border-l-2 border-blue-400" : ""} ${
                draggedTab === tab.id ? "opacity-50 scale-95" : ""
              }`}
              onClick={() => setActiveTabId(tab.id)}
            >
              {tab.isLoading && (
                <div className="w-3 h-3 border border-white/40 border-t-transparent rounded-full animate-spin" />
              )}
              <span className="text-xs flex-1 truncate min-w-0">{tab.isLoading ? "Loading..." : tab.title}</span>
              <button
                onClick={(e) => closeTab(tab.id, e)}
                className="w-4 h-4 hover:bg-white/20 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          <button
            onClick={createNewTab}
            className="w-8 h-8 bg-white/10 hover:bg-white/20 rounded-lg flex items-center justify-center transition-colors flex-shrink-0"
            title="New Tab (⌘T)"
          >
            <Plus className="w-4 h-4 text-white/80" />
          </button>
        </div>

        {/* Navigation Bar */}
        <div className="flex items-center space-x-2">
          <button
            onClick={goBack}
            disabled={historyIndex <= 0}
            className="p-2 hover:bg-white/10 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0"
            title="Back (⌘[)"
          >
            <ArrowLeft className="w-4 h-4 text-white/80" />
          </button>
          <button
            onClick={goForward}
            disabled={historyIndex >= history.length - 1}
            className="p-2 hover:bg-white/10 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0"
            title="Forward (⌘])"
          >
            <ArrowRight className="w-4 h-4 text-white/80" />
          </button>
          <button
            onClick={refresh}
            className="p-2 hover:bg-white/10 rounded transition-colors flex-shrink-0"
            title="Refresh (⌘R)"
          >
            <RotateCcw className="w-4 h-4 text-white/80" />
          </button>

          <form onSubmit={handleAddressBarSubmit} className="flex-1">
            <div className="relative">
              <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                <Shield className="w-4 h-4 text-green-400" />
              </div>
              <input
                type="text"
                value={addressBarValue}
                onChange={(e) => setAddressBarValue(e.target.value)}
                placeholder="Search or enter website name"
                className="w-full pl-10 pr-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:bg-white/15"
              />
            </div>
          </form>

          <button
            onClick={addBookmark}
            className="p-2 hover:bg-white/10 rounded transition-colors flex-shrink-0"
            title="Add Bookmark"
          >
            <Star className="w-4 h-4 text-white/80" />
          </button>
          <button
            onClick={() => setShowBookmarks(!showBookmarks)}
            className="p-2 hover:bg-white/10 rounded transition-colors flex-shrink-0"
            title="Show Bookmarks"
          >
            <BookmarkIcon className="w-4 h-4 text-white/80" />
          </button>
        </div>

        {/* Bookmarks Bar */}
        {showBookmarks && (
          <div className="flex items-center space-x-2 mt-2 pt-2 border-t border-white/10">
            {bookmarks.map((bookmark) => (
              <button
                key={bookmark.id}
                onClick={() => {
                  setAddressBarValue(bookmark.url)
                  navigateToUrl(bookmark.url)
                }}
                className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded text-xs text-white/80 transition-colors"
              >
                {bookmark.title}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Web Content */}
      {renderWebContent()}
    </div>
  )
}
