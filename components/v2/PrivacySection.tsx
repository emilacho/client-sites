"use client"
/**
 * PrivacySection · R96.129 · LOPDP derechos ARCO · botones para
 * descargar datos personales o solicitar eliminación de cuenta.
 */
import { useState } from "react"
import Link from "next/link"
import { ShieldCheck, Download, Trash2 } from "lucide-react"
import { getSupabaseBrowser } from "@/lib/supabase-browser"

export default function PrivacySection() {
  const [exporting, setExporting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function authHeader(): Promise<HeadersInit | null> {
    const supa = getSupabaseBrowser()
    const {
      data: { session },
    } = await supa.auth.getSession()
    if (!session?.access_token) return null
    return {
      "content-type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    }
  }

  async function exportData() {
    setExporting(true)
    setError(null)
    setMessage(null)
    try {
      const headers = await authHeader()
      if (!headers) {
        setError("Sesión expirada")
        return
      }
      const res = await fetch("/api/customer/data-export", {
        method: "POST",
        headers,
      })
      if (!res.ok) {
        setError("No se pudo exportar")
        return
      }
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = "naufrago-mis-datos.json"
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
      setMessage("Descargado · revisá tu carpeta Descargas")
    } catch {
      setError("Error de red")
    } finally {
      setExporting(false)
    }
  }

  async function deleteAccount() {
    if (
      !confirm(
        "¿Eliminar tu cuenta? Tus datos se borrarán en 30 días. Puedes cancelar el proceso volviendo a iniciar sesión.",
      )
    )
      return
    setDeleting(true)
    setError(null)
    setMessage(null)
    try {
      const headers = await authHeader()
      if (!headers) {
        setError("Sesión expirada")
        return
      }
      const res = await fetch("/api/customer/data-delete", {
        method: "POST",
        headers,
        body: JSON.stringify({ confirm: true }),
      })
      const data = await res.json()
      if (data?.ok) {
        setMessage(
          data.message ?? "Cuenta marcada para eliminación · 30 días cooldown",
        )
      } else {
        setError(data?.error || "No se pudo eliminar")
      }
    } catch {
      setError("Error de red")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="mt-3 rounded-2xl border border-slate-800 bg-slate-900/40 px-3 py-3">
      <div className="flex items-baseline justify-between">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-100">
          <ShieldCheck className="h-3.5 w-3.5 text-cyan-400" />
          Mis datos · privacidad
        </p>
        <Link
          href="/privacidad"
          className="text-[10px] uppercase tracking-widest text-cyan-300 underline hover:text-cyan-200"
        >
          Política
        </Link>
      </div>
      <p className="mt-1 text-[11px] text-slate-500">
        Derechos LOPDP · acceso · rectificación · cancelación · oposición.
      </p>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={exportData}
          disabled={exporting}
          className="flex items-center justify-center gap-1 rounded-md border border-cyan-500/40 px-2 py-1.5 text-[11px] text-cyan-300 hover:bg-cyan-500/10 disabled:opacity-50"
        >
          <Download className="h-3 w-3" />
          {exporting ? "Exportando…" : "Descargar mis datos"}
        </button>
        <button
          type="button"
          onClick={deleteAccount}
          disabled={deleting}
          className="flex items-center justify-center gap-1 rounded-md border border-rose-500/40 px-2 py-1.5 text-[11px] text-rose-300 hover:bg-rose-500/10 disabled:opacity-50"
        >
          <Trash2 className="h-3 w-3" />
          {deleting ? "Procesando…" : "Eliminar cuenta"}
        </button>
      </div>

      {message && <p className="mt-2 text-[11px] text-emerald-400">{message}</p>}
      {error && <p className="mt-2 text-[11px] text-rose-400">{error}</p>}
    </div>
  )
}
