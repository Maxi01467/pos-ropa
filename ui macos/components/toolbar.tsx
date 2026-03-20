"use client"

import { Search, Grid3X3, List, MoreHorizontal, SlidersHorizontal, Share, Plus } from "lucide-react"
import { useState } from "react"

export function Toolbar() {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [searchValue, setSearchValue] = useState("")
  const [showFilters, setShowFilters] = useState(false)

  return (
    <div className="flex items-center justify-between px-6 py-3 bg-white/5 backdrop-blur-sm border-b border-white/10">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-semibold text-gray-800">Documents</h1>
        <div className="flex items-center gap-1 p-1 rounded-lg bg-white/10 backdrop-blur-sm">
          <button
            onClick={() => setViewMode("grid")}
            className={`p-1.5 rounded-md transition-all duration-200 ${
              viewMode === "grid"
                ? "bg-white/20 text-gray-800 shadow-sm scale-105"
                : "text-gray-600 hover:bg-white/10 hover:text-gray-800"
            }`}
            title="Grid View"
          >
            <Grid3X3 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`p-1.5 rounded-md transition-all duration-200 ${
              viewMode === "list"
                ? "bg-white/20 text-gray-800 shadow-sm scale-105"
                : "text-gray-600 hover:bg-white/10 hover:text-gray-800"
            }`}
            title="List View"
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative group">
          <Search
            className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 transition-colors duration-200 ${
              searchValue ? "text-blue-500" : "text-gray-500 group-hover:text-gray-600"
            }`}
          />
          <input
            type="text"
            placeholder="Search files..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            className="pl-10 pr-4 py-2 w-64 rounded-lg bg-white/20 backdrop-blur-sm border border-white/30 text-sm text-gray-700 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:bg-white/30 focus:border-blue-500/30 transition-all duration-200 hover:bg-white/25"
          />
          {searchValue && (
            <button
              onClick={() => setSearchValue("")}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              ×
            </button>
          )}
        </div>

        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`p-2 rounded-md transition-all duration-200 ${
            showFilters ? "bg-white/20 text-gray-800 scale-105" : "hover:bg-white/10 text-gray-600 hover:text-gray-800"
          }`}
          title="Filters"
        >
          <SlidersHorizontal className="w-4 h-4" />
        </button>

        <button
          className="p-2 rounded-md hover:bg-white/10 transition-all duration-200 hover:scale-105 text-gray-600 hover:text-gray-800"
          title="Share"
        >
          <Share className="w-4 h-4" />
        </button>

        <button
          className="p-2 rounded-md bg-blue-500/20 hover:bg-blue-500/30 transition-all duration-200 hover:scale-105 text-blue-700 hover:text-blue-800"
          title="New File"
        >
          <Plus className="w-4 h-4" />
        </button>

        <button className="p-2 rounded-md hover:bg-white/10 transition-all duration-200 hover:scale-105 text-gray-600 hover:text-gray-800">
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>

      {showFilters && (
        <div className="absolute top-full left-0 right-0 mt-1 mx-6 p-4 rounded-lg bg-white/20 backdrop-blur-md border border-white/30 shadow-lg animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-gray-700">Filter by:</span>
            <select className="px-3 py-1 rounded-md bg-white/20 border border-white/30 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50">
              <option>All Files</option>
              <option>Documents</option>
              <option>Images</option>
              <option>Videos</option>
            </select>
            <select className="px-3 py-1 rounded-md bg-white/20 border border-white/30 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50">
              <option>Any Date</option>
              <option>Today</option>
              <option>This Week</option>
              <option>This Month</option>
            </select>
          </div>
        </div>
      )}
    </div>
  )
}
