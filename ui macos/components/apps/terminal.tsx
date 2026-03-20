"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { X, Minus, Square } from "lucide-react"

interface TerminalLine {
  id: number
  type: "command" | "output" | "error"
  content: string
  timestamp: Date
}

interface TerminalProps {
  onClose: () => void
}

export function Terminal({ onClose }: TerminalProps) {
  const [lines, setLines] = useState<TerminalLine[]>([
    {
      id: 1,
      type: "output",
      content: "Welcome to Terminal Pro - macOS Tahoe 26",
      timestamp: new Date(),
    },
    {
      id: 2,
      type: "output",
      content: "Type 'help' for available commands",
      timestamp: new Date(),
    },
  ])
  const [currentCommand, setCurrentCommand] = useState("")
  const [commandHistory, setCommandHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const terminalRef = useRef<HTMLDivElement>(null)

  const commands = {
    help: () => [
      "Available commands:",
      "  ls          - List directory contents",
      "  pwd         - Print working directory",
      "  cd          - Change directory",
      "  mkdir       - Create directory",
      "  touch       - Create file",
      "  cat         - Display file contents",
      "  echo        - Display text",
      "  date        - Show current date and time",
      "  whoami      - Show current user",
      "  clear       - Clear terminal",
      "  help        - Show this help message",
    ],
    ls: () => ["Documents", "Downloads", "Desktop", "Pictures", "Music", "Videos", "Applications"],
    pwd: () => ["/Users/user"],
    date: () => [new Date().toString()],
    whoami: () => ["user"],
    clear: () => [],
    echo: (args: string[]) => [args.join(" ")],
    cat: (args: string[]) => {
      const filename = args[0]
      if (!filename) return ["cat: missing file operand"]
      return [
        `Contents of ${filename}:`,
        "This is a sample file content.",
        "You can view file contents using the cat command.",
      ]
    },
    mkdir: (args: string[]) => {
      const dirname = args[0]
      if (!dirname) return ["mkdir: missing operand"]
      return [`Directory '${dirname}' created`]
    },
    touch: (args: string[]) => {
      const filename = args[0]
      if (!filename) return ["touch: missing file operand"]
      return [`File '${filename}' created`]
    },
    cd: (args: string[]) => {
      const dirname = args[0] || "~"
      return [`Changed directory to ${dirname}`]
    },
  }

  const executeCommand = (command: string) => {
    const trimmedCommand = command.trim()
    if (!trimmedCommand) return

    // Add command to history
    setCommandHistory((prev) => [...prev, trimmedCommand])
    setHistoryIndex(-1)

    // Add command line
    const commandLine: TerminalLine = {
      id: Date.now(),
      type: "command",
      content: `$ ${trimmedCommand}`,
      timestamp: new Date(),
    }

    const [cmd, ...args] = trimmedCommand.split(" ")

    if (cmd === "clear") {
      setLines([])
      return
    }

    let output: string[] = []
    if (cmd in commands) {
      const commandFunc = commands[cmd as keyof typeof commands]
      if (typeof commandFunc === "function") {
        output = commandFunc(args)
      }
    } else {
      output = [`Command not found: ${cmd}. Type 'help' for available commands.`]
    }

    const outputLines: TerminalLine[] = output.map((line, index) => ({
      id: Date.now() + index + 1,
      type: cmd in commands ? "output" : "error",
      content: line,
      timestamp: new Date(),
    }))

    setLines((prev) => [...prev, commandLine, ...outputLines])
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      executeCommand(currentCommand)
      setCurrentCommand("")
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      if (commandHistory.length > 0) {
        const newIndex = historyIndex === -1 ? commandHistory.length - 1 : Math.max(0, historyIndex - 1)
        setHistoryIndex(newIndex)
        setCurrentCommand(commandHistory[newIndex])
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault()
      if (historyIndex !== -1) {
        const newIndex = historyIndex + 1
        if (newIndex >= commandHistory.length) {
          setHistoryIndex(-1)
          setCurrentCommand("")
        } else {
          setHistoryIndex(newIndex)
          setCurrentCommand(commandHistory[newIndex])
        }
      }
    }
  }

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight
    }
  }, [lines])

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }, [])

  return (
    <div className="h-full bg-black text-green-400 font-mono flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-2 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-3">
          <div className="text-xl">⌨️</div>
          <h1 className="text-sm font-semibold text-white">Terminal Pro</h1>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="w-6 h-6 p-0 hover:bg-gray-700">
            <Minus className="h-3 w-3 text-white" />
          </Button>
          <Button variant="ghost" size="sm" className="w-6 h-6 p-0 hover:bg-gray-700">
            <Square className="h-3 w-3 text-white" />
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose} className="w-6 h-6 p-0 hover:bg-gray-700">
            <X className="h-3 w-3 text-white" />
          </Button>
        </div>
      </div>

      {/* Terminal Content */}
      <div ref={terminalRef} className="flex-1 p-4 overflow-y-auto">
        {lines.map((line) => (
          <div key={line.id} className={`mb-1 ${line.type === "error" ? "text-red-400" : "text-green-400"}`}>
            {line.content}
          </div>
        ))}

        {/* Current Input Line */}
        <div className="flex items-center">
          <span className="text-green-400 mr-2">$</span>
          <input
            ref={inputRef}
            type="text"
            value={currentCommand}
            onChange={(e) => setCurrentCommand(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent border-none outline-none text-green-400 font-mono"
            placeholder="Enter command..."
          />
        </div>
      </div>

      {/* Status Bar */}
      <div className="flex items-center justify-between px-3 py-1 bg-gray-800 border-t border-gray-700 text-xs text-gray-400">
        <div>Terminal Pro v2.13</div>
        <div>{lines.length} lines</div>
      </div>
    </div>
  )
}
