"use client"
/**
 * AddressBookEditor · R96.119 · Fase D · vista expandible en /mi-cuenta.
 * GET inicial via Bearer · PATCH al guardar · cliente envía libreta entera.
 */
import { useEffect, useState } from "react"
import { Pencil, Trash2, Plus, Check, X, MapPin } from "lucide-react"
import { getSupabaseBrowser } from "@/lib/supabase-browser"

export interface AddressEntry {
  street: string
  detail?: string | null
  label?: string
  isDefault?: boolean
  lat?: number | null
  lng?: number | null
  country?: string
}

const LABEL_OPTIONS = ["Casa", "Trabajo", "Otra"]

export default function AddressBookEditor() {
  const [addresses, setAddresses] = useState<AddressEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void refresh()
  }, [])

  async function refresh() {
    setLoading(true)
    setError(null)
    try {
      const supa = getSupabaseBrowser()
      const {
        data: { session },
      } = await supa.auth.getSession()
      if (!session?.access_token) {
        setAddresses([])
        return
      }
      const res = await fetch("/api/customer/addresses", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const data = await res.json()
      if (data?.ok) {
        setAddresses(
          Array.isArray(data.addresses) ? (data.addresses as AddressEntry[]) : [],
        )
      }
    } catch (err) {
      console.error("[AddressBookEditor] refresh", err)
      setError("No se pudieron cargar las direcciones")
    } finally {
      setLoading(false)
    }
  }

  async function save(next: AddressEntry[]) {
    setSaving(true)
    setError(null)
    try {
      const supa = getSupabaseBrowser()
      const {
        data: { session },
      } = await supa.auth.getSession()
      if (!session?.access_token) {
        setError("Sesión expirada")
        return
      }
      const res = await fetch("/api/customer/addresses", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ addresses: next }),
      })
      const data = await res.json()
      if (data?.ok) {
        setAddresses(
          Array.isArray(data.addresses) ? (data.addresses as AddressEntry[]) : [],
        )
      } else {
        setError(data?.error || "No se pudo guardar")
      }
    } catch (err) {
      console.error("[AddressBookEditor] save", err)
      setError("Error de red al guardar")
    } finally {
      setSaving(false)
    }
  }

  function handleDelete(i: number) {
    if (!confirm("¿Eliminar esta dirección?")) return
    const next = addresses.filter((_, idx) => idx !== i)
    void save(next)
  }

  function handleSetDefault(i: number) {
    const next = addresses.map((a, idx) => ({ ...a, isDefault: idx === i }))
    void save(next)
  }

  if (loading) {
    return (
      <div className="mt-3 rounded-2xl border border-slate-800 bg-slate-900/40 px-4 py-3">
        <p className="text-xs text-slate-400">Cargando direcciones…</p>
      </div>
    )
  }

  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-baseline justify-between px-1">
        <p className="text-sm font-semibold text-slate-100">Mis direcciones</p>
        <span className="text-[10px] uppercase tracking-widest text-slate-500">
          {addresses.length}
          {saving ? " · guardando…" : ""}
        </span>
      </div>

      {addresses.length === 0 && !adding && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 px-4 py-3 text-center">
          <p className="text-xs text-slate-400">
            Sin direcciones guardadas todavía
          </p>
        </div>
      )}

      {addresses.map((addr, i) =>
        editingIndex === i ? (
          <AddressForm
            key={i}
            initial={addr}
            onCancel={() => setEditingIndex(null)}
            onSave={(updated) => {
              const next = [...addresses]
              next[i] = updated
              setEditingIndex(null)
              void save(next)
            }}
          />
        ) : (
          <AddressCard
            key={i}
            addr={addr}
            onEdit={() => setEditingIndex(i)}
            onDelete={() => handleDelete(i)}
            onSetDefault={() => handleSetDefault(i)}
          />
        ),
      )}

      {adding ? (
        <AddressForm
          initial={{ street: "", label: "Otra" }}
          onCancel={() => setAdding(false)}
          onSave={(newAddr) => {
            setAdding(false)
            void save([...addresses, newAddr])
          }}
        />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-slate-700 bg-slate-900/20 px-4 py-2.5 text-xs uppercase tracking-widest text-slate-400 transition hover:border-cyan-500/50 hover:bg-cyan-500/5 hover:text-cyan-300"
        >
          <Plus className="h-3.5 w-3.5" />
          Agregar dirección
        </button>
      )}

      {error && <p className="text-xs text-rose-400">{error}</p>}
    </div>
  )
}

function AddressCard({
  addr,
  onEdit,
  onDelete,
  onSetDefault,
}: {
  addr: AddressEntry
  onEdit: () => void
  onDelete: () => void
  onSetDefault: () => void
}) {
  const label = addr.label || "Otra"
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-slate-800 bg-slate-900/40 px-3 py-3">
      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-semibold uppercase tracking-widest text-cyan-300">
            {label}
          </span>
          {addr.isDefault && (
            <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] uppercase tracking-widest text-emerald-300">
              Default
            </span>
          )}
        </div>
        <p className="mt-0.5 truncate text-sm text-slate-100">{addr.street}</p>
        {addr.detail && (
          <p className="mt-0.5 truncate text-[11px] text-slate-400">
            {addr.detail}
          </p>
        )}
      </div>
      <div className="flex shrink-0 flex-col gap-1">
        {!addr.isDefault && (
          <button
            type="button"
            onClick={onSetDefault}
            className="rounded-full bg-emerald-500/10 p-1.5 text-emerald-300 hover:bg-emerald-500/20"
            aria-label="Marcar como default"
            title="Marcar como default"
          >
            <Check className="h-3 w-3" />
          </button>
        )}
        <button
          type="button"
          onClick={onEdit}
          className="rounded-full bg-cyan-500/10 p-1.5 text-cyan-300 hover:bg-cyan-500/20"
          aria-label="Editar"
        >
          <Pencil className="h-3 w-3" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="rounded-full bg-rose-500/10 p-1.5 text-rose-300 hover:bg-rose-500/20"
          aria-label="Eliminar"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  )
}

function AddressForm({
  initial,
  onCancel,
  onSave,
}: {
  initial: AddressEntry
  onCancel: () => void
  onSave: (addr: AddressEntry) => void
}) {
  const [street, setStreet] = useState(initial.street ?? "")
  const [detail, setDetail] = useState(initial.detail ?? "")
  const [label, setLabel] = useState(initial.label ?? "Otra")

  const canSave = street.trim().length > 2

  return (
    <div className="space-y-2 rounded-2xl border border-cyan-500/30 bg-cyan-500/5 px-3 py-3">
      <div className="flex gap-1.5">
        {LABEL_OPTIONS.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => setLabel(opt)}
            className={`rounded-full px-3 py-1 text-[10px] uppercase tracking-widest transition ${
              label === opt
                ? "bg-cyan-500 text-slate-950"
                : "border border-slate-700 text-slate-400 hover:bg-slate-800"
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
      <input
        type="text"
        value={street}
        onChange={(e) => setStreet(e.target.value)}
        placeholder="Calle · número · barrio"
        className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none"
      />
      <input
        type="text"
        value={detail}
        onChange={(e) => setDetail(e.target.value)}
        placeholder="Piso · depto · referencia (opcional)"
        className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none"
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
        >
          <X className="mr-1 inline-block h-3 w-3" />
          Cancelar
        </button>
        <button
          type="button"
          disabled={!canSave}
          onClick={() =>
            onSave({
              ...initial,
              street: street.trim(),
              detail: detail.trim() || null,
              label,
            })
          }
          className="flex-1 rounded-md bg-gradient-to-r from-violet-500 to-cyan-500 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
        >
          <Check className="mr-1 inline-block h-3 w-3" />
          Guardar
        </button>
      </div>
    </div>
  )
}
