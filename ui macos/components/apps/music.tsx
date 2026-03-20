"use client"

import { useState, useEffect } from "react"
import { X, Play, Pause, SkipBack, SkipForward, Volume2, Shuffle, Repeat, Heart, MoreHorizontal } from "lucide-react"

interface Track {
  id: string
  title: string
  artist: string
  album: string
  duration: string
  coverUrl: string
}

interface MusicProps {
  onClose: () => void
}

export function Music({ onClose }: MusicProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTrack, setCurrentTrack] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [volume, setVolume] = useState(75)
  const [isShuffled, setIsShuffled] = useState(false)
  const [repeatMode, setRepeatMode] = useState<"off" | "all" | "one">("off")
  const [likedTracks, setLikedTracks] = useState<string[]>(["1", "3"])
  const [activeView, setActiveView] = useState<"library" | "playlists" | "radio">("library")

  const tracks: Track[] = [
    {
      id: "1",
      title: "Liquid Dreams",
      artist: "Glass Harmony",
      album: "Tahoe Sessions",
      duration: "3:42",
      coverUrl: "/abstract-blue-glass-album-cover.png",
    },
    {
      id: "2",
      title: "Mountain Echoes",
      artist: "Sierra Sounds",
      album: "Alpine Collection",
      duration: "4:15",
      coverUrl: "/purple-mountain-album.png",
    },
    {
      id: "3",
      title: "Crystal Waves",
      artist: "Transparent Audio",
      album: "Refraction",
      duration: "3:28",
      coverUrl: "/crystal-waves-album-cover-teal.png",
    },
    {
      id: "4",
      title: "Neon Nights",
      artist: "Digital Dreams",
      album: "Synthwave Paradise",
      duration: "5:03",
      coverUrl: "/neon-synthwave-album-cover-pink.png",
    },
    {
      id: "5",
      title: "Forest Whispers",
      artist: "Nature's Symphony",
      album: "Organic Sounds",
      duration: "6:21",
      coverUrl: "/forest-nature-album-cover-green.png",
    },
  ]

  const currentTrackData = tracks[currentTrack]
  const totalDuration = 240 // Mock duration in seconds

  useEffect(() => {
    let interval: NodeJS.Timeout
    if (isPlaying) {
      interval = setInterval(() => {
        setCurrentTime((prev) => {
          if (prev >= totalDuration) {
            handleNext()
            return 0
          }
          return prev + 1
        })
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [isPlaying, totalDuration])

  const togglePlay = () => {
    setIsPlaying(!isPlaying)
  }

  const handleNext = () => {
    if (isShuffled) {
      setCurrentTrack(Math.floor(Math.random() * tracks.length))
    } else {
      setCurrentTrack((prev) => (prev + 1) % tracks.length)
    }
    setCurrentTime(0)
  }

  const handlePrevious = () => {
    if (currentTime > 3) {
      setCurrentTime(0)
    } else {
      setCurrentTrack((prev) => (prev - 1 + tracks.length) % tracks.length)
      setCurrentTime(0)
    }
  }

  const toggleLike = (trackId: string) => {
    setLikedTracks((prev) => (prev.includes(trackId) ? prev.filter((id) => id !== trackId) : [...prev, trackId]))
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const progressPercentage = (currentTime / totalDuration) * 100

  return (
    <div className="flex-1 p-6">
      <div className="max-w-6xl mx-auto h-full">
        <div className="bg-white/20 backdrop-blur-xl border border-white/30 rounded-2xl shadow-2xl overflow-hidden h-full flex flex-col">
          {/* Title Bar */}
          <div className="flex items-center justify-between p-4 bg-white/10 border-b border-white/20">
            <h2 className="text-lg font-semibold text-gray-800">Music</h2>
            <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-full transition-colors">
              <X className="w-4 h-4 text-gray-600" />
            </button>
          </div>

          <div className="flex flex-1 overflow-hidden">
            {/* Sidebar */}
            <div className="w-64 bg-white/10 border-r border-white/20 p-4">
              <nav className="space-y-2">
                {[
                  { key: "library", label: "Library" },
                  { key: "playlists", label: "Playlists" },
                  { key: "radio", label: "Radio" },
                ].map((item) => (
                  <button
                    key={item.key}
                    onClick={() => setActiveView(item.key as any)}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                      activeView === item.key
                        ? "bg-red-500/20 text-red-700 font-medium"
                        : "text-gray-600 hover:bg-white/10 hover:text-gray-800"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </nav>

              <div className="mt-8">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Recently Played</h3>
                <div className="space-y-2">
                  {tracks.slice(0, 3).map((track, index) => (
                    <button
                      key={track.id}
                      onClick={() => {
                        setCurrentTrack(tracks.indexOf(track))
                        setCurrentTime(0)
                      }}
                      className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-white/10 transition-colors"
                    >
                      <img
                        src={track.coverUrl || "/placeholder.svg"}
                        alt={track.album}
                        className="w-10 h-10 rounded-md object-cover"
                      />
                      <div className="flex-1 text-left">
                        <p className="text-sm font-medium text-gray-800 truncate">{track.title}</p>
                        <p className="text-xs text-gray-600 truncate">{track.artist}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col">
              {/* Now Playing */}
              <div className="p-8 bg-gradient-to-br from-red-500/20 to-pink-500/20">
                <div className="flex items-center gap-8">
                  <img
                    src={currentTrackData.coverUrl || "/placeholder.svg"}
                    alt={currentTrackData.album}
                    className="w-32 h-32 rounded-2xl shadow-2xl object-cover"
                  />
                  <div className="flex-1">
                    <h1 className="text-3xl font-bold text-gray-800 mb-2">{currentTrackData.title}</h1>
                    <p className="text-xl text-gray-600 mb-1">{currentTrackData.artist}</p>
                    <p className="text-lg text-gray-500">{currentTrackData.album}</p>

                    {/* Controls */}
                    <div className="flex items-center gap-4 mt-6">
                      <button
                        onClick={() => setIsShuffled(!isShuffled)}
                        className={`p-2 rounded-full transition-colors ${
                          isShuffled ? "bg-red-500 text-white" : "bg-white/20 text-gray-600 hover:bg-white/30"
                        }`}
                      >
                        <Shuffle className="w-5 h-5" />
                      </button>

                      <button
                        onClick={handlePrevious}
                        className="p-3 bg-white/20 hover:bg-white/30 rounded-full transition-colors"
                      >
                        <SkipBack className="w-6 h-6 text-gray-700" />
                      </button>

                      <button
                        onClick={togglePlay}
                        className="p-4 bg-red-500 hover:bg-red-600 rounded-full transition-colors shadow-lg"
                      >
                        {isPlaying ? (
                          <Pause className="w-8 h-8 text-white" />
                        ) : (
                          <Play className="w-8 h-8 text-white ml-1" />
                        )}
                      </button>

                      <button
                        onClick={handleNext}
                        className="p-3 bg-white/20 hover:bg-white/30 rounded-full transition-colors"
                      >
                        <SkipForward className="w-6 h-6 text-gray-700" />
                      </button>

                      <button
                        onClick={() =>
                          setRepeatMode(repeatMode === "off" ? "all" : repeatMode === "all" ? "one" : "off")
                        }
                        className={`p-2 rounded-full transition-colors ${
                          repeatMode !== "off" ? "bg-red-500 text-white" : "bg-white/20 text-gray-600 hover:bg-white/30"
                        }`}
                      >
                        <Repeat className="w-5 h-5" />
                      </button>

                      <button
                        onClick={() => toggleLike(currentTrackData.id)}
                        className={`p-2 rounded-full transition-colors ${
                          likedTracks.includes(currentTrackData.id)
                            ? "bg-red-500 text-white"
                            : "bg-white/20 text-gray-600 hover:bg-white/30"
                        }`}
                      >
                        <Heart className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mt-6">
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <span>{formatTime(currentTime)}</span>
                    <div className="flex-1 bg-white/20 rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full bg-red-500 transition-all duration-1000 ease-linear"
                        style={{ width: `${progressPercentage}%` }}
                      />
                    </div>
                    <span>{formatTime(totalDuration)}</span>
                  </div>
                </div>

                {/* Volume Control */}
                <div className="flex items-center gap-3 mt-4">
                  <Volume2 className="w-5 h-5 text-gray-600" />
                  <div className="w-32 bg-white/20 rounded-full h-2 overflow-hidden">
                    <div className="h-full bg-gray-600" style={{ width: `${volume}%` }} />
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={volume}
                    onChange={(e) => setVolume(Number(e.target.value))}
                    className="w-32 opacity-0 absolute pointer-events-auto"
                  />
                </div>
              </div>

              {/* Track List */}
              <div className="flex-1 overflow-y-auto p-6">
                <h2 className="text-xl font-semibold text-gray-800 mb-4">Up Next</h2>
                <div className="space-y-2">
                  {tracks.map((track, index) => (
                    <button
                      key={track.id}
                      onClick={() => {
                        setCurrentTrack(index)
                        setCurrentTime(0)
                      }}
                      className={`w-full flex items-center gap-4 p-3 rounded-lg transition-colors ${
                        index === currentTrack ? "bg-red-500/20 border border-red-500/30" : "hover:bg-white/10"
                      }`}
                    >
                      <img
                        src={track.coverUrl || "/placeholder.svg"}
                        alt={track.album}
                        className="w-12 h-12 rounded-lg object-cover"
                      />
                      <div className="flex-1 text-left">
                        <h3 className="font-medium text-gray-800">{track.title}</h3>
                        <p className="text-sm text-gray-600">
                          {track.artist} • {track.album}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleLike(track.id)
                          }}
                          className={`p-1 rounded-full transition-colors ${
                            likedTracks.includes(track.id) ? "text-red-500" : "text-gray-400 hover:text-gray-600"
                          }`}
                        >
                          <Heart className="w-4 h-4" />
                        </button>
                        <span className="text-sm text-gray-500">{track.duration}</span>
                        <button className="p-1 text-gray-400 hover:text-gray-600 transition-colors">
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
