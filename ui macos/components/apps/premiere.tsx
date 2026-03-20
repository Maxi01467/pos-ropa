"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { X, Play, Pause, Square, SkipBack, SkipForward, Volume2, Scissors, Copy } from "lucide-react"

interface VideoClip {
  id: number
  name: string
  duration: number
  startTime: number
  track: number
  color: string
}

interface PremiereProps {
  onClose: () => void
}

export function Premiere({ onClose }: PremiereProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState([0])
  const [volume, setVolume] = useState([75])
  const [selectedClip, setSelectedClip] = useState<number | null>(null)

  const [clips, setClips] = useState<VideoClip[]>([
    { id: 1, name: "Intro.mp4", duration: 5, startTime: 0, track: 1, color: "#3B82F6" },
    { id: 2, name: "Main_Scene.mp4", duration: 15, startTime: 5, track: 1, color: "#10B981" },
    { id: 3, name: "Outro.mp4", duration: 3, startTime: 20, track: 1, color: "#F59E0B" },
    { id: 4, name: "Background_Music.mp3", duration: 23, startTime: 0, track: 2, color: "#8B5CF6" },
  ])

  const totalDuration = Math.max(...clips.map((clip) => clip.startTime + clip.duration))
  const timelineScale = 800 / totalDuration // pixels per second

  const togglePlayback = () => {
    setIsPlaying(!isPlaying)
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  const handleClipClick = (clipId: number) => {
    setSelectedClip(clipId === selectedClip ? null : clipId)
  }

  const duplicateClip = (clipId: number) => {
    const clip = clips.find((c) => c.id === clipId)
    if (!clip) return

    const newClip: VideoClip = {
      ...clip,
      id: Date.now(),
      name: `${clip.name} (Copy)`,
      startTime: clip.startTime + clip.duration,
    }
    setClips([...clips, newClip])
  }

  const deleteClip = (clipId: number) => {
    setClips(clips.filter((c) => c.id !== clipId))
    setSelectedClip(null)
  }

  return (
    <div className="h-full bg-gray-900 text-white flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-3 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-3">
          <div className="text-2xl">🎬</div>
          <h1 className="text-lg font-semibold">Adobe Premiere Pro</h1>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} className="hover:bg-gray-700">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex flex-1">
        {/* Media Panel */}
        <div className="w-64 bg-gray-800 border-r border-gray-700">
          <div className="p-3 border-b border-gray-700">
            <h3 className="font-semibold">Project Media</h3>
          </div>

          <div className="p-2 space-y-2">
            {clips.map((clip) => (
              <div
                key={clip.id}
                className={`p-2 rounded cursor-pointer transition-colors ${
                  selectedClip === clip.id ? "bg-blue-600" : "bg-gray-700 hover:bg-gray-600"
                }`}
                onClick={() => handleClipClick(clip.id)}
              >
                <div className="text-sm font-medium">{clip.name}</div>
                <div className="text-xs text-gray-400">{formatTime(clip.duration)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          {/* Preview Monitor */}
          <div className="flex-1 bg-black flex items-center justify-center">
            <div className="w-96 h-56 bg-gray-800 rounded-lg flex items-center justify-center border-2 border-gray-600">
              <div className="text-center">
                <div className="text-4xl mb-2">📹</div>
                <div className="text-gray-400">Video Preview</div>
                <div className="text-sm text-gray-500 mt-1">
                  {formatTime(currentTime[0])} / {formatTime(totalDuration)}
                </div>
              </div>
            </div>
          </div>

          {/* Transport Controls */}
          <div className="flex items-center justify-center gap-4 p-4 bg-gray-800 border-t border-gray-700">
            <Button variant="ghost" size="sm" className="hover:bg-gray-700">
              <SkipBack className="h-5 w-5" />
            </Button>

            <Button onClick={togglePlayback} size="sm" className="bg-blue-600 hover:bg-blue-700 w-12 h-12 rounded-full">
              {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
            </Button>

            <Button variant="ghost" size="sm" className="hover:bg-gray-700">
              <SkipForward className="h-5 w-5" />
            </Button>

            <Button variant="ghost" size="sm" className="hover:bg-gray-700">
              <Square className="h-4 w-4" />
            </Button>

            <div className="flex items-center gap-2 ml-8">
              <Volume2 className="h-4 w-4" />
              <Slider value={volume} onValueChange={setVolume} max={100} min={0} step={1} className="w-24" />
              <span className="text-sm w-8">{volume[0]}%</span>
            </div>
          </div>

          {/* Timeline */}
          <div className="h-64 bg-gray-800 border-t border-gray-700 overflow-x-auto">
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Timeline</h3>
                <div className="flex gap-2">
                  {selectedClip && (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => duplicateClip(selectedClip)}
                        className="hover:bg-gray-700"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" className="hover:bg-gray-700">
                        <Scissors className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => selectedClip && deleteClip(selectedClip)}>
                        Delete
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* Timeline Ruler */}
              <div className="relative mb-2">
                <div className="h-6 bg-gray-700 rounded flex items-center px-2">
                  {Array.from({ length: Math.ceil(totalDuration) + 1 }, (_, i) => (
                    <div key={i} className="absolute text-xs text-gray-400" style={{ left: `${i * timelineScale}px` }}>
                      {formatTime(i)}
                    </div>
                  ))}
                </div>
              </div>

              {/* Video Track */}
              <div className="mb-2">
                <div className="text-sm text-gray-400 mb-1">Video 1</div>
                <div className="h-12 bg-gray-700 rounded relative">
                  {clips
                    .filter((clip) => clip.track === 1)
                    .map((clip) => (
                      <div
                        key={clip.id}
                        className={`absolute h-10 rounded cursor-pointer border-2 flex items-center px-2 ${
                          selectedClip === clip.id ? "border-white" : "border-transparent"
                        }`}
                        style={{
                          left: `${clip.startTime * timelineScale}px`,
                          width: `${clip.duration * timelineScale}px`,
                          backgroundColor: clip.color,
                          top: "4px",
                        }}
                        onClick={() => handleClipClick(clip.id)}
                      >
                        <span className="text-xs text-white font-medium truncate">{clip.name}</span>
                      </div>
                    ))}
                </div>
              </div>

              {/* Audio Track */}
              <div>
                <div className="text-sm text-gray-400 mb-1">Audio 1</div>
                <div className="h-12 bg-gray-700 rounded relative">
                  {clips
                    .filter((clip) => clip.track === 2)
                    .map((clip) => (
                      <div
                        key={clip.id}
                        className={`absolute h-10 rounded cursor-pointer border-2 flex items-center px-2 ${
                          selectedClip === clip.id ? "border-white" : "border-transparent"
                        }`}
                        style={{
                          left: `${clip.startTime * timelineScale}px`,
                          width: `${clip.duration * timelineScale}px`,
                          backgroundColor: clip.color,
                          top: "4px",
                        }}
                        onClick={() => handleClipClick(clip.id)}
                      >
                        <span className="text-xs text-white font-medium truncate">{clip.name}</span>
                      </div>
                    ))}
                </div>
              </div>

              {/* Playhead */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-red-500 pointer-events-none"
                style={{ left: `${currentTime[0] * timelineScale + 16}px` }}
              />
            </div>
          </div>
        </div>

        {/* Effects Panel */}
        <div className="w-64 bg-gray-800 border-l border-gray-700">
          <div className="p-3 border-b border-gray-700">
            <h3 className="font-semibold">Effects</h3>
          </div>

          <div className="p-2 space-y-2">
            {["Blur", "Color Correction", "Transition", "Audio Fade", "Crop", "Scale"].map((effect) => (
              <div key={effect} className="p-2 bg-gray-700 rounded cursor-pointer hover:bg-gray-600 transition-colors">
                <div className="text-sm">{effect}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Playback Timeline */}
      <div className="p-3 bg-gray-800 border-t border-gray-700">
        <Slider
          value={currentTime}
          onValueChange={setCurrentTime}
          max={totalDuration}
          min={0}
          step={0.1}
          className="w-full"
        />
      </div>
    </div>
  )
}
