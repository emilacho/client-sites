"use client"
/**
 * PreferencesEditor · R96.119 · sección editable en /mi-cuenta.
 * Bearer Auth via Supabase · GET resuelve customer.preferences ·
 * POST update. Reusa /api/customer/preferences endpoint existente
 * (que acepta whatsapp · acá lo enviamos del account.whatsapp).
 */
import { useEffect, useState } from "react"
import { Pencil, Check, X } from "lucide-react"

interface Props {
  whatsapp: string | null
  initialValue: string | null
}

export default function PreferencesEditor({ whatsapp, initialValue }: Props) {
  const [value, setValue] = useState(initialValue ?? "")
  const [savedValue, setSavedValue] = useState(initialValue ?? "")
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setValue(initialValue ?? "")
    setSavedValue(initialValue ?? "")
  }, [initialValue])

  async function save() {
    if (!whatsapp) {
      setError("Agrega tu WhatsApp primero en tu próximo pedido")
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/customer/preferences", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ whatsapp, preferences: value }),
      })
      const data = await res.json()
      if (data?.ok) {
        setSavedValue(value)
        setEditing(false)
      } else {
        setError(data?.error || "No se pudo guardar")
      }
    } catch {
      setError("Error de red")
    } finally {
      setSaving(false)
    }
  }

  function cancel() {
    setValue(savedValue)
    setEditing(false)
    setError(null)
  }

  return (
    <div className="mt-3 rounded-2xl border border-slate-800 bg-slate-900/40 px-3 py-3">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-semibold text-slate-100">
          Mis preferencias
        </p>
        {!editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            disabled={!whatsapp}
            className="inline-flex items-center gap-1 rounded-full border border-cyan-500/40 px-2.5 py-0.5 text-[10px] uppercase tracking-widest text-cyan-300 hover:bg-cyan-500/10 disabled:opacity-40"
          >
            <Pencil className="h-2.5 w-2.5" />
            Editar
          </button>
        )}
      </div>

      {editing ? (
        <>
          <textarea
            rows={2}
            maxLength={500}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="sin cilantro · poco picante · alergia al maní"
            autoFocus
            className="mt-2 w-full rounded-md border border-cyan-500/40 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none"
          />
          <p className="mt-1 text-[10px] text-slate-500">
            {value.length}/500 · pre-llena las notas en tus próximos pedidos
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={cancel}
              className="flex-1 rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
            >
              <X className="mr-1 inline-block h-3 w-3" />
              Cancelar
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving || value === savedValue}
              className="flex-1 rounded-md bg-gradient-to-r from-violet-500 to-cyan-500 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
            >
              <Check className="mr-1 inline-block h-3 w-3" />
              {saving ? "Guardando…" : "Guardar"}
            </button>
          </div>
          {error && <p className="mt-1 text-xs text-rose-400">{error}</p>}
        </>
      ) : (
        <p className="mt-1 text-xs text-slate-400">
          {savedValue || "Sin notas guardadas todavía"}
        </p>
      )}
    </div>
  )
}
