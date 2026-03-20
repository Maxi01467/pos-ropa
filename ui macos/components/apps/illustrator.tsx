"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { X, MousePointer, Square, Circle, Triangle, Type, Palette, RotateCcw, RotateCw } from "lucide-react"

interface Shape {
  id: number
  type: string
  x: number
  y: number
  width: number
  height: number
  fill: string
  stroke: string
  rotation: number
}

interface IllustratorProps {
  onClose: () => void
}

export function Illustrator({ onClose }: IllustratorProps) {
  const [selectedTool, setSelectedTool] = useState("select")
  const [shapes, setShapes] = useState<Shape[]>([
    {
      id: 1,
      type: "rectangle",
      x: 100,
      y: 100,
      width: 150,
      height: 100,
      fill: "#3B82F6",
      stroke: "#1E40AF",
      rotation: 0,
    },
    {
      id: 2,
      type: "circle",
      x: 300,
      y: 150,
      width: 120,
      height: 120,
      fill: "#EF4444",
      stroke: "#DC2626",
      rotation: 0,
    },
  ])
  const [selectedShape, setSelectedShape] = useState<number | null>(null)
  const [fillColor, setFillColor] = useState("#3B82F6")
  const [strokeColor, setStrokeColor] = useState("#1E40AF")

  const tools = [
    { id: "select", icon: MousePointer, name: "Selection" },
    { id: "rectangle", icon: Square, name: "Rectangle" },
    { id: "circle", icon: Circle, name: "Circle" },
    { id: "triangle", icon: Triangle, name: "Triangle" },
    { id: "text", icon: Type, name: "Text" },
  ]

  const colors = [
    "#3B82F6",
    "#EF4444",
    "#10B981",
    "#F59E0B",
    "#8B5CF6",
    "#EC4899",
    "#06B6D4",
    "#84CC16",
    "#F97316",
    "#6B7280",
  ]

  const addShape = (type: string) => {
    const newShape: Shape = {
      id: Date.now(),
      type,
      x: Math.random() * 400 + 50,
      y: Math.random() * 300 + 50,
      width: type === "circle" ? 100 : 120,
      height: 100,
      fill: fillColor,
      stroke: strokeColor,
      rotation: 0,
    }
    setShapes([...shapes, newShape])
  }

  const updateShape = (id: number, updates: Partial<Shape>) => {
    setShapes(shapes.map((shape) => (shape.id === id ? { ...shape, ...updates } : shape)))
  }

  const deleteShape = (id: number) => {
    setShapes(shapes.filter((shape) => shape.id !== id))
    setSelectedShape(null)
  }

  const renderShape = (shape: Shape) => {
    const commonProps = {
      key: shape.id,
      onClick: () => setSelectedShape(shape.id),
      className: `cursor-pointer ${selectedShape === shape.id ? "ring-2 ring-blue-400" : ""}`,
      style: {
        transform: `rotate(${shape.rotation}deg)`,
        transformOrigin: "center",
      },
    }

    switch (shape.type) {
      case "rectangle":
        return (
          <rect
            {...commonProps}
            x={shape.x}
            y={shape.y}
            width={shape.width}
            height={shape.height}
            fill={shape.fill}
            stroke={shape.stroke}
            strokeWidth="2"
          />
        )
      case "circle":
        return (
          <circle
            {...commonProps}
            cx={shape.x + shape.width / 2}
            cy={shape.y + shape.height / 2}
            r={shape.width / 2}
            fill={shape.fill}
            stroke={shape.stroke}
            strokeWidth="2"
          />
        )
      case "triangle":
        const points = `${shape.x + shape.width / 2},${shape.y} ${shape.x},${shape.y + shape.height} ${shape.x + shape.width},${shape.y + shape.height}`
        return <polygon {...commonProps} points={points} fill={shape.fill} stroke={shape.stroke} strokeWidth="2" />
      default:
        return null
    }
  }

  const selectedShapeData = shapes.find((s) => s.id === selectedShape)

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
              onClick={() => {
                setSelectedTool(tool.id)
                if (tool.id !== "select" && tool.id !== "text") {
                  addShape(tool.id)
                }
              }}
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
            <div className="text-2xl">✏️</div>
            <h1 className="text-lg font-semibold">Adobe Illustrator</h1>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="hover:bg-gray-700">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-4 p-3 bg-gray-800 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <Palette className="h-4 w-4" />
            <span className="text-sm">Fill:</span>
            <div className="flex gap-1">
              {colors.slice(0, 5).map((color) => (
                <button
                  key={color}
                  onClick={() => setFillColor(color)}
                  className={`w-6 h-6 rounded border-2 ${fillColor === color ? "border-white" : "border-gray-600"}`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm">Stroke:</span>
            <div className="flex gap-1">
              {colors.slice(5).map((color) => (
                <button
                  key={color}
                  onClick={() => setStrokeColor(color)}
                  className={`w-6 h-6 rounded border-2 ${strokeColor === color ? "border-white" : "border-gray-600"}`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          {selectedShape && (
            <div className="flex items-center gap-2 ml-auto">
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  selectedShapeData && updateShape(selectedShape, { rotation: selectedShapeData.rotation - 15 })
                }
                className="hover:bg-gray-700"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  selectedShapeData && updateShape(selectedShape, { rotation: selectedShapeData.rotation + 15 })
                }
                className="hover:bg-gray-700"
              >
                <RotateCw className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="destructive" onClick={() => selectedShape && deleteShape(selectedShape)}>
                Delete
              </Button>
            </div>
          )}
        </div>

        {/* Canvas */}
        <div className="flex-1 bg-gray-700 p-4 overflow-auto">
          <div className="bg-white rounded-lg shadow-lg inline-block">
            <svg width="800" height="600" className="border border-gray-300">
              <defs>
                <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                  <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#f0f0f0" strokeWidth="1" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
              {shapes.map(renderShape)}
            </svg>
          </div>
        </div>
      </div>

      {/* Properties Panel */}
      <div className="w-64 bg-gray-800 border-l border-gray-700">
        <div className="p-3 border-b border-gray-700">
          <h3 className="font-semibold">Properties</h3>
        </div>

        {selectedShapeData ? (
          <div className="p-3 space-y-4">
            <div>
              <label className="text-sm font-medium">Width</label>
              <Slider
                value={[selectedShapeData.width]}
                onValueChange={(value) => updateShape(selectedShape!, { width: value[0] })}
                max={300}
                min={10}
                step={1}
                className="mt-1"
              />
              <span className="text-xs text-gray-400">{selectedShapeData.width}px</span>
            </div>

            <div>
              <label className="text-sm font-medium">Height</label>
              <Slider
                value={[selectedShapeData.height]}
                onValueChange={(value) => updateShape(selectedShape!, { height: value[0] })}
                max={300}
                min={10}
                step={1}
                className="mt-1"
              />
              <span className="text-xs text-gray-400">{selectedShapeData.height}px</span>
            </div>

            <div>
              <label className="text-sm font-medium">Rotation</label>
              <Slider
                value={[selectedShapeData.rotation]}
                onValueChange={(value) => updateShape(selectedShape!, { rotation: value[0] })}
                max={360}
                min={0}
                step={15}
                className="mt-1"
              />
              <span className="text-xs text-gray-400">{selectedShapeData.rotation}°</span>
            </div>

            <div>
              <label className="text-sm font-medium">Fill Color</label>
              <input
                type="color"
                value={selectedShapeData.fill}
                onChange={(e) => updateShape(selectedShape!, { fill: e.target.value })}
                className="w-full h-8 rounded border border-gray-600 bg-gray-700 mt-1"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Stroke Color</label>
              <input
                type="color"
                value={selectedShapeData.stroke}
                onChange={(e) => updateShape(selectedShape!, { stroke: e.target.value })}
                className="w-full h-8 rounded border border-gray-600 bg-gray-700 mt-1"
              />
            </div>
          </div>
        ) : (
          <div className="p-3 text-gray-400 text-sm">Select a shape to edit properties</div>
        )}
      </div>
    </div>
  )
}
