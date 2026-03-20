"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { X, Brush, Eraser, Type, Square, Circle, Palette, Layers, Eye, EyeOff } from "lucide-react"

interface Layer {
  id: number
  name: string
  visible: boolean
  opacity: number
}

interface PhotoshopProps {
  onClose: () => void
}

export function Photoshop({ onClose }: PhotoshopProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [selectedTool, setSelectedTool] = useState("brush")
  const [brushSize, setBrushSize] = useState([10])
  const [selectedColor, setSelectedColor] = useState("#000000")
  const [layers, setLayers] = useState<Layer[]>([
    { id: 1, name: "Background", visible: true, opacity: 100 },
    { id: 2, name: "Layer 1", visible: true, opacity: 100 },
  ])
  const [isDrawing, setIsDrawing] = useState(false)

  const tools = [
    { id: "brush", icon: Brush, name: "Brush" },
    { id: "eraser", icon: Eraser, name: "Eraser" },
    { id: "text", icon: Type, name: "Text" },
    { id: "rectangle", icon: Square, name: "Rectangle" },
    { id: "circle", icon: Circle, name: "Circle" },
  ]

  const colors = [
    "#000000",
    "#FFFFFF",
    "#FF0000",
    "#00FF00",
    "#0000FF",
    "#FFFF00",
    "#FF00FF",
    "#00FFFF",
    "#FFA500",
    "#800080",
  ]

  const toggleLayerVisibility = (layerId: number) => {
    setLayers(layers.map((layer) => (layer.id === layerId ? { ...layer, visible: !layer.visible } : layer)))
  }

  const updateLayerOpacity = (layerId: number, opacity: number) => {
    setLayers(layers.map((layer) => (layer.id === layerId ? { ...layer, opacity } : layer)))
  }

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true)
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    ctx.lineWidth = brushSize[0]
    ctx.lineCap = "round"
    ctx.strokeStyle = selectedTool === "eraser" ? "#FFFFFF" : selectedColor

    ctx.lineTo(x, y)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  const stopDrawing = () => {
    setIsDrawing(false)
  }

  return (
    <div className="h-full bg-gray-900 text-white flex">
      {/* Tools Panel */}
      <div className="w-16 bg-gray-800 border-r border-gray-700 flex flex-col items-center py-4 gap-2">
        {tools.map((tool) => {
          const Icon = tool.icon
          return (
            <Button
              key={tool.id}
              variant={selectedTool === tool.id ? "default" : "ghost"}
              size="sm"
              onClick={() => setSelectedTool(tool.id)}
              className={`w-12 h-12 p-0 ${
                selectedTool === tool.id ? "bg-blue-600 hover:bg-blue-700" : "hover:bg-gray-700"
              }`}
              title={tool.name}
            >
              <Icon className="h-5 w-5" />
            </Button>
          )
        })}
      </div>

      {/* Main Canvas Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-3 bg-gray-800 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="text-2xl">🎨</div>
            <h1 className="text-lg font-semibold">Adobe Photoshop</h1>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="hover:bg-gray-700">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-4 p-3 bg-gray-800 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <span className="text-sm">Brush Size:</span>
            <Slider value={brushSize} onValueChange={setBrushSize} max={50} min={1} step={1} className="w-24" />
            <span className="text-sm w-8">{brushSize[0]}</span>
          </div>

          <div className="flex items-center gap-2">
            <Palette className="h-4 w-4" />
            <div className="flex gap-1">
              {colors.map((color) => (
                <button
                  key={color}
                  onClick={() => setSelectedColor(color)}
                  className={`w-6 h-6 rounded border-2 ${selectedColor === color ? "border-white" : "border-gray-600"}`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 bg-gray-700 p-4 overflow-auto">
          <div className="bg-white rounded-lg shadow-lg inline-block">
            <canvas
              ref={canvasRef}
              width={800}
              height={600}
              className="border border-gray-300 cursor-crosshair"
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
            />
          </div>
        </div>
      </div>

      {/* Layers Panel */}
      <div className="w-64 bg-gray-800 border-l border-gray-700">
        <div className="p-3 border-b border-gray-700">
          <h3 className="font-semibold flex items-center gap-2">
            <Layers className="h-4 w-4" />
            Layers
          </h3>
        </div>

        <div className="p-2 space-y-1">
          {layers.map((layer) => (
            <div key={layer.id} className="bg-gray-700 rounded p-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">{layer.name}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleLayerVisibility(layer.id)}
                  className="w-6 h-6 p-0 hover:bg-gray-600"
                >
                  {layer.visible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs">Opacity:</span>
                <Slider
                  value={[layer.opacity]}
                  onValueChange={(value) => updateLayerOpacity(layer.id, value[0])}
                  max={100}
                  min={0}
                  step={1}
                  className="flex-1"
                />
                <span className="text-xs w-8">{layer.opacity}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
