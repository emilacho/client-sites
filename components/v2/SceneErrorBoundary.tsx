"use client"
/**
 * SceneErrorBoundary · class-component boundary wrapping the r3f
 * Canvas so an unloadable asset (corrupt GLB / network error) renders
 * a graceful 2D fallback instead of white-screening the whole landing.
 *
 * Not a try/catch band-aid · this is the architectural seam React
 * provides for async-rendering failures in the descendant tree. The
 * cart, top bar, and overlays sit OUTSIDE this boundary and keep
 * working when the 3D scene fails.
 */
import { Component, type ReactNode } from "react"

interface State {
  error: Error | null
}

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

export class SceneErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error) {
    // Surface to the browser console · doesn't propagate further
    console.error("[Scene] runtime failure · falling back to 2D hero:", error)
  }

  render() {
    if (this.state.error) {
      return (
        this.props.fallback ?? (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950 text-slate-300">
            <div className="max-w-md px-6 text-center">
              <div className="mb-3 flex justify-center text-3xl" aria-hidden>
                🌊
              </div>
              <p className="font-display text-xl text-cyan-100">
                La isla está cargando despacio
              </p>
              <p className="mt-2 text-sm text-slate-400">
                Mientras tanto, podés pedir directo por el carrito en la
                esquina superior derecha.
              </p>
            </div>
          </div>
        )
      )
    }
    return this.props.children
  }
}
