"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { X, Plus, Save, FileText, Calculator, BarChart3 } from "lucide-react"

interface Cell {
  value: string
  formula?: string
}

interface ExcelProps {
  onClose: () => void
}

export function Excel({ onClose }: ExcelProps) {
  const [cells, setCells] = useState<{ [key: string]: Cell }>({
    A1: { value: "Product" },
    B1: { value: "Price" },
    C1: { value: "Quantity" },
    D1: { value: "Total" },
    A2: { value: "Laptop" },
    B2: { value: "999" },
    C2: { value: "5" },
    D2: { value: "4995", formula: "=B2*C2" },
    A3: { value: "Mouse" },
    B3: { value: "25" },
    C3: { value: "10" },
    D3: { value: "250", formula: "=B3*C3" },
  })

  const [selectedCell, setSelectedCell] = useState("A1")
  const [formulaBar, setFormulaBar] = useState("")

  const columns = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"]
  const rows = Array.from({ length: 20 }, (_, i) => i + 1)

  const getCellId = (col: string, row: number) => `${col}${row}`

  const handleCellClick = (cellId: string) => {
    setSelectedCell(cellId)
    const cell = cells[cellId]
    setFormulaBar(cell?.formula || cell?.value || "")
  }

  const handleCellChange = (cellId: string, value: string) => {
    setCells((prev) => ({
      ...prev,
      [cellId]: { value, formula: value.startsWith("=") ? value : undefined },
    }))
  }

  const handleFormulaSubmit = () => {
    if (formulaBar.startsWith("=")) {
      // Simple formula evaluation for demo
      const result = evaluateFormula(formulaBar)
      setCells((prev) => ({
        ...prev,
        [selectedCell]: { value: result.toString(), formula: formulaBar },
      }))
    } else {
      setCells((prev) => ({
        ...prev,
        [selectedCell]: { value: formulaBar },
      }))
    }
  }

  const evaluateFormula = (formula: string): number => {
    // Simple formula parser for demo (B2*C2, etc.)
    const cellRefs = formula.match(/[A-Z]\d+/g) || []
    let expression = formula.substring(1) // Remove =

    cellRefs.forEach((ref) => {
      const cellValue = cells[ref]?.value || "0"
      expression = expression.replace(ref, cellValue)
    })

    try {
      return eval(expression)
    } catch {
      return 0
    }
  }

  return (
    <div className="h-full bg-white/20 backdrop-blur-xl border border-white/30 rounded-xl overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-white/20 bg-white/10">
        <div className="flex items-center gap-3">
          <div className="text-2xl">📊</div>
          <h1 className="text-lg font-semibold text-gray-800">Microsoft Excel</h1>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} className="hover:bg-white/20">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 p-2 border-b border-white/20 bg-white/5">
        <Button size="sm" variant="ghost" className="hover:bg-white/20">
          <Save className="h-4 w-4 mr-1" />
          Save
        </Button>
        <Button size="sm" variant="ghost" className="hover:bg-white/20">
          <FileText className="h-4 w-4 mr-1" />
          New
        </Button>
        <Button size="sm" variant="ghost" className="hover:bg-white/20">
          <Plus className="h-4 w-4 mr-1" />
          Insert
        </Button>
        <Button size="sm" variant="ghost" className="hover:bg-white/20">
          <BarChart3 className="h-4 w-4 mr-1" />
          Chart
        </Button>
        <Button size="sm" variant="ghost" className="hover:bg-white/20">
          <Calculator className="h-4 w-4 mr-1" />
          Functions
        </Button>
      </div>

      {/* Formula Bar */}
      <div className="flex items-center gap-2 p-2 border-b border-white/20 bg-white/5">
        <div className="w-16 text-sm font-medium text-gray-700">{selectedCell}</div>
        <Input
          value={formulaBar}
          onChange={(e) => setFormulaBar(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleFormulaSubmit()}
          placeholder="Enter formula or value..."
          className="flex-1 bg-white/30 border-white/30"
        />
      </div>

      {/* Spreadsheet */}
      <div className="flex-1 overflow-auto">
        <div className="inline-block min-w-full">
          {/* Column Headers */}
          <div className="flex sticky top-0 bg-white/20 border-b border-white/20">
            <div className="w-12 h-8 border-r border-white/20 bg-white/10"></div>
            {columns.map((col) => (
              <div
                key={col}
                className="w-24 h-8 border-r border-white/20 flex items-center justify-center text-sm font-medium text-gray-700 bg-white/10"
              >
                {col}
              </div>
            ))}
          </div>

          {/* Rows */}
          {rows.map((row) => (
            <div key={row} className="flex">
              {/* Row Header */}
              <div className="w-12 h-8 border-r border-b border-white/20 flex items-center justify-center text-sm font-medium text-gray-700 bg-white/10">
                {row}
              </div>

              {/* Cells */}
              {columns.map((col) => {
                const cellId = getCellId(col, row)
                const cell = cells[cellId]
                const isSelected = selectedCell === cellId

                return (
                  <div
                    key={cellId}
                    className={`w-24 h-8 border-r border-b border-white/20 relative ${
                      isSelected ? "bg-blue-200/50 ring-2 ring-blue-400" : "hover:bg-white/20"
                    }`}
                    onClick={() => handleCellClick(cellId)}
                  >
                    <input
                      type="text"
                      value={cell?.value || ""}
                      onChange={(e) => handleCellChange(cellId, e.target.value)}
                      className="w-full h-full px-1 text-sm bg-transparent border-none outline-none"
                      onFocus={() => handleCellClick(cellId)}
                    />
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Status Bar */}
      <div className="flex items-center justify-between p-2 border-t border-white/20 bg-white/5 text-sm text-gray-600">
        <div>Ready</div>
        <div>Sheet 1 of 1</div>
      </div>
    </div>
  )
}
