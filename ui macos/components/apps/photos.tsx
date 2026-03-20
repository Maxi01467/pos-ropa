"use client"

import { useState } from "react"
import { X, Grid3X3, List, Search, Heart, Share, Download, ChevronLeft, ChevronRight } from "lucide-react"

interface Photo {
  id: string
  title: string
  date: string
  location: string
  url: string
  thumbnail: string
  category: "nature" | "city" | "portrait" | "abstract"
  liked: boolean
}

interface PhotosProps {
  onClose: () => void
}

export function Photos({ onClose }: PhotosProps) {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [likedPhotos, setLikedPhotos] = useState<string[]>(["1", "3", "5"])

  const photos: Photo[] = [
    {
      id: "1",
      title: "Mountain Sunrise",
      date: "2024-01-15",
      location: "Lake Tahoe, CA",
      url: "/mountain-sunrise-landscape.png",
      thumbnail: "/mountain-sunrise-landscape.png",
      category: "nature",
      liked: true,
    },
    {
      id: "2",
      title: "City Lights",
      date: "2024-01-10",
      location: "San Francisco, CA",
      url: "/city-lights-night-skyline.png",
      thumbnail: "/city-lights-night-skyline.png",
      category: "city",
      liked: false,
    },
    {
      id: "3",
      title: "Abstract Glass",
      date: "2024-01-08",
      location: "Studio",
      url: "/abstract-glass-art-colorful.png",
      thumbnail: "/abstract-glass-art-colorful.png",
      category: "abstract",
      liked: true,
    },
    {
      id: "4",
      title: "Forest Path",
      date: "2024-01-05",
      location: "Yosemite, CA",
      url: "/forest-path-sunlight-trees.png",
      thumbnail: "/forest-path-sunlight-trees.png",
      category: "nature",
      liked: false,
    },
    {
      id: "5",
      title: "Urban Architecture",
      date: "2024-01-03",
      location: "Los Angeles, CA",
      url: "/modern-architecture-building.png",
      thumbnail: "/modern-architecture-building.png",
      category: "city",
      liked: true,
    },
    {
      id: "6",
      title: "Ocean Waves",
      date: "2024-01-01",
      location: "Monterey Bay, CA",
      url: "/ocean-waves-sunset-beach.png",
      thumbnail: "/ocean-waves-sunset-beach.png",
      category: "nature",
      liked: false,
    },
  ]

  const categories = [
    { key: "all", label: "All Photos", count: photos.length },
    { key: "nature", label: "Nature", count: photos.filter((p) => p.category === "nature").length },
    { key: "city", label: "City", count: photos.filter((p) => p.category === "city").length },
    { key: "abstract", label: "Abstract", count: photos.filter((p) => p.category === "abstract").length },
    { key: "liked", label: "Favorites", count: likedPhotos.length },
  ]

  const filteredPhotos = photos.filter((photo) => {
    const matchesSearch =
      photo.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      photo.location.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory =
      selectedCategory === "all" ||
      photo.category === selectedCategory ||
      (selectedCategory === "liked" && likedPhotos.includes(photo.id))
    return matchesSearch && matchesCategory
  })

  const toggleLike = (photoId: string) => {
    setLikedPhotos((prev) => (prev.includes(photoId) ? prev.filter((id) => id !== photoId) : [...prev, photoId]))
  }

  const openPhoto = (photo: Photo) => {
    setSelectedPhoto(photo)
  }

  const closePhoto = () => {
    setSelectedPhoto(null)
  }

  const navigatePhoto = (direction: "prev" | "next") => {
    if (!selectedPhoto) return

    const currentIndex = filteredPhotos.findIndex((p) => p.id === selectedPhoto.id)
    let newIndex

    if (direction === "prev") {
      newIndex = currentIndex > 0 ? currentIndex - 1 : filteredPhotos.length - 1
    } else {
      newIndex = currentIndex < filteredPhotos.length - 1 ? currentIndex + 1 : 0
    }

    setSelectedPhoto(filteredPhotos[newIndex])
  }

  return (
    <div className="flex-1 p-6">
      <div className="max-w-7xl mx-auto h-full">
        <div className="bg-white/20 backdrop-blur-xl border border-white/30 rounded-2xl shadow-2xl overflow-hidden h-full flex flex-col">
          {/* Title Bar */}
          <div className="flex items-center justify-between p-4 bg-white/10 border-b border-white/20">
            <h2 className="text-lg font-semibold text-gray-800">Photos</h2>
            <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-full transition-colors">
              <X className="w-4 h-4 text-gray-600" />
            </button>
          </div>

          <div className="flex flex-1 overflow-hidden">
            {/* Sidebar */}
            <div className="w-64 bg-white/10 border-r border-white/20 p-4">
              {/* Search */}
              <div className="relative mb-6">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  placeholder="Search photos..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-white/20 border border-white/30 rounded-lg text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 backdrop-blur-sm"
                />
              </div>

              {/* Categories */}
              <div className="space-y-1">
                {categories.map((category) => (
                  <button
                    key={category.key}
                    onClick={() => setSelectedCategory(category.key)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${
                      selectedCategory === category.key
                        ? "bg-blue-500/20 text-blue-700 font-medium"
                        : "text-gray-600 hover:bg-white/10 hover:text-gray-800"
                    }`}
                  >
                    <span>{category.label}</span>
                    <span className="text-sm opacity-60">{category.count}</span>
                  </button>
                ))}
              </div>

              {/* View Controls */}
              <div className="mt-8 pt-4 border-t border-white/20">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setViewMode("grid")}
                    className={`p-2 rounded-lg transition-colors ${
                      viewMode === "grid" ? "bg-blue-500/20 text-blue-700" : "text-gray-600 hover:bg-white/10"
                    }`}
                  >
                    <Grid3X3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setViewMode("list")}
                    className={`p-2 rounded-lg transition-colors ${
                      viewMode === "list" ? "bg-blue-500/20 text-blue-700" : "text-gray-600 hover:bg-white/10"
                    }`}
                  >
                    <List className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 p-6 overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-gray-800">
                  {selectedCategory === "all"
                    ? "All Photos"
                    : categories.find((c) => c.key === selectedCategory)?.label}
                  <span className="text-gray-500 ml-2">({filteredPhotos.length})</span>
                </h3>
              </div>

              {viewMode === "grid" ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {filteredPhotos.map((photo) => (
                    <div
                      key={photo.id}
                      className="group relative aspect-square bg-white/10 rounded-xl overflow-hidden cursor-pointer hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-xl"
                      onClick={() => openPhoto(photo)}
                    >
                      <img
                        src={photo.thumbnail || "/placeholder.svg"}
                        alt={photo.title}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      <div className="absolute bottom-0 left-0 right-0 p-3 text-white transform translate-y-full group-hover:translate-y-0 transition-transform duration-300">
                        <h4 className="font-medium text-sm truncate">{photo.title}</h4>
                        <p className="text-xs opacity-80">{photo.location}</p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleLike(photo.id)
                        }}
                        className={`absolute top-3 right-3 p-2 rounded-full backdrop-blur-sm transition-all duration-200 ${
                          likedPhotos.includes(photo.id)
                            ? "bg-red-500 text-white"
                            : "bg-white/20 text-white hover:bg-white/30"
                        }`}
                      >
                        <Heart className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredPhotos.map((photo) => (
                    <div
                      key={photo.id}
                      className="flex items-center gap-4 p-4 bg-white/10 rounded-xl hover:bg-white/20 transition-colors cursor-pointer"
                      onClick={() => openPhoto(photo)}
                    >
                      <img
                        src={photo.thumbnail || "/placeholder.svg"}
                        alt={photo.title}
                        className="w-16 h-16 rounded-lg object-cover"
                      />
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-800">{photo.title}</h4>
                        <p className="text-sm text-gray-600">{photo.location}</p>
                        <p className="text-xs text-gray-500">{photo.date}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleLike(photo.id)
                          }}
                          className={`p-2 rounded-full transition-colors ${
                            likedPhotos.includes(photo.id)
                              ? "bg-red-500 text-white"
                              : "bg-white/20 text-gray-600 hover:bg-white/30"
                          }`}
                        >
                          <Heart className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Photo Viewer Modal */}
      {selectedPhoto && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="relative max-w-6xl max-h-[90vh] w-full mx-4">
            {/* Navigation */}
            <button
              onClick={() => navigatePhoto("prev")}
              className="absolute left-4 top-1/2 transform -translate-y-1/2 p-3 bg-white/20 backdrop-blur-sm rounded-full text-white hover:bg-white/30 transition-colors z-10"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button
              onClick={() => navigatePhoto("next")}
              className="absolute right-4 top-1/2 transform -translate-y-1/2 p-3 bg-white/20 backdrop-blur-sm rounded-full text-white hover:bg-white/30 transition-colors z-10"
            >
              <ChevronRight className="w-6 h-6" />
            </button>

            {/* Close Button */}
            <button
              onClick={closePhoto}
              className="absolute top-4 right-4 p-3 bg-white/20 backdrop-blur-sm rounded-full text-white hover:bg-white/30 transition-colors z-10"
            >
              <X className="w-6 h-6" />
            </button>

            {/* Image */}
            <img
              src={selectedPhoto.url || "/placeholder.svg"}
              alt={selectedPhoto.title}
              className="w-full h-full object-contain rounded-2xl"
            />

            {/* Info Bar */}
            <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent rounded-b-2xl">
              <div className="flex items-center justify-between text-white">
                <div>
                  <h3 className="text-xl font-semibold mb-1">{selectedPhoto.title}</h3>
                  <p className="text-sm opacity-80">
                    {selectedPhoto.location} • {selectedPhoto.date}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => toggleLike(selectedPhoto.id)}
                    className={`p-2 rounded-full transition-colors ${
                      likedPhotos.includes(selectedPhoto.id) ? "bg-red-500 text-white" : "bg-white/20 hover:bg-white/30"
                    }`}
                  >
                    <Heart className="w-5 h-5" />
                  </button>
                  <button className="p-2 bg-white/20 hover:bg-white/30 rounded-full transition-colors">
                    <Share className="w-5 h-5" />
                  </button>
                  <button className="p-2 bg-white/20 hover:bg-white/30 rounded-full transition-colors">
                    <Download className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
