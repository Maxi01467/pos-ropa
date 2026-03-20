"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { X, RotateCcw, Flag } from "lucide-react"

type PieceType = "king" | "queen" | "rook" | "bishop" | "knight" | "pawn"
type PieceColor = "white" | "black"

interface Piece {
  type: PieceType
  color: PieceColor
}

interface ChessProps {
  onClose: () => void
}

export function Chess({ onClose }: ChessProps) {
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null)
  const [currentPlayer, setCurrentPlayer] = useState<PieceColor>("white")
  const [gameStatus, setGameStatus] = useState<"playing" | "check" | "checkmate" | "draw">("playing")

  const initialBoard: { [key: string]: Piece } = {
    a8: { type: "rook", color: "black" },
    b8: { type: "knight", color: "black" },
    c8: { type: "bishop", color: "black" },
    d8: { type: "queen", color: "black" },
    e8: { type: "king", color: "black" },
    f8: { type: "bishop", color: "black" },
    g8: { type: "knight", color: "black" },
    h8: { type: "rook", color: "black" },
    a7: { type: "pawn", color: "black" },
    b7: { type: "pawn", color: "black" },
    c7: { type: "pawn", color: "black" },
    d7: { type: "pawn", color: "black" },
    e7: { type: "pawn", color: "black" },
    f7: { type: "pawn", color: "black" },
    g7: { type: "pawn", color: "black" },
    h7: { type: "pawn", color: "black" },
    a1: { type: "rook", color: "white" },
    b1: { type: "knight", color: "white" },
    c1: { type: "bishop", color: "white" },
    d1: { type: "queen", color: "white" },
    e1: { type: "king", color: "white" },
    f1: { type: "bishop", color: "white" },
    g1: { type: "knight", color: "white" },
    h1: { type: "rook", color: "white" },
    a2: { type: "pawn", color: "white" },
    b2: { type: "pawn", color: "white" },
    c2: { type: "pawn", color: "white" },
    d2: { type: "pawn", color: "white" },
    e2: { type: "pawn", color: "white" },
    f2: { type: "pawn", color: "white" },
    g2: { type: "pawn", color: "white" },
    h2: { type: "pawn", color: "white" },
  }

  const [board, setBoard] = useState(initialBoard)

  const getPieceSymbol = (piece: Piece): string => {
    const symbols = {
      white: {
        king: "🤴🏻",
        queen: "👸🏻",
        rook: "🏰",
        bishop: "⛪",
        knight: "🐎",
        pawn: "👤",
      },
      black: {
        king: "🤴🏿",
        queen: "👸🏿",
        rook: "🏯",
        bishop: "🕌",
        knight: "🐴",
        pawn: "👥",
      },
    }
    return symbols[piece.color][piece.type]
  }

  const handleSquareClick = (square: string) => {
    if (selectedSquare === square) {
      setSelectedSquare(null)
      return
    }

    if (selectedSquare) {
      // Attempt to move piece
      const piece = board[selectedSquare]
      if (piece && piece.color === currentPlayer) {
        const newBoard = { ...board }
        delete newBoard[selectedSquare]
        newBoard[square] = piece
        setBoard(newBoard)
        setCurrentPlayer(currentPlayer === "white" ? "black" : "white")
      }
      setSelectedSquare(null)
    } else {
      // Select piece
      const piece = board[square]
      if (piece && piece.color === currentPlayer) {
        setSelectedSquare(square)
      }
    }
  }

  const resetGame = () => {
    setBoard(initialBoard)
    setCurrentPlayer("white")
    setSelectedSquare(null)
    setGameStatus("playing")
  }

  const files = ["a", "b", "c", "d", "e", "f", "g", "h"]
  const ranks = ["8", "7", "6", "5", "4", "3", "2", "1"]

  return (
    <div className="h-full bg-gradient-to-br from-emerald-50 to-emerald-100 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-emerald-900 text-white">
        <div className="flex items-center gap-3">
          <div className="text-2xl">♟️</div>
          <h1 className="text-lg font-semibold">Chess Master</h1>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} className="hover:bg-emerald-800 text-white">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Game Info */}
      <div className="flex items-center justify-between p-4 bg-emerald-100 border-b border-emerald-200">
        <div className="flex items-center gap-4">
          <div className="text-lg font-semibold">
            Current Player:{" "}
            <span className={currentPlayer === "white" ? "text-gray-800" : "text-gray-600"}>
              {currentPlayer === "white" ? "White" : "Black"}
            </span>
          </div>
          {gameStatus !== "playing" && (
            <div className="text-lg font-bold text-red-600">
              {gameStatus === "check" && "Check!"}
              {gameStatus === "checkmate" && "Checkmate!"}
              {gameStatus === "draw" && "Draw!"}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <Button onClick={resetGame} variant="outline" size="sm">
            <RotateCcw className="h-4 w-4 mr-1" />
            New Game
          </Button>
          <Button variant="outline" size="sm">
            <Flag className="h-4 w-4 mr-1" />
            Resign
          </Button>
        </div>
      </div>

      {/* Chess Board */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="bg-emerald-800 p-4 rounded-lg shadow-2xl">
          <div className="grid grid-cols-8 gap-0 border-2 border-emerald-900">
            {ranks.map((rank) =>
              files.map((file) => {
                const square = `${file}${rank}`
                const isLight = (files.indexOf(file) + ranks.indexOf(rank)) % 2 === 0
                const piece = board[square]
                const isSelected = selectedSquare === square

                return (
                  <div
                    key={square}
                    onClick={() => handleSquareClick(square)}
                    className={`
                      w-16 h-16 flex items-center justify-center text-2xl cursor-pointer relative
                      ${isLight ? "bg-emerald-100" : "bg-emerald-600"}
                      ${isSelected ? "ring-4 ring-blue-400" : ""}
                      hover:brightness-110 transition-all
                    `}
                  >
                    {piece && (
                      <span
                        className={`select-none drop-shadow-lg transform hover:scale-110 transition-transform ${piece.color === "white" ? "filter brightness-110" : "filter brightness-90"}`}
                      >
                        {getPieceSymbol(piece)}
                      </span>
                    )}

                    {/* Square coordinates */}
                    {rank === "1" && (
                      <div className="absolute bottom-0 right-1 text-xs text-emerald-800 font-bold">{file}</div>
                    )}
                    {file === "a" && (
                      <div className="absolute top-1 left-1 text-xs text-emerald-800 font-bold">{rank}</div>
                    )}
                  </div>
                )
              }),
            )}
          </div>
        </div>
      </div>

      {/* Game Controls */}
      <div className="p-4 bg-emerald-100 border-t border-emerald-200">
        <div className="flex items-center justify-between">
          <div className="text-sm text-emerald-800">
            Click on a piece to select it, then click on a destination square to move.
          </div>
          <div className="flex items-center gap-4 text-sm text-emerald-800">
            <div>Move: {Math.floor((Object.keys(initialBoard).length - Object.keys(board).length) / 2) + 1}</div>
            <div>Captured: {Object.keys(initialBoard).length - Object.keys(board).length}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
