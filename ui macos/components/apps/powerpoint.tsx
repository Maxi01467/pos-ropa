"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { X, Plus, Play, Square, Type, ImageIcon, BarChart3 } from "lucide-react"

interface Slide {
  id: number
  title: string
  content: string
  background: string
}

interface PowerPointProps {
  onClose: () => void
}

export function PowerPoint({ onClose }: PowerPointProps) {
  const [slides, setSlides] = useState<Slide[]>([
    {
      id: 1,
      title: "Welcome to Our Presentation",
      content: "This is the first slide of our amazing presentation about innovation and growth.",
      background: "bg-gradient-to-br from-blue-500 to-purple-600",
    },
    {
      id: 2,
      title: "Our Mission",
      content: "To create innovative solutions that transform the way people work and collaborate.",
      background: "bg-gradient-to-br from-green-500 to-teal-600",
    },
    {
      id: 3,
      title: "Key Features",
      content: "• Advanced Analytics\n• Real-time Collaboration\n• Cloud Integration\n• Mobile Support",
      background: "bg-gradient-to-br from-orange-500 to-red-600",
    },
  ])

  const [currentSlide, setCurrentSlide] = useState(0)
  const [isPresenting, setIsPresenting] = useState(false)

  const addSlide = () => {
    const newSlide: Slide = {
      id: slides.length + 1,
      title: "New Slide",
      content: "Click to add content",
      background: "bg-gradient-to-br from-indigo-500 to-purple-600",
    }
    setSlides([...slides, newSlide])
  }

  const updateSlide = (field: "title" | "content", value: string) => {
    const updatedSlides = slides.map((slide, index) => (index === currentSlide ? { ...slide, [field]: value } : slide))
    setSlides(updatedSlides)
  }

  const nextSlide = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1)
    }
  }

  const prevSlide = () => {
    if (currentSlide > 0) {
      setCurrentSlide(currentSlide - 1)
    }
  }

  if (isPresenting) {
    return (
      <div className="h-full bg-black flex items-center justify-center relative">
        <div
          className={`w-full h-full flex flex-col items-center justify-center text-white p-12 ${slides[currentSlide]?.background}`}
        >
          <h1 className="text-6xl font-bold mb-8 text-center">{slides[currentSlide]?.title}</h1>
          <div className="text-2xl leading-relaxed text-center whitespace-pre-line max-w-4xl">
            {slides[currentSlide]?.content}
          </div>
        </div>

        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex items-center gap-4">
          <Button onClick={prevSlide} disabled={currentSlide === 0} variant="secondary">
            Previous
          </Button>
          <span className="text-white">
            {currentSlide + 1} / {slides.length}
          </span>
          <Button onClick={nextSlide} disabled={currentSlide === slides.length - 1} variant="secondary">
            Next
          </Button>
          <Button onClick={() => setIsPresenting(false)} variant="secondary">
            Exit
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full bg-white/20 backdrop-blur-xl border border-white/30 rounded-xl overflow-hidden flex">
      {/* Slide Thumbnails */}
      <div className="w-64 border-r border-white/20 bg-white/10 overflow-y-auto">
        <div className="p-3 border-b border-white/20">
          <Button onClick={addSlide} size="sm" className="w-full bg-blue-500 hover:bg-blue-600 text-white">
            <Plus className="h-4 w-4 mr-1" />
            New Slide
          </Button>
        </div>

        <div className="p-2 space-y-2">
          {slides.map((slide, index) => (
            <div
              key={slide.id}
              onClick={() => setCurrentSlide(index)}
              className={`p-3 rounded-lg cursor-pointer transition-all ${
                currentSlide === index ? "bg-blue-200/50 ring-2 ring-blue-400" : "bg-white/20 hover:bg-white/30"
              }`}
            >
              <div className={`w-full h-20 rounded mb-2 ${slide.background} flex items-center justify-center`}>
                <div className="text-white text-xs font-medium text-center px-2">{slide.title}</div>
              </div>
              <div className="text-xs text-gray-600 text-center">Slide {index + 1}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-white/20 bg-white/10">
          <div className="flex items-center gap-3">
            <div className="text-2xl">📽️</div>
            <h1 className="text-lg font-semibold text-gray-800">Microsoft PowerPoint</h1>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="hover:bg-white/20">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2 p-2 border-b border-white/20 bg-white/5">
          <Button
            onClick={() => setIsPresenting(true)}
            size="sm"
            className="bg-green-500 hover:bg-green-600 text-white"
          >
            <Play className="h-4 w-4 mr-1" />
            Present
          </Button>
          <Button size="sm" variant="ghost" className="hover:bg-white/20">
            <Type className="h-4 w-4 mr-1" />
            Text
          </Button>
          <Button size="sm" variant="ghost" className="hover:bg-white/20">
            <ImageIcon className="h-4 w-4 mr-1" />
            Image
          </Button>
          <Button size="sm" variant="ghost" className="hover:bg-white/20">
            <BarChart3 className="h-4 w-4 mr-1" />
            Chart
          </Button>
          <Button size="sm" variant="ghost" className="hover:bg-white/20">
            <Square className="h-4 w-4 mr-1" />
            Shape
          </Button>
        </div>

        {/* Slide Editor */}
        <div className="flex-1 p-6 overflow-auto">
          <div className="max-w-4xl mx-auto">
            <div
              className={`w-full aspect-video rounded-lg ${slides[currentSlide]?.background} p-8 flex flex-col justify-center text-white mb-6`}
            >
              <Input
                value={slides[currentSlide]?.title || ""}
                onChange={(e) => updateSlide("title", e.target.value)}
                className="text-4xl font-bold bg-transparent border-none text-white placeholder:text-white/70 mb-4"
                placeholder="Click to add title"
              />
              <textarea
                value={slides[currentSlide]?.content || ""}
                onChange={(e) => updateSlide("content", e.target.value)}
                className="text-xl bg-transparent border-none text-white placeholder:text-white/70 resize-none outline-none"
                placeholder="Click to add content"
                rows={6}
              />
            </div>

            <div className="flex items-center justify-between text-sm text-gray-600">
              <div>
                Slide {currentSlide + 1} of {slides.length}
              </div>
              <div className="flex gap-2">
                <Button onClick={prevSlide} disabled={currentSlide === 0} size="sm" variant="ghost">
                  Previous
                </Button>
                <Button onClick={nextSlide} disabled={currentSlide === slides.length - 1} size="sm" variant="ghost">
                  Next
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
