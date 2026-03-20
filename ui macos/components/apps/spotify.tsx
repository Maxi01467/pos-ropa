"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Slider } from "@/components/ui/slider"
import { X, Search, Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Volume2, Heart } from "lucide-react"

interface Track {
  id: number
  title: string
  artist: string
  album: string
  duration: string
  cover: string
  isLiked: boolean
}

interface Playlist {
  id: number
  name: string
  description: string
  cover: string
  tracks: Track[]
}

interface SpotifyProps {
  onClose: () => void
}

export function Spotify({ onClose }: SpotifyProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null)
  const [volume, setVolume] = useState([75])
  const [progress, setProgress] = useState([0])
  const [searchQuery, setSearchQuery] = useState("")
  const [activeView, setActiveView] = useState("home")

  const tracks: Track[] = [
    {
      id: 1,
      title: "Blinding Lights",
      artist: "The Weeknd",
      album: "After Hours",
      duration: "3:20",
      cover: "/placeholder.svg?height=300&width=300&text=Blinding+Lights",
      isLiked: true,
    },
    {
      id: 2,
      title: "Watermelon Sugar",
      artist: "Harry Styles",
      album: "Fine Line",
      duration: "2:54",
      cover: "/placeholder.svg?height=300&width=300&text=Watermelon+Sugar",
      isLiked: false,
    },
    {
      id: 3,
      title: "Levitating",
      artist: "Dua Lipa",
      album: "Future Nostalgia",
      duration: "3:23",
      cover: "/placeholder.svg?height=300&width=300&text=Levitating",
      isLiked: true,
    },
    {
      id: 4,
      title: "Good 4 U",
      artist: "Olivia Rodrigo",
      album: "SOUR",
      duration: "2:58",
      cover: "/placeholder.svg?height=300&width=300&text=Good+4+U",
      isLiked: false,
    },
  ]

  const playlists: Playlist[] = [
    {
      id: 1,
      name: "Today's Top Hits",
      description: "The most played songs right now",
      cover: "/placeholder.svg?height=300&width=300&text=Top+Hits",
      tracks: tracks.slice(0, 2),
    },
    {
      id: 2,
      name: "Chill Vibes",
      description: "Relax and unwind with these chill tracks",
      cover: "/placeholder.svg?height=300&width=300&text=Chill+Vibes",
      tracks: tracks.slice(2),
    },
  ]

  const handlePlayTrack = (track: Track) => {
    setCurrentTrack(track)
    setIsPlaying(true)
    setProgress([0])
  }

  const togglePlayback = () => {
    setIsPlaying(!isPlaying)
  }

  const toggleLike = (trackId: number) => {
    // In a real app, this would update the backend
    console.log(`Toggle like for track ${trackId}`)
  }

  const filteredTracks = tracks.filter(
    (track) =>
      track.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      track.artist.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  return (
    <div className="h-full bg-black text-white flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-black border-b border-gray-800">
        <div className="flex items-center gap-6">
          <div className="text-2xl font-bold text-green-500">Spotify</div>
          <nav className="flex gap-6 text-sm">
            <span
              className={`hover:text-white cursor-pointer ${activeView === "home" ? "text-white" : "text-gray-400"}`}
              onClick={() => setActiveView("home")}
            >
              Home
            </span>
            <span
              className={`hover:text-white cursor-pointer ${activeView === "search" ? "text-white" : "text-gray-400"}`}
              onClick={() => setActiveView("search")}
            >
              Search
            </span>
            <span
              className={`hover:text-white cursor-pointer ${activeView === "library" ? "text-white" : "text-gray-400"}`}
              onClick={() => setActiveView("library")}
            >
              Your Library
            </span>
          </nav>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} className="hover:bg-white/20">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="w-64 bg-black border-r border-gray-800 p-4">
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-400 mb-2">PLAYLISTS</h3>
              <div className="space-y-2">
                {playlists.map((playlist) => (
                  <div
                    key={playlist.id}
                    className="flex items-center gap-3 p-2 rounded hover:bg-gray-800 cursor-pointer"
                  >
                    <img src={playlist.cover || "/placeholder.svg"} alt={playlist.name} className="w-10 h-10 rounded" />
                    <div>
                      <div className="text-sm font-medium">{playlist.name}</div>
                      <div className="text-xs text-gray-400">{playlist.tracks.length} songs</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-400 mb-2">RECENTLY PLAYED</h3>
              <div className="space-y-2">
                {tracks.slice(0, 3).map((track) => (
                  <div key={track.id} className="flex items-center gap-3 p-2 rounded hover:bg-gray-800 cursor-pointer">
                    <img src={track.cover || "/placeholder.svg"} alt={track.title} className="w-10 h-10 rounded" />
                    <div>
                      <div className="text-sm font-medium">{track.title}</div>
                      <div className="text-xs text-gray-400">{track.artist}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto">
          {activeView === "home" && (
            <div className="p-6">
              <h1 className="text-3xl font-bold mb-6">Good evening</h1>

              <div className="mb-8">
                <h2 className="text-xl font-bold mb-4">Recently played</h2>
                <div className="grid grid-cols-3 gap-4">
                  {tracks.slice(0, 6).map((track) => (
                    <div
                      key={track.id}
                      className="flex items-center bg-gray-800/50 rounded hover:bg-gray-700 cursor-pointer group"
                    >
                      <img src={track.cover || "/placeholder.svg"} alt={track.title} className="w-16 h-16 rounded-l" />
                      <div className="flex-1 p-3">
                        <div className="font-medium">{track.title}</div>
                        <div className="text-sm text-gray-400">{track.artist}</div>
                      </div>
                      <Button
                        onClick={() => handlePlayTrack(track)}
                        size="sm"
                        className="mr-3 opacity-0 group-hover:opacity-100 bg-green-500 hover:bg-green-600 rounded-full w-10 h-10 p-0"
                      >
                        <Play className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h2 className="text-xl font-bold mb-4">Made for you</h2>
                <div className="grid grid-cols-4 gap-4">
                  {playlists.map((playlist) => (
                    <div
                      key={playlist.id}
                      className="bg-gray-800/30 p-4 rounded-lg hover:bg-gray-800/50 cursor-pointer group"
                    >
                      <img
                        src={playlist.cover || "/placeholder.svg"}
                        alt={playlist.name}
                        className="w-full aspect-square rounded-lg mb-3"
                      />
                      <h3 className="font-medium mb-1">{playlist.name}</h3>
                      <p className="text-sm text-gray-400">{playlist.description}</p>
                      <Button
                        size="sm"
                        className="mt-3 opacity-0 group-hover:opacity-100 bg-green-500 hover:bg-green-600 rounded-full w-10 h-10 p-0"
                      >
                        <Play className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeView === "search" && (
            <div className="p-6">
              <div className="relative mb-6">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="What do you want to listen to?"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-gray-800 border-gray-700 text-white placeholder:text-gray-400"
                />
              </div>

              {searchQuery ? (
                <div>
                  <h2 className="text-xl font-bold mb-4">Search Results</h2>
                  <div className="space-y-2">
                    {filteredTracks.map((track) => (
                      <div key={track.id} className="flex items-center gap-4 p-3 rounded hover:bg-gray-800 group">
                        <Button
                          onClick={() => handlePlayTrack(track)}
                          size="sm"
                          variant="ghost"
                          className="opacity-0 group-hover:opacity-100 w-10 h-10 p-0"
                        >
                          <Play className="h-4 w-4" />
                        </Button>
                        <img src={track.cover || "/placeholder.svg"} alt={track.title} className="w-12 h-12 rounded" />
                        <div className="flex-1">
                          <div className="font-medium">{track.title}</div>
                          <div className="text-sm text-gray-400">{track.artist}</div>
                        </div>
                        <div className="text-sm text-gray-400">{track.duration}</div>
                        <Button
                          onClick={() => toggleLike(track.id)}
                          size="sm"
                          variant="ghost"
                          className="w-10 h-10 p-0"
                        >
                          <Heart className={`h-4 w-4 ${track.isLiked ? "fill-green-500 text-green-500" : ""}`} />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div>
                  <h2 className="text-xl font-bold mb-4">Browse all</h2>
                  <div className="grid grid-cols-4 gap-4">
                    {["Pop", "Hip-Hop", "Rock", "Jazz", "Electronic", "Classical", "Country", "R&B"].map((genre) => (
                      <div
                        key={genre}
                        className="bg-gradient-to-br from-purple-600 to-blue-600 p-4 rounded-lg cursor-pointer hover:scale-105 transition-transform"
                      >
                        <h3 className="text-lg font-bold">{genre}</h3>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeView === "library" && (
            <div className="p-6">
              <h1 className="text-3xl font-bold mb-6">Your Library</h1>
              <div className="space-y-4">
                {tracks
                  .filter((track) => track.isLiked)
                  .map((track) => (
                    <div key={track.id} className="flex items-center gap-4 p-3 rounded hover:bg-gray-800 group">
                      <Button
                        onClick={() => handlePlayTrack(track)}
                        size="sm"
                        variant="ghost"
                        className="opacity-0 group-hover:opacity-100 w-10 h-10 p-0"
                      >
                        <Play className="h-4 w-4" />
                      </Button>
                      <img src={track.cover || "/placeholder.svg"} alt={track.title} className="w-12 h-12 rounded" />
                      <div className="flex-1">
                        <div className="font-medium">{track.title}</div>
                        <div className="text-sm text-gray-400">{track.artist}</div>
                      </div>
                      <div className="text-sm text-gray-400">{track.duration}</div>
                      <Heart className="h-4 w-4 fill-green-500 text-green-500" />
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Now Playing Bar */}
      <div className="bg-gray-900 border-t border-gray-800 p-4">
        <div className="flex items-center justify-between">
          {/* Current Track Info */}
          <div className="flex items-center gap-3 flex-1">
            {currentTrack && (
              <>
                <img
                  src={currentTrack.cover || "/placeholder.svg"}
                  alt={currentTrack.title}
                  className="w-14 h-14 rounded"
                />
                <div>
                  <div className="font-medium">{currentTrack.title}</div>
                  <div className="text-sm text-gray-400">{currentTrack.artist}</div>
                </div>
                <Button onClick={() => toggleLike(currentTrack.id)} size="sm" variant="ghost" className="w-8 h-8 p-0">
                  <Heart className={`h-4 w-4 ${currentTrack.isLiked ? "fill-green-500 text-green-500" : ""}`} />
                </Button>
              </>
            )}
          </div>

          {/* Playback Controls */}
          <div className="flex flex-col items-center gap-2 flex-1">
            <div className="flex items-center gap-4">
              <Button size="sm" variant="ghost">
                <Shuffle className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="ghost">
                <SkipBack className="h-4 w-4" />
              </Button>
              <Button
                onClick={togglePlayback}
                size="sm"
                className="bg-white text-black hover:bg-gray-200 rounded-full w-10 h-10 p-0"
              >
                {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
              </Button>
              <Button size="sm" variant="ghost">
                <SkipForward className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="ghost">
                <Repeat className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center gap-2 w-full max-w-md">
              <span className="text-xs text-gray-400">0:00</span>
              <Slider value={progress} onValueChange={setProgress} max={100} min={0} step={1} className="flex-1" />
              <span className="text-xs text-gray-400">{currentTrack?.duration || "0:00"}</span>
            </div>
          </div>

          {/* Volume Control */}
          <div className="flex items-center gap-2 flex-1 justify-end">
            <Volume2 className="h-4 w-4" />
            <Slider value={volume} onValueChange={setVolume} max={100} min={0} step={1} className="w-24" />
          </div>
        </div>
      </div>
    </div>
  )
}
