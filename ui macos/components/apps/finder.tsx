"use client"

import React from "react"

import { useState } from "react"
import {
  Folder,
  ImageIcon,
  Music,
  Video,
  FileText,
  Archive,
  Search,
  ArrowLeft,
  ArrowRight,
  Home,
  Star,
  Clock,
  Trash2,
  Grid3X3,
  List,
  Download,
  Settings,
} from "lucide-react"

interface FinderProps {
  onClose: () => void
}

interface FileItem {
  id: string
  name: string
  type: "folder" | "file"
  size?: string
  modified: string
  icon: any
  color: string
  path: string
}

const mockFiles: FileItem[] = [
  {
    id: "1",
    name: "Documents",
    type: "folder",
    modified: "Today",
    icon: Folder,
    color: "text-blue-500",
    path: "/Documents",
  },
  {
    id: "2",
    name: "Downloads",
    type: "folder",
    modified: "Yesterday",
    icon: Download,
    color: "text-green-500",
    path: "/Downloads",
  },
  {
    id: "3",
    name: "Pictures",
    type: "folder",
    modified: "2 days ago",
    icon: ImageIcon,
    color: "text-purple-500",
    path: "/Pictures",
  },
  {
    id: "4",
    name: "Music",
    type: "folder",
    modified: "3 days ago",
    icon: Music,
    color: "text-red-500",
    path: "/Music",
  },
  {
    id: "5",
    name: "Videos",
    type: "folder",
    modified: "1 week ago",
    icon: Video,
    color: "text-orange-500",
    path: "/Videos",
  },
  {
    id: "6",
    name: "Project Proposal.pdf",
    type: "file",
    size: "2.4 MB",
    modified: "Today",
    icon: FileText,
    color: "text-red-400",
    path: "/Documents/Project Proposal.pdf",
  },
  {
    id: "7",
    name: "Vacation Photos.zip",
    type: "file",
    size: "45.2 MB",
    modified: "Yesterday",
    icon: Archive,
    color: "text-yellow-500",
    path: "/Downloads/Vacation Photos.zip",
  },
  {
    id: "8",
    name: "Meeting Notes.txt",
    type: "file",
    size: "12 KB",
    modified: "2 days ago",
    icon: FileText,
    color: "text-gray-400",
    path: "/Documents/Meeting Notes.txt",
  },
]

export function Finder({ onClose }: FinderProps) {
  const [currentPath, setCurrentPath] = useState("/")
  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const [viewMode, setViewMode] = useState<"grid" | "list">("list")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedSidebar, setSelectedSidebar] = useState("home")

  const sidebarItems = [
    { id: "home", label: "Home", icon: Home, color: "text-blue-500" },
    { id: "documents", label: "Documents", icon: Folder, color: "text-blue-500" },
    { id: "downloads", label: "Downloads", icon: Download, color: "text-green-500" },
    { id: "pictures", label: "Pictures", icon: ImageIcon, color: "text-purple-500" },
    { id: "music", label: "Music", icon: Music, color: "text-red-500" },
    { id: "videos", label: "Videos", icon: Video, color: "text-orange-500" },
    { id: "recent", label: "Recent", icon: Clock, color: "text-gray-400" },
    { id: "starred", label: "Starred", icon: Star, color: "text-yellow-500" },
    { id: "trash", label: "Trash", icon: Trash2, color: "text-red-400" },
  ]

  const filteredFiles = mockFiles.filter((file) => file.name.toLowerCase().includes(searchQuery.toLowerCase()))

  const handleItemClick = (item: FileItem) => {
    if (item.type === "folder") {
      setCurrentPath(item.path)
    }
    setSelectedItems([item.id])
  }

  const handleItemDoubleClick = (item: FileItem) => {
    if (item.type === "folder") {
      setCurrentPath(item.path)
    }
  }

  const getFileIcon = (item: FileItem) => {
    const IconComponent = item.icon
    return <IconComponent className={`w-5 h-5 ${item.color}`} />
  }

  return (
    <div className="h-full bg-white/5 backdrop-blur-xl border border-white/20 rounded-xl overflow-hidden flex flex-col">
      {/* Header */}
      <div className="bg-white/10 border-b border-white/20 p-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <button onClick={onClose} className="w-3 h-3 bg-red-500 rounded-full hover:bg-red-400 transition-colors" />
            <button className="w-3 h-3 bg-yellow-500 rounded-full hover:bg-yellow-400 transition-colors" />
            <button className="w-3 h-3 bg-green-500 rounded-full hover:bg-green-400 transition-colors" />
          </div>
          <span className="text-white/80 text-sm font-medium">Finder</span>
          <div className="w-16" />
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <button className="p-2 hover:bg-white/10 rounded transition-colors">
              <ArrowLeft className="w-4 h-4 text-white/80" />
            </button>
            <button className="p-2 hover:bg-white/10 rounded transition-colors">
              <ArrowRight className="w-4 h-4 text-white/80" />
            </button>
            <div className="flex items-center space-x-1 ml-4">
              <button
                onClick={() => setViewMode("list")}
                className={`p-2 rounded transition-colors ${viewMode === "list" ? "bg-white/20" : "hover:bg-white/10"}`}
              >
                <List className="w-4 h-4 text-white/80" />
              </button>
              <button
                onClick={() => setViewMode("grid")}
                className={`p-2 rounded transition-colors ${viewMode === "grid" ? "bg-white/20" : "hover:bg-white/10"}`}
              >
                <Grid3X3 className="w-4 h-4 text-white/80" />
              </button>
            </div>
          </div>

          <div className="flex-1 max-w-md mx-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-white/50" />
              <input
                type="text"
                placeholder="Search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-400/50"
              />
            </div>
          </div>

          <button className="p-2 hover:bg-white/10 rounded transition-colors">
            <Settings className="w-4 h-4 text-white/80" />
          </button>
        </div>

        {/* Path Bar */}
        <div className="mt-3 flex items-center space-x-2 text-sm text-white/80">
          <button className="hover:text-white transition-colors">Home</button>
          {currentPath !== "/" && (
            <>
              <span>/</span>
              <button className="hover:text-white transition-colors">{currentPath.split("/").pop()}</button>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div className="w-48 bg-white/5 border-r border-white/20 p-4">
          <div className="space-y-1">
            {sidebarItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setSelectedSidebar(item.id)}
                className={`w-full flex items-center space-x-3 p-2 rounded-lg transition-colors text-left ${
                  selectedSidebar === item.id ? "bg-blue-500/20 text-white" : "hover:bg-white/10 text-white/80"
                }`}
              >
                <item.icon className={`w-4 h-4 ${item.color}`} />
                <span className="text-sm">{item.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-4 overflow-y-auto">
          {viewMode === "list" ? (
            <div className="space-y-1">
              {/* Header */}
              <div className="grid grid-cols-12 gap-4 p-2 text-xs text-white/60 font-medium border-b border-white/10">
                <div className="col-span-6">Name</div>
                <div className="col-span-2">Size</div>
                <div className="col-span-4">Modified</div>
              </div>

              {/* Files */}
              {filteredFiles.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleItemClick(item)}
                  onDoubleClick={() => handleItemDoubleClick(item)}
                  className={`grid grid-cols-12 gap-4 p-2 rounded-lg cursor-pointer transition-colors ${
                    selectedItems.includes(item.id) ? "bg-blue-500/20 text-white" : "hover:bg-white/10 text-white/80"
                  }`}
                >
                  <div className="col-span-6 flex items-center space-x-3">
                    {getFileIcon(item)}
                    <span className="text-sm truncate">{item.name}</span>
                  </div>
                  <div className="col-span-2 text-sm text-white/60">{item.size || "--"}</div>
                  <div className="col-span-4 text-sm text-white/60">{item.modified}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-4">
              {filteredFiles.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleItemClick(item)}
                  onDoubleClick={() => handleItemDoubleClick(item)}
                  className={`p-4 rounded-lg cursor-pointer transition-colors text-center ${
                    selectedItems.includes(item.id) ? "bg-blue-500/20 text-white" : "hover:bg-white/10 text-white/80"
                  }`}
                >
                  <div className="flex justify-center mb-2">
                    <div className="w-12 h-12 flex items-center justify-center">
                      {React.createElement(item.icon, { className: `w-8 h-8 ${item.color}` })}
                    </div>
                  </div>
                  <div className="text-sm truncate">{item.name}</div>
                  <div className="text-xs text-white/60 mt-1">{item.modified}</div>
                </div>
              ))}
            </div>
          )}

          {filteredFiles.length === 0 && (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <Folder className="w-16 h-16 text-white/40 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-white/80 mb-2">No items found</h3>
                <p className="text-white/60">This folder is empty or no items match your search</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
