"use client"

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      toastOptions={{
        classNames: {
          toast:
            "group/toast rounded-[20px] border border-black/5 bg-white/90 text-[#050505] shadow-[0_24px_70px_-42px_rgba(0,0,0,0.62)] backdrop-blur-xl dark:border-white/15 dark:bg-white/90 dark:text-[#050505]",
          title: "text-sm font-semibold tracking-normal text-[#050505] dark:text-[#050505]",
          description: "text-xs text-[#1f1f1f] dark:text-[#1f1f1f]",
          icon:
            "flex size-8 shrink-0 items-center justify-center rounded-full border border-black/5 bg-zinc-100 text-zinc-700 dark:border-black/5 dark:bg-zinc-100 dark:text-zinc-700",
          success:
            "[&_[data-icon]]:bg-emerald-500/12 [&_[data-icon]]:text-emerald-700 dark:[&_[data-icon]]:text-emerald-700",
          info:
            "[&_[data-icon]]:bg-sky-500/12 [&_[data-icon]]:text-sky-700 dark:[&_[data-icon]]:text-sky-700",
          warning:
            "[&_[data-icon]]:bg-amber-500/14 [&_[data-icon]]:text-amber-800 dark:[&_[data-icon]]:text-amber-800",
          error:
            "[&_[data-icon]]:bg-rose-500/12 [&_[data-icon]]:text-rose-700 dark:[&_[data-icon]]:text-rose-700",
          closeButton:
            "border-black/5 bg-white/90 text-zinc-700 shadow-[0_10px_26px_-20px_rgba(0,0,0,0.55)] backdrop-blur hover:bg-white hover:text-zinc-950 dark:border-black/5 dark:bg-white/90 dark:text-zinc-700 dark:hover:bg-white dark:hover:text-zinc-950",
        },
      }}
      style={
        {
          "--normal-bg": "rgba(255, 255, 255, 0.85)",
          "--normal-text": "#050505",
          "--normal-border": "rgba(0, 0, 0, 0.05)",
          "--border-radius": "20px",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
