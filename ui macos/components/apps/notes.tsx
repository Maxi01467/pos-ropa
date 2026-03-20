"use client"

import { useState } from "react"
import { X, Plus, Search, Edit3, Trash2, Save } from "lucide-react"

interface Note {
  id: string
  title: string
  content: string
  lastModified: Date
}

interface NotesProps {
  onClose: () => void
}

export function Notes({ onClose }: NotesProps) {
  const [notes, setNotes] = useState<Note[]>([
    {
      id: "1",
      title: "Welcome to Notes",
      content:
        "This is your first note! You can create, edit, and delete notes here. The interface uses the beautiful Liquid Glass design language.",
      lastModified: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes ago
    },
    {
      id: "2",
      title: "Meeting Notes",
      content:
        "Discuss the new macOS Tahoe features:\n- Liquid Glass design\n- Enhanced transparency\n- Improved performance\n- Better accessibility",
      lastModified: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
    },
    {
      id: "3",
      title: "Shopping List",
      content: "• Groceries\n• Office supplies\n• Birthday gift for Sarah\n• New laptop charger",
      lastModified: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
    },
  ])

  const [selectedNote, setSelectedNote] = useState<Note | null>(notes[0])
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState("")
  const [editTitle, setEditTitle] = useState("")
  const [searchQuery, setSearchQuery] = useState("")

  const filteredNotes = notes.filter(
    (note) =>
      note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.content.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const createNewNote = () => {
    const newNote: Note = {
      id: Date.now().toString(),
      title: "Untitled Note",
      content: "",
      lastModified: new Date(),
    }
    setNotes((prev) => [newNote, ...prev])
    setSelectedNote(newNote)
    setIsEditing(true)
    setEditTitle(newNote.title)
    setEditContent(newNote.content)
  }

  const startEditing = () => {
    if (selectedNote) {
      setIsEditing(true)
      setEditTitle(selectedNote.title)
      setEditContent(selectedNote.content)
    }
  }

  const saveNote = () => {
    if (selectedNote) {
      const updatedNote = {
        ...selectedNote,
        title: editTitle || "Untitled Note",
        content: editContent,
        lastModified: new Date(),
      }
      setNotes((prev) => prev.map((note) => (note.id === selectedNote.id ? updatedNote : note)))
      setSelectedNote(updatedNote)
      setIsEditing(false)
    }
  }

  const deleteNote = (noteId: string) => {
    setNotes((prev) => prev.filter((note) => note.id !== noteId))
    if (selectedNote?.id === noteId) {
      const remainingNotes = notes.filter((note) => note.id !== noteId)
      setSelectedNote(remainingNotes[0] || null)
    }
  }

  const formatDate = (date: Date) => {
    const now = new Date()
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)

    if (diffInHours < 1) {
      return "Just now"
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)} hours ago`
    } else {
      return date.toLocaleDateString()
    }
  }

  return (
    <div className="flex-1 p-6">
      <div className="max-w-6xl mx-auto h-full">
        <div className="bg-white/20 backdrop-blur-xl border border-white/30 rounded-2xl shadow-2xl overflow-hidden h-full flex flex-col">
          {/* Title Bar */}
          <div className="flex items-center justify-between p-4 bg-white/10 border-b border-white/20">
            <h2 className="text-lg font-semibold text-gray-800">Notes</h2>
            <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-full transition-colors">
              <X className="w-4 h-4 text-gray-600" />
            </button>
          </div>

          <div className="flex flex-1 overflow-hidden">
            {/* Sidebar */}
            <div className="w-80 bg-white/10 border-r border-white/20 flex flex-col">
              {/* Search and New Note */}
              <div className="p-4 space-y-3">
                <button
                  onClick={createNewNote}
                  className="w-full flex items-center gap-2 px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg transition-colors font-medium"
                >
                  <Plus className="w-4 h-4" />
                  New Note
                </button>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    placeholder="Search notes..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-white/20 border border-white/30 rounded-lg text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 backdrop-blur-sm"
                  />
                </div>
              </div>

              {/* Notes List */}
              <div className="flex-1 overflow-y-auto">
                {filteredNotes.map((note) => (
                  <button
                    key={note.id}
                    onClick={() => {
                      setSelectedNote(note)
                      setIsEditing(false)
                    }}
                    className={`w-full text-left p-4 border-b border-white/10 hover:bg-white/10 transition-colors ${
                      selectedNote?.id === note.id ? "bg-white/20" : ""
                    }`}
                  >
                    <h3 className="font-medium text-gray-800 truncate mb-1">{note.title}</h3>
                    <p className="text-sm text-gray-600 line-clamp-2 mb-2">{note.content}</p>
                    <p className="text-xs text-gray-500">{formatDate(note.lastModified)}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col">
              {selectedNote ? (
                <>
                  {/* Note Header */}
                  <div className="p-4 bg-white/5 border-b border-white/20 flex items-center justify-between">
                    <div className="flex-1">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className="text-xl font-semibold text-gray-800 bg-transparent border-none outline-none w-full"
                          placeholder="Note title..."
                        />
                      ) : (
                        <h1 className="text-xl font-semibold text-gray-800">{selectedNote.title}</h1>
                      )}
                      <p className="text-sm text-gray-500 mt-1">
                        Last modified {formatDate(selectedNote.lastModified)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {isEditing ? (
                        <button
                          onClick={saveNote}
                          className="flex items-center gap-2 px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors text-sm"
                        >
                          <Save className="w-4 h-4" />
                          Save
                        </button>
                      ) : (
                        <button
                          onClick={startEditing}
                          className="flex items-center gap-2 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors text-sm"
                        >
                          <Edit3 className="w-4 h-4" />
                          Edit
                        </button>
                      )}
                      <button
                        onClick={() => deleteNote(selectedNote.id)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors text-sm"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </button>
                    </div>
                  </div>

                  {/* Note Content */}
                  <div className="flex-1 p-6">
                    {isEditing ? (
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="w-full h-full bg-transparent border-none outline-none text-gray-800 resize-none text-base leading-relaxed"
                        placeholder="Start writing your note..."
                      />
                    ) : (
                      <div className="h-full overflow-y-auto">
                        <pre className="text-gray-800 text-base leading-relaxed whitespace-pre-wrap font-sans">
                          {selectedNote.content}
                        </pre>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Edit3 className="w-8 h-8 text-yellow-600" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-800 mb-2">No Note Selected</h3>
                    <p className="text-gray-600">Choose a note from the sidebar or create a new one</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
