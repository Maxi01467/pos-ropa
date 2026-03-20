"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { X, Search, Play, Plus, ThumbsUp, ThumbsDown, Volume2 } from "lucide-react"

interface Movie {
  id: number
  title: string
  description: string
  genre: string
  rating: string
  duration: string
  year: number
  thumbnail: string
  isNew: boolean
}

interface NetflixProps {
  onClose: () => void
}

export function Netflix({ onClose }: NetflixProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)

  const movies: Movie[] = [
    {
      id: 1,
      title: "Stranger Things",
      description: "When a young boy vanishes, a small town uncovers a mystery involving secret experiments.",
      genre: "Sci-Fi Drama",
      rating: "TV-14",
      duration: "8 Episodes",
      year: 2023,
      thumbnail: "/placeholder.svg?height=300&width=200&text=Stranger+Things",
      isNew: true,
    },
    {
      id: 2,
      title: "The Crown",
      description: "Follows the political rivalries and romance of Queen Elizabeth II's reign.",
      genre: "Historical Drama",
      rating: "TV-MA",
      duration: "10 Episodes",
      year: 2023,
      thumbnail: "/placeholder.svg?height=300&width=200&text=The+Crown",
      isNew: false,
    },
    {
      id: 3,
      title: "Wednesday",
      description: "Wednesday Addams navigates her years as a student at Nevermore Academy.",
      genre: "Comedy Horror",
      rating: "TV-14",
      duration: "8 Episodes",
      year: 2023,
      thumbnail: "/placeholder.svg?height=300&width=200&text=Wednesday",
      isNew: true,
    },
    {
      id: 4,
      title: "Ozark",
      description: "A financial advisor drags his family from Chicago to the Missouri Ozarks.",
      genre: "Crime Drama",
      rating: "TV-MA",
      duration: "4 Seasons",
      year: 2022,
      thumbnail: "/placeholder.svg?height=300&width=200&text=Ozark",
      isNew: false,
    },
    {
      id: 5,
      title: "The Witcher",
      description: "Geralt of Rivia, a solitary monster hunter, struggles to find his place.",
      genre: "Fantasy",
      rating: "TV-MA",
      duration: "3 Seasons",
      year: 2023,
      thumbnail: "/placeholder.svg?height=300&width=200&text=The+Witcher",
      isNew: false,
    },
    {
      id: 6,
      title: "Money Heist",
      description: "An unusual group of robbers attempt to carry out the most perfect robbery.",
      genre: "Crime Thriller",
      rating: "TV-MA",
      duration: "5 Seasons",
      year: 2021,
      thumbnail: "/placeholder.svg?height=300&width=200&text=Money+Heist",
      isNew: false,
    },
  ]

  const categories = [
    { name: "Trending Now", movies: movies.slice(0, 3) },
    { name: "New Releases", movies: movies.filter((m) => m.isNew) },
    { name: "Drama Series", movies: movies.filter((m) => m.genre.includes("Drama")) },
    {
      name: "Sci-Fi & Fantasy",
      movies: movies.filter((m) => m.genre.includes("Sci-Fi") || m.genre.includes("Fantasy")),
    },
  ]

  const filteredMovies = movies.filter(
    (movie) =>
      movie.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      movie.genre.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const handlePlayMovie = (movie: Movie) => {
    setSelectedMovie(movie)
    setIsPlaying(true)
  }

  if (isPlaying && selectedMovie) {
    return (
      <div className="h-full bg-black flex items-center justify-center relative">
        <div className="w-full h-full bg-gray-900 flex items-center justify-center">
          <div className="text-center text-white">
            <div className="text-6xl mb-4">🎬</div>
            <h1 className="text-4xl font-bold mb-2">{selectedMovie.title}</h1>
            <p className="text-xl mb-4">Now Playing...</p>
            <div className="w-96 h-2 bg-gray-700 rounded-full mx-auto mb-4">
              <div className="w-1/4 h-full bg-red-600 rounded-full"></div>
            </div>
          </div>
        </div>

        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex items-center gap-4">
          <Button onClick={() => setIsPlaying(false)} variant="secondary">
            Pause
          </Button>
          <Button
            onClick={() => {
              setIsPlaying(false)
              setSelectedMovie(null)
            }}
            variant="secondary"
          >
            Stop
          </Button>
          <Button variant="secondary">
            <Volume2 className="h-4 w-4" />
          </Button>
        </div>

        <Button
          onClick={() => {
            setIsPlaying(false)
            setSelectedMovie(null)
          }}
          variant="ghost"
          size="sm"
          className="absolute top-4 right-4 text-white hover:bg-white/20"
        >
          <X className="h-6 w-6" />
        </Button>
      </div>
    )
  }

  return (
    <div className="h-full bg-black text-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-black/90 backdrop-blur-sm">
        <div className="flex items-center gap-6">
          <div className="text-2xl font-bold text-red-600">NETFLIX</div>
          <nav className="flex gap-6 text-sm">
            <span className="hover:text-gray-300 cursor-pointer">Home</span>
            <span className="hover:text-gray-300 cursor-pointer">TV Shows</span>
            <span className="hover:text-gray-300 cursor-pointer">Movies</span>
            <span className="hover:text-gray-300 cursor-pointer">My List</span>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search titles..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-black/50 border-gray-600 text-white placeholder:text-gray-400"
            />
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="hover:bg-white/20">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Hero Section */}
      {!searchQuery && (
        <div className="relative h-96 bg-gradient-to-r from-purple-900 to-blue-900 flex items-center">
          <div className="absolute inset-0 bg-black/40"></div>
          <div className="relative z-10 p-8 max-w-2xl">
            <h1 className="text-5xl font-bold mb-4">Stranger Things</h1>
            <p className="text-lg mb-6">
              When a young boy vanishes, a small town uncovers a mystery involving secret experiments, terrifying
              supernatural forces, and one strange little girl.
            </p>
            <div className="flex gap-4">
              <Button onClick={() => handlePlayMovie(movies[0])} className="bg-white text-black hover:bg-gray-200">
                <Play className="h-5 w-5 mr-2" />
                Play
              </Button>
              <Button variant="secondary" className="bg-gray-600 hover:bg-gray-700">
                <Plus className="h-5 w-5 mr-2" />
                My List
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {searchQuery ? (
          <div>
            <h2 className="text-2xl font-bold mb-4">Search Results</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {filteredMovies.map((movie) => (
                <div key={movie.id} className="group cursor-pointer" onClick={() => setSelectedMovie(movie)}>
                  <div className="relative overflow-hidden rounded-lg">
                    <img
                      src={movie.thumbnail || "/placeholder.svg"}
                      alt={movie.title}
                      className="w-full h-64 object-cover group-hover:scale-105 transition-transform"
                    />
                    {movie.isNew && (
                      <div className="absolute top-2 left-2 bg-red-600 text-xs px-2 py-1 rounded">NEW</div>
                    )}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Button
                        onClick={(e) => {
                          e.stopPropagation()
                          handlePlayMovie(movie)
                        }}
                        size="sm"
                      >
                        <Play className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <h3 className="mt-2 font-medium">{movie.title}</h3>
                  <p className="text-sm text-gray-400">{movie.genre}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {categories.map((category) => (
              <div key={category.name}>
                <h2 className="text-xl font-bold mb-4">{category.name}</h2>
                <div className="flex gap-4 overflow-x-auto pb-4">
                  {category.movies.map((movie) => (
                    <div
                      key={movie.id}
                      className="flex-shrink-0 w-48 group cursor-pointer"
                      onClick={() => setSelectedMovie(movie)}
                    >
                      <div className="relative overflow-hidden rounded-lg">
                        <img
                          src={movie.thumbnail || "/placeholder.svg"}
                          alt={movie.title}
                          className="w-full h-64 object-cover group-hover:scale-105 transition-transform"
                        />
                        {movie.isNew && (
                          <div className="absolute top-2 left-2 bg-red-600 text-xs px-2 py-1 rounded">NEW</div>
                        )}
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Button
                            onClick={(e) => {
                              e.stopPropagation()
                              handlePlayMovie(movie)
                            }}
                            size="sm"
                          >
                            <Play className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <h3 className="mt-2 font-medium">{movie.title}</h3>
                      <p className="text-sm text-gray-400">{movie.genre}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Movie Detail Modal */}
      {selectedMovie && !isPlaying && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-lg p-6 max-w-2xl w-full mx-4">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-2xl font-bold">{selectedMovie.title}</h2>
              <Button variant="ghost" size="sm" onClick={() => setSelectedMovie(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex gap-4 mb-4">
              <img
                src={selectedMovie.thumbnail || "/placeholder.svg"}
                alt={selectedMovie.title}
                className="w-32 h-48 object-cover rounded"
              />
              <div className="flex-1">
                <p className="text-gray-300 mb-4">{selectedMovie.description}</p>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-gray-400">Genre:</span> {selectedMovie.genre}
                  </div>
                  <div>
                    <span className="text-gray-400">Rating:</span> {selectedMovie.rating}
                  </div>
                  <div>
                    <span className="text-gray-400">Duration:</span> {selectedMovie.duration}
                  </div>
                  <div>
                    <span className="text-gray-400">Year:</span> {selectedMovie.year}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <Button onClick={() => handlePlayMovie(selectedMovie)} className="bg-white text-black hover:bg-gray-200">
                <Play className="h-4 w-4 mr-2" />
                Play
              </Button>
              <Button variant="secondary">
                <Plus className="h-4 w-4 mr-2" />
                Add to List
              </Button>
              <Button variant="ghost">
                <ThumbsUp className="h-4 w-4" />
              </Button>
              <Button variant="ghost">
                <ThumbsDown className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
