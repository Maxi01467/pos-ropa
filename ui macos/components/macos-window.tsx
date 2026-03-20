"use client"

import type { ReactNode } from "react"
import { useState } from "react"

interface MacOSWindowProps {
  children: ReactNode
}

export function MacOSWindow({ children }: MacOSWindowProps) {
  const [isMaximized, setIsMaximized] = useState(false)
  const [windowTitle, setWindowTitle] = useState("macOS Tahoe 26 Template")

  const handleClose = () => {
    // Simulate window close animation
    const windowElement = document.querySelector(".window-frame")
    windowElement?.classList.add("animate-pulse")
    setTimeout(() => {
      alert("Window would close in a real app")
    }, 200)
  }

  const handleMinimize = () => {
    const windowElement = document.querySelector(".window-frame")
    windowElement?.classList.add("scale-95", "opacity-50")
    setTimeout(() => {
      windowElement?.classList.remove("scale-95", "opacity-50")
      alert("Window minimized")
    }, 300)
  }

  const handleMaximize = () => {
    setIsMaximized(!isMaximized)
  }

  return (
    <div className="mx-auto max-w-7xl">
      {/* Window Frame with Liquid Glass Effect */}
      <div
        className={`window-frame relative rounded-xl overflow-hidden shadow-2xl backdrop-blur-xl bg-white/20 border border-white/30 transition-all duration-300 ${isMaximized ? "scale-105" : "hover:shadow-3xl"}`}
      >
        {/* Title Bar */}
        <div className="flex items-center justify-between px-4 py-3 bg-white/10 backdrop-blur-sm border-b border-white/20 select-none">
          <div className="flex items-center gap-2">
            <button
              onClick={handleClose}
              className="w-3 h-3 rounded-full bg-red-500/80 hover:bg-red-500 transition-all duration-200 hover:scale-110 active:scale-95 group"
              title="Close"
            >
              <div className="w-full h-full rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <div className="w-1.5 h-0.5 bg-red-900 rounded-full transform rotate-45"></div>
                <div className="w-1.5 h-0.5 bg-red-900 rounded-full transform -rotate-45 absolute"></div>
              </div>
            </button>
            <button
              onClick={handleMinimize}
              className="w-3 h-3 rounded-full bg-yellow-500/80 hover:bg-yellow-500 transition-all duration-200 hover:scale-110 active:scale-95 group"
              title="Minimize"
            >
              <div className="w-full h-full rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <div className="w-1.5 h-0.5 bg-yellow-900 rounded-full"></div>
              </div>
            </button>
            <button
              onClick={handleMaximize}
              className="w-3 h-3 rounded-full bg-green-500/80 hover:bg-green-500 transition-all duration-200 hover:scale-110 active:scale-95 group"
              title="Maximize"
            >
              <div className="w-full h-full rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <div className="w-1 h-1 border border-green-900 rounded-sm"></div>
              </div>
            </button>
          </div>
          <div
            className="text-sm font-medium text-gray-700 cursor-pointer hover:text-gray-900 transition-colors"
            onClick={() =>
              setWindowTitle(
                windowTitle === "macOS Tahoe 26 Template" ? "Interactive Template" : "macOS Tahoe 26 Template",
              )
            }
          >
            {windowTitle}
          </div>
          <div className="w-16"></div>
        </div>

        {/* Window Content */}
        <div className={`transition-all duration-300 ${isMaximized ? "h-[700px]" : "h-[600px]"}`}>{children}</div>
      </div>
    </div>
  )
}
