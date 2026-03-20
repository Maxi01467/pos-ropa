"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { X, Search, FileText, Folder, Play, Bug, GitBranch, Settings } from "lucide-react"

interface File {
  id: string
  name: string
  type: "file" | "folder"
  content?: string
  children?: File[]
}

interface VSCodeProps {
  onClose: () => void
}

export function VSCode({ onClose }: VSCodeProps) {
  const [selectedFile, setSelectedFile] = useState<string | null>("app.tsx")
  const [searchQuery, setSearchQuery] = useState("")

  const fileTree: File[] = [
    {
      id: "src",
      name: "src",
      type: "folder",
      children: [
        {
          id: "app.tsx",
          name: "App.tsx",
          type: "file",
          content: `import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import Home from './pages/Home';
import About from './pages/About';

function App() {
  return (
    <Router>
      <div className="App">
        <Header />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;`,
        },
        {
          id: "components",
          name: "components",
          type: "folder",
          children: [
            {
              id: "header.tsx",
              name: "Header.tsx",
              type: "file",
              content: `import React from 'react';
import './Header.css';

const Header: React.FC = () => {
  return (
    <header className="header">
      <nav>
        <ul>
          <li><a href="/">Home</a></li>
          <li><a href="/about">About</a></li>
        </ul>
      </nav>
    </header>
  );
};

export default Header;`,
            },
          ],
        },
      ],
    },
    {
      id: "package.json",
      name: "package.json",
      type: "file",
      content: `{
  "name": "my-react-app",
  "version": "1.0.0",
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.8.0"
  },
  "scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build",
    "test": "react-scripts test"
  }
}`,
    },
  ]

  const flattenFiles = (files: File[]): File[] => {
    const result: File[] = []
    files.forEach((file) => {
      result.push(file)
      if (file.children) {
        result.push(...flattenFiles(file.children))
      }
    })
    return result
  }

  const allFiles = flattenFiles(fileTree)
  const currentFile = allFiles.find((f) => f.id === selectedFile)

  const renderFileTree = (files: File[], depth = 0) => {
    return files.map((file) => (
      <div key={file.id}>
        <div
          className={`flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-gray-700 ${
            selectedFile === file.id ? "bg-blue-600" : ""
          }`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => file.type === "file" && setSelectedFile(file.id)}
        >
          {file.type === "folder" ? (
            <Folder className="h-4 w-4 text-blue-400" />
          ) : (
            <FileText className="h-4 w-4 text-gray-400" />
          )}
          <span className="text-sm">{file.name}</span>
        </div>
        {file.children && renderFileTree(file.children, depth + 1)}
      </div>
    ))
  }

  return (
    <div className="h-full bg-gray-900 text-white flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-2 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-3">
          <div className="text-xl">💻</div>
          <h1 className="text-sm font-semibold">Visual Studio Code</h1>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} className="hover:bg-gray-700">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Menu Bar */}
      <div className="flex items-center gap-4 px-3 py-1 bg-gray-800 border-b border-gray-700 text-sm">
        <span className="hover:bg-gray-700 px-2 py-1 rounded cursor-pointer">File</span>
        <span className="hover:bg-gray-700 px-2 py-1 rounded cursor-pointer">Edit</span>
        <span className="hover:bg-gray-700 px-2 py-1 rounded cursor-pointer">View</span>
        <span className="hover:bg-gray-700 px-2 py-1 rounded cursor-pointer">Go</span>
        <span className="hover:bg-gray-700 px-2 py-1 rounded cursor-pointer">Run</span>
        <span className="hover:bg-gray-700 px-2 py-1 rounded cursor-pointer">Terminal</span>
      </div>

      <div className="flex flex-1">
        {/* Activity Bar */}
        <div className="w-12 bg-gray-800 border-r border-gray-700 flex flex-col items-center py-2 gap-3">
          <Button variant="ghost" size="sm" className="w-10 h-10 p-0 hover:bg-gray-700">
            <FileText className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="sm" className="w-10 h-10 p-0 hover:bg-gray-700">
            <Search className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="sm" className="w-10 h-10 p-0 hover:bg-gray-700">
            <GitBranch className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="sm" className="w-10 h-10 p-0 hover:bg-gray-700">
            <Play className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="sm" className="w-10 h-10 p-0 hover:bg-gray-700">
            <Bug className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="sm" className="w-10 h-10 p-0 hover:bg-gray-700 mt-auto">
            <Settings className="h-5 w-5" />
          </Button>
        </div>

        {/* Sidebar */}
        <div className="w-64 bg-gray-800 border-r border-gray-700">
          <div className="p-3 border-b border-gray-700">
            <h3 className="text-sm font-semibold mb-2">EXPLORER</h3>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-gray-400" />
              <Input
                placeholder="Search files..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-7 h-7 text-xs bg-gray-700 border-gray-600"
              />
            </div>
          </div>

          <div className="overflow-y-auto">{renderFileTree(fileTree)}</div>
        </div>

        {/* Main Editor */}
        <div className="flex-1 flex flex-col">
          {/* Tab Bar */}
          <div className="flex bg-gray-800 border-b border-gray-700">
            {selectedFile && (
              <div className="flex items-center gap-2 px-3 py-2 bg-gray-700 border-r border-gray-600">
                <FileText className="h-3 w-3" />
                <span className="text-sm">{currentFile?.name}</span>
                <Button variant="ghost" size="sm" className="w-4 h-4 p-0 hover:bg-gray-600">
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>

          {/* Editor Content */}
          <div className="flex-1 p-4 bg-gray-900 overflow-auto">
            {currentFile ? (
              <pre className="text-sm font-mono leading-relaxed">
                <code className="text-gray-300">{currentFile.content}</code>
              </pre>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                <div className="text-center">
                  <div className="text-6xl mb-4">💻</div>
                  <div className="text-lg">Welcome to VS Code</div>
                  <div className="text-sm">Select a file to start editing</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <div className="flex items-center justify-between px-3 py-1 bg-blue-600 text-white text-xs">
        <div className="flex items-center gap-4">
          <span>main</span>
          <span>TypeScript React</span>
          <span>UTF-8</span>
        </div>
        <div className="flex items-center gap-4">
          <span>Ln 1, Col 1</span>
          <span>Spaces: 2</span>
        </div>
      </div>
    </div>
  )
}
