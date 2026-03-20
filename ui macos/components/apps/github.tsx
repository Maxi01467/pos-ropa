"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { X, GitBranch, GitCommit, GitPullRequest, Star, Eye, GitFork, Search, Plus } from "lucide-react"

interface Repository {
  id: number
  name: string
  description: string
  language: string
  stars: number
  forks: number
  watchers: number
  isPrivate: boolean
  lastCommit: string
}

interface Commit {
  id: string
  message: string
  author: string
  date: string
  hash: string
}

interface GitHubProps {
  onClose: () => void
}

export function GitHub({ onClose }: GitHubProps) {
  const [activeTab, setActiveTab] = useState("repositories")
  const [searchQuery, setSearchQuery] = useState("")

  const repositories: Repository[] = [
    {
      id: 1,
      name: "my-react-app",
      description: "A modern React application with TypeScript and Tailwind CSS",
      language: "TypeScript",
      stars: 42,
      forks: 8,
      watchers: 15,
      isPrivate: false,
      lastCommit: "2 hours ago",
    },
    {
      id: 2,
      name: "api-server",
      description: "RESTful API server built with Node.js and Express",
      language: "JavaScript",
      stars: 23,
      forks: 5,
      watchers: 8,
      isPrivate: true,
      lastCommit: "1 day ago",
    },
    {
      id: 3,
      name: "mobile-app",
      description: "Cross-platform mobile app using React Native",
      language: "JavaScript",
      stars: 67,
      forks: 12,
      watchers: 25,
      isPrivate: false,
      lastCommit: "3 days ago",
    },
  ]

  const commits: Commit[] = [
    {
      id: "1",
      message: "Add user authentication system",
      author: "john-doe",
      date: "2 hours ago",
      hash: "a1b2c3d",
    },
    {
      id: "2",
      message: "Fix responsive design issues",
      author: "jane-smith",
      date: "5 hours ago",
      hash: "e4f5g6h",
    },
    {
      id: "3",
      message: "Update dependencies to latest versions",
      author: "john-doe",
      date: "1 day ago",
      hash: "i7j8k9l",
    },
    {
      id: "4",
      message: "Implement dark mode toggle",
      author: "alex-dev",
      date: "2 days ago",
      hash: "m0n1o2p",
    },
  ]

  const pullRequests = [
    {
      id: 1,
      title: "Add search functionality",
      author: "contributor1",
      status: "open",
      comments: 3,
      date: "1 day ago",
    },
    {
      id: 2,
      title: "Fix memory leak in data processing",
      author: "contributor2",
      status: "merged",
      comments: 7,
      date: "3 days ago",
    },
  ]

  const getLanguageColor = (language: string) => {
    const colors: { [key: string]: string } = {
      TypeScript: "bg-blue-500",
      JavaScript: "bg-yellow-500",
      Python: "bg-green-500",
      Java: "bg-red-500",
      Go: "bg-cyan-500",
    }
    return colors[language] || "bg-gray-500"
  }

  const filteredRepos = repositories.filter(
    (repo) =>
      repo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      repo.description.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  return (
    <div className="h-full bg-white text-gray-900 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="text-2xl">🐙</div>
          <h1 className="text-lg font-semibold">GitHub Desktop</h1>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} className="hover:bg-gray-100">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Navigation */}
      <div className="flex items-center gap-1 p-2 border-b border-gray-200">
        <Button
          variant={activeTab === "repositories" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("repositories")}
          className={activeTab === "repositories" ? "bg-blue-500 text-white" : ""}
        >
          <GitBranch className="h-4 w-4 mr-1" />
          Repositories
        </Button>
        <Button
          variant={activeTab === "commits" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("commits")}
          className={activeTab === "commits" ? "bg-blue-500 text-white" : ""}
        >
          <GitCommit className="h-4 w-4 mr-1" />
          Commits
        </Button>
        <Button
          variant={activeTab === "pulls" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("pulls")}
          className={activeTab === "pulls" ? "bg-blue-500 text-white" : ""}
        >
          <GitPullRequest className="h-4 w-4 mr-1" />
          Pull Requests
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === "repositories" && (
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search repositories..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button className="bg-green-600 hover:bg-green-700 text-white">
                <Plus className="h-4 w-4 mr-1" />
                New Repository
              </Button>
            </div>

            <div className="space-y-4">
              {filteredRepos.map((repo) => (
                <div key={repo.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold text-blue-600 hover:underline cursor-pointer">
                        {repo.name}
                      </h3>
                      {repo.isPrivate && <Badge variant="secondary">Private</Badge>}
                    </div>
                    <div className="text-sm text-gray-500">{repo.lastCommit}</div>
                  </div>

                  <p className="text-gray-600 mb-3">{repo.description}</p>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1">
                        <div className={`w-3 h-3 rounded-full ${getLanguageColor(repo.language)}`}></div>
                        <span className="text-sm text-gray-600">{repo.language}</span>
                      </div>
                      <div className="flex items-center gap-1 text-sm text-gray-600">
                        <Star className="h-4 w-4" />
                        {repo.stars}
                      </div>
                      <div className="flex items-center gap-1 text-sm text-gray-600">
                        <GitFork className="h-4 w-4" />
                        {repo.forks}
                      </div>
                      <div className="flex items-center gap-1 text-sm text-gray-600">
                        <Eye className="h-4 w-4" />
                        {repo.watchers}
                      </div>
                    </div>
                    <Button variant="outline" size="sm">
                      Clone
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "commits" && (
          <div className="p-4">
            <h2 className="text-xl font-semibold mb-4">Recent Commits</h2>
            <div className="space-y-3">
              {commits.map((commit) => (
                <div key={commit.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900 mb-1">{commit.message}</h3>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span>{commit.author}</span>
                        <span>{commit.date}</span>
                        <code className="bg-gray-100 px-2 py-1 rounded text-xs">{commit.hash}</code>
                      </div>
                    </div>
                    <GitCommit className="h-5 w-5 text-gray-400 mt-1" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "pulls" && (
          <div className="p-4">
            <h2 className="text-xl font-semibold mb-4">Pull Requests</h2>
            <div className="space-y-3">
              {pullRequests.map((pr) => (
                <div key={pr.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium text-gray-900">{pr.title}</h3>
                        <Badge variant={pr.status === "open" ? "default" : "secondary"}>{pr.status}</Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span>by {pr.author}</span>
                        <span>{pr.comments} comments</span>
                        <span>{pr.date}</span>
                      </div>
                    </div>
                    <GitPullRequest className="h-5 w-5 text-gray-400 mt-1" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
