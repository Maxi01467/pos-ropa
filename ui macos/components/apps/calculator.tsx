"use client"

import { useState } from "react"
import { X } from "lucide-react"

interface CalculatorProps {
  onClose: () => void
}

export function Calculator({ onClose }: CalculatorProps) {
  const [display, setDisplay] = useState("0")
  const [previousValue, setPreviousValue] = useState<number | null>(null)
  const [operation, setOperation] = useState<string | null>(null)
  const [waitingForOperand, setWaitingForOperand] = useState(false)

  const inputNumber = (num: string) => {
    if (waitingForOperand) {
      setDisplay(num)
      setWaitingForOperand(false)
    } else {
      setDisplay(display === "0" ? num : display + num)
    }
  }

  const inputOperation = (nextOperation: string) => {
    const inputValue = Number.parseFloat(display)

    if (previousValue === null) {
      setPreviousValue(inputValue)
    } else if (operation) {
      const currentValue = previousValue || 0
      const newValue = calculate(currentValue, inputValue, operation)

      setDisplay(String(newValue))
      setPreviousValue(newValue)
    }

    setWaitingForOperand(true)
    setOperation(nextOperation)
  }

  const calculate = (firstValue: number, secondValue: number, operation: string) => {
    switch (operation) {
      case "+":
        return firstValue + secondValue
      case "-":
        return firstValue - secondValue
      case "×":
        return firstValue * secondValue
      case "÷":
        return firstValue / secondValue
      case "=":
        return secondValue
      default:
        return secondValue
    }
  }

  const performCalculation = () => {
    const inputValue = Number.parseFloat(display)

    if (previousValue !== null && operation) {
      const newValue = calculate(previousValue, inputValue, operation)
      setDisplay(String(newValue))
      setPreviousValue(null)
      setOperation(null)
      setWaitingForOperand(true)
    }
  }

  const clear = () => {
    setDisplay("0")
    setPreviousValue(null)
    setOperation(null)
    setWaitingForOperand(false)
  }

  const buttons = [
    ["C", "±", "%", "÷"],
    ["7", "8", "9", "×"],
    ["4", "5", "6", "-"],
    ["1", "2", "3", "+"],
    ["0", ".", "="],
  ]

  return (
    <div className="flex-1 p-6">
      <div className="max-w-sm mx-auto">
        <div className="bg-white/20 backdrop-blur-xl border border-white/30 rounded-2xl shadow-2xl overflow-hidden">
          {/* Title Bar */}
          <div className="flex items-center justify-between p-4 bg-white/10 border-b border-white/20">
            <h2 className="text-lg font-semibold text-gray-800">Calculator</h2>
            <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-full transition-colors">
              <X className="w-4 h-4 text-gray-600" />
            </button>
          </div>

          {/* Display */}
          <div className="p-6 bg-black/80 text-right">
            <div className="text-4xl font-light text-white min-h-[60px] flex items-center justify-end">{display}</div>
          </div>

          {/* Buttons */}
          <div className="p-4">
            {buttons.map((row, rowIndex) => (
              <div key={rowIndex} className="flex gap-2 mb-2 last:mb-0">
                {row.map((btn) => (
                  <button
                    key={btn}
                    onClick={() => {
                      if (btn === "C") clear()
                      else if (btn === "=") performCalculation()
                      else if (["+", "-", "×", "÷"].includes(btn)) inputOperation(btn)
                      else if (btn === "±") setDisplay(String(-Number.parseFloat(display)))
                      else if (btn === "%") setDisplay(String(Number.parseFloat(display) / 100))
                      else inputNumber(btn)
                    }}
                    className={`flex-1 h-16 rounded-xl font-medium text-lg transition-all duration-150 hover:scale-105 active:scale-95 ${
                      btn === "0" ? "col-span-2" : ""
                    } ${
                      ["+", "-", "×", "÷", "="].includes(btn)
                        ? "bg-orange-500 hover:bg-orange-600 text-white shadow-lg"
                        : ["C", "±", "%"].includes(btn)
                          ? "bg-gray-400 hover:bg-gray-500 text-black shadow-lg"
                          : "bg-white/20 hover:bg-white/30 text-gray-800 backdrop-blur-sm border border-white/30"
                    }`}
                    style={btn === "0" ? { gridColumn: "span 2" } : {}}
                  >
                    {btn}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
