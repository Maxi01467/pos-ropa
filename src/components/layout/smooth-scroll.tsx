"use client"

import dynamic from "next/dynamic"
import type { ReactNode } from "react"

// lenis accede a `window`/`document` al nivel de módulo, lo que rompe el SSR
// de Next.js. Usamos dynamic() con ssr:false para que nunca se evalúe en el servidor.
const ReactLenis = dynamic(
  () => import("lenis/react").then((mod) => mod.ReactLenis),
  { ssr: false }
)

export function SmoothScroll({ children }: { children: ReactNode }) {
  return (
    <ReactLenis root options={{ lerp: 0.08, smoothWheel: true }}>
      {children}
    </ReactLenis>
  )
}
