"use client"

import { useState } from "react"
import {
  Search,
  Star,
  Archive,
  Trash2,
  Reply,
  Forward,
  MoreHorizontal,
  Paperclip,
  Send,
  Inbox,
  SendIcon as Sent,
  DraftingCompassIcon as Drafts,
  Flag,
} from "lucide-react"

interface MailProps {
  onClose: () => void
}

interface Email {
  id: string
  from: string
  subject: string
  preview: string
  time: string
  isRead: boolean
  isStarred: boolean
  isFlagged: boolean
  hasAttachment: boolean
  folder: string
}

const mockEmails: Email[] = [
  {
    id: "1",
    from: "Apple",
    subject: "Welcome to macOS Tahoe",
    preview: "Discover the new Liquid Glass design language and enhanced features in macOS Tahoe...",
    time: "9:30 AM",
    isRead: false,
    isStarred: true,
    isFlagged: false,
    hasAttachment: false,
    folder: "inbox",
  },
  {
    id: "2",
    from: "GitHub",
    subject: "Your weekly digest",
    preview: "Here's what happened in your repositories this week. 15 new commits, 3 pull requests...",
    time: "Yesterday",
    isRead: true,
    isStarred: false,
    isFlagged: true,
    hasAttachment: true,
    folder: "inbox",
  },
  {
    id: "3",
    from: "Vercel",
    subject: "Deployment successful",
    preview: "Your project has been successfully deployed to production. View your live site...",
    time: "2 days ago",
    isRead: true,
    isStarred: false,
    isFlagged: false,
    hasAttachment: false,
    folder: "inbox",
  },
  {
    id: "4",
    from: "Team",
    subject: "Project update meeting",
    preview: "Let's schedule a meeting to discuss the latest project updates and next steps...",
    time: "3 days ago",
    isRead: false,
    isStarred: false,
    isFlagged: false,
    hasAttachment: true,
    folder: "inbox",
  },
]

export function Mail({ onClose }: MailProps) {
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null)
  const [emails, setEmails] = useState(mockEmails)
  const [selectedFolder, setSelectedFolder] = useState("inbox")
  const [searchQuery, setSearchQuery] = useState("")
  const [isComposing, setIsComposing] = useState(false)

  const folders = [
    {
      name: "inbox",
      label: "Inbox",
      icon: Inbox,
      count: emails.filter((e) => e.folder === "inbox" && !e.isRead).length,
    },
    { name: "sent", label: "Sent", icon: Sent, count: 0 },
    { name: "drafts", label: "Drafts", icon: Drafts, count: 2 },
    { name: "starred", label: "Starred", icon: Star, count: emails.filter((e) => e.isStarred).length },
    { name: "trash", label: "Trash", icon: Trash2, count: 0 },
  ]

  const filteredEmails = emails.filter((email) => {
    const matchesFolder = selectedFolder === "starred" ? email.isStarred : email.folder === selectedFolder
    const matchesSearch =
      email.from.toLowerCase().includes(searchQuery.toLowerCase()) ||
      email.subject.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesFolder && matchesSearch
  })

  const toggleStar = (emailId: string) => {
    setEmails((prev) => prev.map((email) => (email.id === emailId ? { ...email, isStarred: !email.isStarred } : email)))
  }

  const markAsRead = (emailId: string) => {
    setEmails((prev) => prev.map((email) => (email.id === emailId ? { ...email, isRead: true } : email)))
  }

  return (
    <div className="h-full bg-white/5 backdrop-blur-xl border border-white/20 rounded-xl overflow-hidden flex flex-col">
      {/* Header */}
      <div className="bg-white/10 border-b border-white/20 p-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <button onClick={onClose} className="w-3 h-3 bg-red-500 rounded-full hover:bg-red-400 transition-colors" />
            <button className="w-3 h-3 bg-yellow-500 rounded-full hover:bg-yellow-400 transition-colors" />
            <button className="w-3 h-3 bg-green-500 rounded-full hover:bg-green-400 transition-colors" />
          </div>
          <span className="text-white/80 text-sm font-medium">Mail</span>
          <div className="w-16" />
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsComposing(true)}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors text-sm font-medium"
            >
              Compose
            </button>
            <button className="p-2 hover:bg-white/10 rounded transition-colors">
              <Archive className="w-4 h-4 text-white/80" />
            </button>
            <button className="p-2 hover:bg-white/10 rounded transition-colors">
              <Trash2 className="w-4 h-4 text-white/80" />
            </button>
          </div>

          <div className="flex-1 max-w-md mx-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-white/50" />
              <input
                type="text"
                placeholder="Search mail"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-400/50"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div className="w-64 bg-white/5 border-r border-white/20 p-4">
          <div className="space-y-2">
            {folders.map((folder) => (
              <button
                key={folder.name}
                onClick={() => setSelectedFolder(folder.name)}
                className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors ${
                  selectedFolder === folder.name ? "bg-blue-500/20 text-white" : "hover:bg-white/10 text-white/80"
                }`}
              >
                <div className="flex items-center space-x-3">
                  <folder.icon className="w-4 h-4" />
                  <span className="text-sm font-medium">{folder.label}</span>
                </div>
                {folder.count > 0 && (
                  <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full">{folder.count}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Email List */}
        <div className="w-80 bg-white/5 border-r border-white/20 overflow-y-auto">
          <div className="p-4">
            <h2 className="text-white font-semibold mb-4 capitalize">{selectedFolder}</h2>
            <div className="space-y-2">
              {filteredEmails.map((email) => (
                <div
                  key={email.id}
                  onClick={() => {
                    setSelectedEmail(email)
                    markAsRead(email.id)
                  }}
                  className={`p-3 rounded-lg cursor-pointer transition-colors border ${
                    selectedEmail?.id === email.id
                      ? "bg-blue-500/20 border-blue-400/50"
                      : "hover:bg-white/10 border-transparent"
                  } ${!email.isRead ? "bg-white/5" : ""}`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <span className={`text-sm font-medium ${!email.isRead ? "text-white" : "text-white/80"}`}>
                        {email.from}
                      </span>
                      {!email.isRead && <div className="w-2 h-2 bg-blue-500 rounded-full" />}
                    </div>
                    <div className="flex items-center space-x-1">
                      {email.hasAttachment && <Paperclip className="w-3 h-3 text-white/60" />}
                      {email.isFlagged && <Flag className="w-3 h-3 text-orange-400" />}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleStar(email.id)
                        }}
                        className="hover:scale-110 transition-transform"
                      >
                        <Star
                          className={`w-3 h-3 ${email.isStarred ? "text-yellow-400 fill-current" : "text-white/60"}`}
                        />
                      </button>
                    </div>
                  </div>
                  <div className={`text-sm mb-1 ${!email.isRead ? "text-white font-medium" : "text-white/80"}`}>
                    {email.subject}
                  </div>
                  <div className="text-xs text-white/60 mb-2 line-clamp-2">{email.preview}</div>
                  <div className="text-xs text-white/50">{email.time}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Email Content */}
        <div className="flex-1 flex flex-col">
          {selectedEmail ? (
            <>
              <div className="bg-white/5 border-b border-white/20 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h1 className="text-lg font-semibold text-white">{selectedEmail.subject}</h1>
                  <div className="flex items-center space-x-2">
                    <button className="p-2 hover:bg-white/10 rounded transition-colors">
                      <Reply className="w-4 h-4 text-white/80" />
                    </button>
                    <button className="p-2 hover:bg-white/10 rounded transition-colors">
                      <Forward className="w-4 h-4 text-white/80" />
                    </button>
                    <button className="p-2 hover:bg-white/10 rounded transition-colors">
                      <MoreHorizontal className="w-4 h-4 text-white/80" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm text-white/80">
                  <div>From: {selectedEmail.from}</div>
                  <div>{selectedEmail.time}</div>
                </div>
              </div>
              <div className="flex-1 p-6 overflow-y-auto">
                <div className="text-white/90 leading-relaxed">
                  <p className="mb-4">{selectedEmail.preview}</p>
                  <p className="mb-4">
                    Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore
                    et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.
                  </p>
                  <p className="mb-4">
                    Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla
                    pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit
                    anim id est laborum.
                  </p>
                  <p>
                    Best regards,
                    <br />
                    {selectedEmail.from}
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Inbox className="w-16 h-16 text-white/40 mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-white/80 mb-2">No email selected</h2>
                <p className="text-white/60">Choose an email from the list to read it</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Compose Modal */}
      {isComposing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="w-full max-w-2xl bg-white/10 backdrop-blur-xl border border-white/20 rounded-xl overflow-hidden">
            <div className="bg-white/10 border-b border-white/20 p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-white font-semibold">New Message</h3>
                <button
                  onClick={() => setIsComposing(false)}
                  className="text-white/60 hover:text-white transition-colors"
                >
                  ×
                </button>
              </div>
            </div>
            <div className="p-4 space-y-4">
              <input
                type="email"
                placeholder="To:"
                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-400/50"
              />
              <input
                type="text"
                placeholder="Subject:"
                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-400/50"
              />
              <textarea
                placeholder="Message:"
                rows={8}
                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-400/50 resize-none"
              />
              <div className="flex items-center justify-between">
                <button className="p-2 hover:bg-white/10 rounded transition-colors">
                  <Paperclip className="w-4 h-4 text-white/80" />
                </button>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setIsComposing(false)}
                    className="px-4 py-2 hover:bg-white/10 rounded transition-colors text-white/80"
                  >
                    Cancel
                  </button>
                  <button className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors flex items-center space-x-2">
                    <Send className="w-4 h-4" />
                    <span>Send</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
