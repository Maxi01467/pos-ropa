"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { X, Save, FileText, Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, List } from "lucide-react"

interface WordProps {
  onClose: () => void
}

export function Word({ onClose }: WordProps) {
  const [content, setContent] = useState(`Welcome to Microsoft Word

This is a sample document to demonstrate the word processing capabilities of our macOS Tahoe system.

Key Features:
• Rich text formatting
• Document templates
• Collaboration tools
• Cloud synchronization

You can edit this document by clicking anywhere in the text area. The toolbar above provides various formatting options to enhance your document.

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.

Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.`)

  const [wordCount, setWordCount] = useState(content.split(" ").length)
  const [formatting, setFormatting] = useState({
    bold: false,
    italic: false,
    underline: false,
    align: "left",
  })

  const handleContentChange = (value: string) => {
    setContent(value)
    setWordCount(value.split(" ").filter((word) => word.length > 0).length)
  }

  const toggleFormat = (format: keyof typeof formatting) => {
    setFormatting((prev) => ({
      ...prev,
      [format]: !prev[format],
    }))
  }

  const setAlignment = (align: string) => {
    setFormatting((prev) => ({
      ...prev,
      align,
    }))
  }

  return (
    <div className="h-full bg-white/20 backdrop-blur-xl border border-white/30 rounded-xl overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-white/20 bg-white/10">
        <div className="flex items-center gap-3">
          <div className="text-2xl">📝</div>
          <h1 className="text-lg font-semibold text-gray-800">Microsoft Word</h1>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} className="hover:bg-white/20">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-1 p-2 border-b border-white/20 bg-white/5 flex-wrap">
        <Button size="sm" variant="ghost" className="hover:bg-white/20">
          <Save className="h-4 w-4 mr-1" />
          Save
        </Button>
        <Button size="sm" variant="ghost" className="hover:bg-white/20">
          <FileText className="h-4 w-4 mr-1" />
          New
        </Button>

        <div className="w-px h-6 bg-white/20 mx-2"></div>

        <Button
          size="sm"
          variant={formatting.bold ? "default" : "ghost"}
          onClick={() => toggleFormat("bold")}
          className={formatting.bold ? "bg-blue-500 text-white" : "hover:bg-white/20"}
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant={formatting.italic ? "default" : "ghost"}
          onClick={() => toggleFormat("italic")}
          className={formatting.italic ? "bg-blue-500 text-white" : "hover:bg-white/20"}
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant={formatting.underline ? "default" : "ghost"}
          onClick={() => toggleFormat("underline")}
          className={formatting.underline ? "bg-blue-500 text-white" : "hover:bg-white/20"}
        >
          <Underline className="h-4 w-4" />
        </Button>

        <div className="w-px h-6 bg-white/20 mx-2"></div>

        <Button
          size="sm"
          variant={formatting.align === "left" ? "default" : "ghost"}
          onClick={() => setAlignment("left")}
          className={formatting.align === "left" ? "bg-blue-500 text-white" : "hover:bg-white/20"}
        >
          <AlignLeft className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant={formatting.align === "center" ? "default" : "ghost"}
          onClick={() => setAlignment("center")}
          className={formatting.align === "center" ? "bg-blue-500 text-white" : "hover:bg-white/20"}
        >
          <AlignCenter className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant={formatting.align === "right" ? "default" : "ghost"}
          onClick={() => setAlignment("right")}
          className={formatting.align === "right" ? "bg-blue-500 text-white" : "hover:bg-white/20"}
        >
          <AlignRight className="h-4 w-4" />
        </Button>

        <div className="w-px h-6 bg-white/20 mx-2"></div>

        <Button size="sm" variant="ghost" className="hover:bg-white/20">
          <List className="h-4 w-4" />
        </Button>
      </div>

      {/* Document Area */}
      <div className="flex-1 p-6 overflow-auto">
        <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-lg min-h-full">
          <div className="p-12">
            <textarea
              value={content}
              onChange={(e) => handleContentChange(e.target.value)}
              className={`w-full h-full min-h-96 resize-none border-none outline-none text-gray-800 leading-relaxed ${
                formatting.bold ? "font-bold" : ""
              } ${formatting.italic ? "italic" : ""} ${formatting.underline ? "underline" : ""} ${
                formatting.align === "center"
                  ? "text-center"
                  : formatting.align === "right"
                    ? "text-right"
                    : "text-left"
              }`}
              style={{ fontSize: "16px", lineHeight: "1.6" }}
              placeholder="Start typing your document..."
            />
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <div className="flex items-center justify-between p-2 border-t border-white/20 bg-white/5 text-sm text-gray-600">
        <div>Page 1 of 1</div>
        <div>{wordCount} words</div>
        <div>English (US)</div>
      </div>
    </div>
  )
}
