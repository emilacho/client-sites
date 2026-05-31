"use client"
/**
 * PaymentForm · R97.10 · checkout estilo Domino's EC + adaptación Náufrago.
 *
 * Reemplaza el MockPaymentForm inline del CartDrawer. UI completa lista
 * para cuando contratemos las APIs · solo queda integrar credentials.
 *
 * Métodos soportados (UI mock por ahora) ·
 *  - 💳 Tarjeta · Visa/MC/Amex/Discover · auto-detect brand + saved cards
 *  - 💵 Efectivo contra entrega
 *  - 🟣 DeUna · QR + "He pagado" (Banco Pichincha wallet)
 *  - 📱 PayPhone · phone + OTP flow (billetera ecuatoriana)
 *  - 🍎 Apple Pay · placeholder (próximamente · requiere Kushki real)
 *  - G Google Pay · placeholder (idem)
 *
 * Features extra ·
 *  - Multi-tarjetas guardadas (localStorage)
 *  - Tip selector integrado (chips + custom)
 *  - Email receipt opcional
 *  - Trust line · padlock + SSL + PCI + logos accepted
 *  - Header total destacado
 *  - Scrollable container · fit cart drawer height
 */
import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { useCart } from "@/lib/v2/cart-context"

const PURPLE = "#3D2466"
const PURPLE_DARK = "#1F1138"
const CYAN = "#4DD4D8"
const CYAN_DARK = "#2BA8AC"
const SAND = "#F5E9D2"

// ─── Tipos ──────────────────────────────────────────────────────────
type PaymentMethod =
  | "card"
  | "cash"
  | "deuna"
  | "payphone"
  | "apple_pay"
  | "google_pay"

type CardBrand = "visa" | "mastercard" | "amex" | "discover" | "unknown"

interface SavedCard {
  id: string
  brand: CardBrand
  last4: string
  expiry: string
  holder: string
}

const LS_SAVED_CARDS = "naufrago_saved_cards"
const LS_EMAIL_RECEIPT = "naufrago_email_receipt"

// ─── Helpers ────────────────────────────────────────────────────────
function detectCardBrand(raw: string): CardBrand {
  const digits = raw.replace(/\D/g, "")
  if (/^4/.test(digits)) return "visa"
  if (/^(5[1-5]|2[2-7])/.test(digits)) return "mastercard"
  if (/^3[47]/.test(digits)) return "amex"
  if (/^(6011|65|64[4-9])/.test(digits)) return "discover"
  return "unknown"
}

function formatCard(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 16)
  return digits.replace(/(.{4})/g, "$1 ").trim()
}

function formatExpiry(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 4)
  if (digits.length <= 2) return digits
  return digits.slice(0, 2) + "/" + digits.slice(2)
}

// ─── Brand chip · text-pill style ───────────────────────────────────
function BrandChip({ brand, small }: { brand: CardBrand; small?: boolean }) {
  const palette: Record<
    Exclude<CardBrand, "unknown">,
    { bg: string; fg: string; label: string }
  > = {
    visa: { bg: "#1A1F71", fg: "#FFFFFF", label: "VISA" },
    mastercard: { bg: "#FFFFFF", fg: "#EB001B", label: "MC" },
    amex: { bg: "#006FCF", fg: "#FFFFFF", label: "AMEX" },
    discover: { bg: "#FF6000", fg: "#FFFFFF", label: "DISC" },
  }
  if (brand === "unknown") {
    return (
      <span
        className={[
          "flex items-center justify-center rounded text-[9px]",
          small ? "h-5 w-8" : "h-6 w-10",
        ].join(" ")}
        style={{
          background: "rgba(255,255,255,0.08)",
          color: "rgba(255,255,255,0.4)",
        }}
      >
        ····
      </span>
    )
  }
  const c = palette[brand]
  return (
    <span
      className={[
        "flex items-center justify-center rounded font-extrabold tracking-wider",
        small ? "h-5 w-8 text-[8px]" : "h-6 w-10 text-[10px]",
      ].join(" ")}
      style={{ background: c.bg, color: c.fg }}
    >
      {c.label}
    </span>
  )
}

// ─── DeUna y PayPhone logos · estilo brand ──────────────────────────
function DeUnaLogo({ small }: { small?: boolean }) {
  return (
    <span
      className={[
        "flex items-center justify-center rounded font-extrabold",
        small ? "h-5 w-12 text-[8px]" : "h-6 w-14 text-[10px]",
      ].join(" ")}
      style={{ background: "#7B1FA2", color: "#FFFFFF" }}
    >
      DeUna
    </span>
  )
}

function PayPhoneLogo({ small }: { small?: boolean }) {
  return (
    <span
      className={[
        "flex items-center justify-center rounded font-extrabold",
        small ? "h-5 w-14 text-[8px]" : "h-6 w-16 text-[10px]",
      ].join(" ")}
      style={{ background: "#00BAF2", color: "#FFFFFF" }}
    >
      PayPhone
    </span>
  )
}

// ─── Method tab ─────────────────────────────────────────────────────
function MethodTab({
  active,
  disabled,
  emoji,
  label,
  badge,
  onClick,
}: {
  active: boolean
  disabled?: boolean
  emoji: string
  label: string
  badge?: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        "relative flex flex-col items-center justify-center gap-1 rounded-xl border-2 px-2 py-2 text-[11px] font-semibold transition-all",
        active
          ? "border-[#4DD4D8] bg-[rgba(77,212,216,0.10)] text-cyan-200"
          : disabled
            ? "border-slate-800 bg-slate-950/50 text-slate-600"
            : "border-slate-700 bg-slate-950 text-slate-400 hover:border-slate-600",
      ].join(" ")}
    >
      <span className="text-lg leading-none" aria-hidden>
        {emoji}
      </span>
      <span className="leading-tight">{label}</span>
      {badge ? (
        <span
          className="absolute -top-1.5 right-1 rounded-full px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-wider"
          style={{ background: "#F5E9D2", color: PURPLE }}
        >
          {badge}
        </span>
      ) : null}
    </button>
  )
}

// ─── Tip chips · inline en payment ──────────────────────────────────
function TipChipsInline({
  value,
  onChange,
}: {
  value: number
  onChange: (n: number) => void
}) {
  const presets = [0, 1, 2]
  const [customOpen, setCustomOpen] = useState(
    !presets.includes(Math.round(value)),
  )
  const [customStr, setCustomStr] = useState(
    !presets.includes(Math.round(value)) && value > 0
      ? value.toFixed(2)
      : "",
  )
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {presets.map((p) => {
        const isSelected = Math.abs(value - p) < 0.005 && !customOpen
        return (
          <button
            key={p}
            type="button"
            onClick={() => {
              setCustomOpen(false)
              setCustomStr("")
              onChange(p)
            }}
            className={[
              "rounded-full border px-3 py-1 text-[11px] font-semibold transition-all",
              isSelected
                ? "border-cyan-400 bg-cyan-500/20 text-cyan-100"
                : "border-slate-700 bg-slate-950 text-slate-400",
            ].join(" ")}
          >
            {p === 0 ? "Sin propina" : `$${p}`}
          </button>
        )
      })}
      <button
        type="button"
        onClick={() => setCustomOpen(true)}
        className={[
          "rounded-full border px-3 py-1 text-[11px] font-semibold transition-all",
          customOpen
            ? "border-cyan-400 bg-cyan-500/20 text-cyan-100"
            : "border-slate-700 bg-slate-950 text-slate-400",
        ].join(" ")}
      >
        Otra
      </button>
      {customOpen ? (
        <div className="flex items-center gap-1">
          <span className="text-[11px] text-slate-400">$</span>
          <input
            type="number"
            min={0}
            max={50}
            step={0.5}
            value={customStr}
            onChange={(e) => {
              setCustomStr(e.target.value)
              const n = Number(e.target.value)
              if (!isNaN(n) && n >= 0) onChange(n)
            }}
            placeholder="0.00"
            className="w-16 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] text-slate-100"
          />
        </div>
      ) : null}
    </div>
  )
}

// ─── Card form sub-component ────────────────────────────────────────
function CardForm({
  savedCards,
  selectedSavedCardId,
  onSelectSavedCard,
  onUseNewCard,
  cardNumber,
  setCardNumber,
  expiry,
  setExpiry,
  cvv,
  setCvv,
  holder,
  setHolder,
  saveCard,
  setSaveCard,
}: {
  savedCards: SavedCard[]
  selectedSavedCardId: string | null
  onSelectSavedCard: (id: string) => void
  onUseNewCard: () => void
  cardNumber: string
  setCardNumber: (v: string) => void
  expiry: string
  setExpiry: (v: string) => void
  cvv: string
  setCvv: (v: string) => void
  holder: string
  setHolder: (v: string) => void
  saveCard: boolean
  setSaveCard: (v: boolean) => void
}) {
  const brand = detectCardBrand(cardNumber)
  const cvvLen = brand === "amex" ? 4 : 3
  const usingNewCard = !selectedSavedCardId

  return (
    <div className="space-y-2">
      {/* Saved cards list */}
      {savedCards.length > 0 ? (
        <div className="space-y-1.5">
          <span className="block font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">
            Tarjetas guardadas
          </span>
          {savedCards.map((sc) => {
            const isSel = sc.id === selectedSavedCardId
            return (
              <button
                key={sc.id}
                type="button"
                onClick={() => onSelectSavedCard(sc.id)}
                className={[
                  "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left transition-all",
                  isSel
                    ? "border-cyan-400 bg-cyan-500/10"
                    : "border-slate-700 bg-slate-900 hover:border-slate-600",
                ].join(" ")}
              >
                <div className="flex items-center gap-2">
                  <BrandChip brand={sc.brand} small />
                  <span className="font-mono text-xs text-slate-200">
                    ····{sc.last4}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {sc.expiry}
                  </span>
                </div>
                <span
                  className={[
                    "flex h-4 w-4 items-center justify-center rounded-full border-2",
                    isSel ? "border-cyan-400 bg-cyan-400" : "border-slate-600",
                  ].join(" ")}
                >
                  {isSel ? <span className="h-1.5 w-1.5 rounded-full bg-slate-950" /> : null}
                </span>
              </button>
            )
          })}
          <button
            type="button"
            onClick={onUseNewCard}
            className={[
              "flex w-full items-center justify-center gap-1 rounded-lg border-2 border-dashed px-3 py-2 text-xs font-semibold transition-all",
              usingNewCard
                ? "border-cyan-400 bg-cyan-500/10 text-cyan-200"
                : "border-slate-700 text-slate-400 hover:border-slate-600",
            ].join(" ")}
          >
            + Usar otra tarjeta
          </button>
        </div>
      ) : null}

      {/* New card form · solo si NO hay saved seleccionada */}
      {usingNewCard ? (
        <div className="space-y-2 rounded-xl border-2 border-slate-700 bg-slate-900/40 px-3 py-2.5">
          <label className="block">
            <span className="mb-1 block text-[10px] font-medium text-slate-400">
              Número de tarjeta
            </span>
            <div className="relative">
              <input
                type="text"
                value={cardNumber}
                onChange={(e) => setCardNumber(formatCard(e.target.value))}
                placeholder="1234 5678 9012 3456"
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-2 pr-14 font-mono text-sm tracking-wider text-slate-100 placeholder:text-slate-600 focus:border-cyan-500 focus:outline-none"
                inputMode="numeric"
                autoComplete="cc-number"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2">
                <BrandChip brand={brand} />
              </div>
            </div>
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="mb-1 block text-[10px] font-medium text-slate-400">
                Vencimiento
              </span>
              <input
                type="text"
                value={expiry}
                onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                placeholder="MM/AA"
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-2 font-mono text-sm text-slate-100 placeholder:text-slate-600 focus:border-cyan-500 focus:outline-none"
                inputMode="numeric"
                autoComplete="cc-exp"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] font-medium text-slate-400">
                CVV
              </span>
              <input
                type="text"
                value={cvv}
                onChange={(e) =>
                  setCvv(e.target.value.replace(/\D/g, "").slice(0, cvvLen))
                }
                placeholder={brand === "amex" ? "4 dígitos" : "3 dígitos"}
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-2 font-mono text-sm text-slate-100 placeholder:text-slate-600 focus:border-cyan-500 focus:outline-none"
                inputMode="numeric"
                autoComplete="cc-csc"
                maxLength={cvvLen}
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-1 block text-[10px] font-medium text-slate-400">
              Titular
            </span>
            <input
              type="text"
              value={holder}
              onChange={(e) => setHolder(e.target.value.toUpperCase())}
              placeholder="COMO APARECE EN LA TARJETA"
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-2 text-sm tracking-wide text-slate-100 placeholder:text-slate-600 focus:border-cyan-500 focus:outline-none"
              autoComplete="cc-name"
            />
          </label>

          <label className="flex cursor-pointer items-center gap-2 text-[11px] text-slate-300">
            <input
              type="checkbox"
              checked={saveCard}
              onChange={(e) => setSaveCard(e.target.checked)}
              className="h-3.5 w-3.5 accent-cyan-400"
            />
            <span>Guardar esta tarjeta para próximos pedidos</span>
          </label>
        </div>
      ) : null}
    </div>
  )
}

// ─── DeUna form (mock) ──────────────────────────────────────────────
function DeUnaForm({
  confirmed,
  onConfirm,
}: {
  confirmed: boolean
  onConfirm: () => void
}) {
  return (
    <div
      className="space-y-3 rounded-xl border-2 px-4 py-4 text-center"
      style={{
        background: "linear-gradient(180deg, rgba(123,31,162,0.15) 0%, rgba(46,11,84,0.25) 100%)",
        borderColor: "rgba(123,31,162,0.40)",
      }}
    >
      {confirmed ? (
        <>
          <span className="text-3xl">✅</span>
          <p className="text-sm font-semibold text-emerald-300">
            Pago DeUna confirmado
          </p>
          <p className="text-[11px] text-slate-400">
            Procesando · click Pagar para finalizar
          </p>
        </>
      ) : (
        <>
          {/* QR placeholder · cuando integremos API real · acá va el QR generado */}
          <div
            className="mx-auto flex h-32 w-32 items-center justify-center rounded-lg"
            style={{ background: "#FFFFFF" }}
          >
            <div className="grid grid-cols-7 gap-0.5">
              {Array.from({ length: 49 }).map((_, i) => (
                <span
                  key={i}
                  className="h-2.5 w-2.5"
                  style={{
                    background: Math.random() > 0.45 ? "#000" : "#FFF",
                  }}
                />
              ))}
            </div>
          </div>
          <p className="text-sm font-semibold" style={{ color: SAND }}>
            Escaneá con tu app DeUna
          </p>
          <p className="text-[11px] text-slate-400">
            O abrí DeUna · ingresá el monto · usá el código generado
          </p>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-full bg-purple-700 px-4 py-2 text-xs font-bold text-white"
          >
            Ya escaneé · He pagado
          </button>
        </>
      )}
    </div>
  )
}

// ─── PayPhone form (mock) ───────────────────────────────────────────
function PayPhoneForm({
  step,
  phone,
  setPhone,
  otp,
  setOtp,
  onSendOtp,
  onConfirmOtp,
}: {
  step: "phone" | "otp" | "ready"
  phone: string
  setPhone: (v: string) => void
  otp: string
  setOtp: (v: string) => void
  onSendOtp: () => void
  onConfirmOtp: () => void
}) {
  return (
    <div
      className="space-y-2.5 rounded-xl border-2 px-3 py-3"
      style={{
        background: "linear-gradient(180deg, rgba(0,186,242,0.10) 0%, rgba(0,124,160,0.20) 100%)",
        borderColor: "rgba(0,186,242,0.40)",
      }}
    >
      {step === "phone" ? (
        <>
          <label className="block">
            <span className="mb-1 block text-[10px] font-medium text-slate-400">
              Número PayPhone (registrado en la billetera)
            </span>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
              placeholder="099XXXXXXX"
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-2 font-mono text-sm text-slate-100 placeholder:text-slate-600 focus:border-cyan-500 focus:outline-none"
              inputMode="tel"
              maxLength={10}
            />
          </label>
          <button
            type="button"
            onClick={onSendOtp}
            disabled={phone.length < 9}
            className="w-full rounded-full bg-sky-500 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
          >
            Enviar código por SMS
          </button>
        </>
      ) : step === "otp" ? (
        <>
          <p className="text-[11px] text-slate-300">
            Código enviado al <span className="font-mono">{phone}</span> ·
            ingresá los 6 dígitos
          </p>
          <input
            type="text"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="000000"
            className="w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-2 text-center font-mono text-lg tracking-[0.4em] text-slate-100 placeholder:text-slate-600 focus:border-cyan-500 focus:outline-none"
            inputMode="numeric"
            maxLength={6}
          />
          <button
            type="button"
            onClick={onConfirmOtp}
            disabled={otp.length < 4}
            className="w-full rounded-full bg-sky-500 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
          >
            Validar código
          </button>
        </>
      ) : (
        <div className="text-center">
          <span className="text-3xl">✅</span>
          <p className="mt-1 text-sm font-semibold text-emerald-300">
            PayPhone confirmado
          </p>
          <p className="text-[11px] text-slate-400">
            Procesando · click Pagar para finalizar
          </p>
        </div>
      )}
    </div>
  )
}

// ─── Apple Pay / Google Pay placeholders (deshabilitados) ───────────
function DigitalWalletPlaceholder({ kind }: { kind: "apple" | "google" }) {
  const label = kind === "apple" ? "Apple Pay" : "Google Pay"
  const icon = kind === "apple" ? "🍎" : "G"
  return (
    <div className="space-y-2 rounded-xl border-2 border-dashed border-slate-700 bg-slate-900/30 px-4 py-6 text-center">
      <span className="text-4xl">{icon}</span>
      <p className="text-sm font-semibold text-slate-300">{label}</p>
      <p className="text-[11px] text-slate-500">
        Próximamente · requiere integración Kushki real con el SDK del wallet
      </p>
      <div
        className="mx-auto flex h-10 w-32 items-center justify-center rounded-full text-xs font-bold opacity-50"
        style={{ background: "#000000", color: "#FFFFFF" }}
      >
        {icon} Pay
      </div>
    </div>
  )
}

// ─── Cash form ──────────────────────────────────────────────────────
function CashForm({ totalUsd }: { totalUsd: number }) {
  return (
    <div
      className="space-y-1.5 rounded-xl border-2 px-4 py-4 text-center"
      style={{
        background: "linear-gradient(180deg, rgba(61,36,102,0.20) 0%, rgba(31,17,56,0.30) 100%)",
        borderColor: "rgba(77,212,216,0.30)",
      }}
    >
      <span className="text-3xl">💵</span>
      <p className="text-sm font-semibold" style={{ color: SAND }}>
        Pago en efectivo al motorizado
      </p>
      <p className="text-[11px] text-slate-400">
        Prepará ${totalUsd.toFixed(2)} exactos cuando llegue · el motorizado
        rara vez tiene cambio para billetes grandes
      </p>
    </div>
  )
}

// ─── Componente principal ──────────────────────────────────────────
export interface PaymentFormProps {
  priceUsd: number
  etaMinutes: number
  totalUsd: number
  onCancel: () => void
  onPay: (selectedMethod: PaymentMethod) => void | Promise<void>
}

export function PaymentForm({
  totalUsd,
  onCancel,
  onPay,
}: PaymentFormProps) {
  // priceUsd + etaMinutes son reservados para futuras integraciones
  // (mostrar resumen de envío adicional) · por ahora no se usan acá ·
  // viven en el resumen del cart drawer arriba
  const cart = useCart()
  const [method, setMethod] = useState<PaymentMethod>("card")

  // ── Card state ────────────────────────────────────────────────────
  const [savedCards, setSavedCards] = useState<SavedCard[]>([])
  const [selectedSavedCardId, setSelectedSavedCardId] = useState<string | null>(
    null,
  )
  const [cardNumber, setCardNumber] = useState("")
  const [expiry, setExpiry] = useState("")
  const [cvv, setCvv] = useState("")
  const [holder, setHolder] = useState("")
  const [saveCard, setSaveCard] = useState(false)

  // ── DeUna state ───────────────────────────────────────────────────
  const [deunaConfirmed, setDeunaConfirmed] = useState(false)

  // ── PayPhone state ────────────────────────────────────────────────
  const [payphoneStep, setPayphoneStep] = useState<"phone" | "otp" | "ready">(
    "phone",
  )
  const [payphonePhone, setPayphonePhone] = useState("")
  const [payphoneOtp, setPayphoneOtp] = useState("")

  // ── Email receipt ─────────────────────────────────────────────────
  const [emailReceipt, setEmailReceipt] = useState(false)
  const [emailReceiptAddress, setEmailReceiptAddress] = useState("")

  // ── Submit state ──────────────────────────────────────────────────
  const [submitting, setSubmitting] = useState(false)

  // Load saved cards + cached email on mount
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(LS_SAVED_CARDS)
      if (stored) {
        const parsed = JSON.parse(stored) as SavedCard[]
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSavedCards(parsed)
          setSelectedSavedCardId(parsed[0].id)
        }
      }
      const email = window.localStorage.getItem(LS_EMAIL_RECEIPT)
      if (email) {
        setEmailReceiptAddress(email)
      }
    } catch {
      // ignore
    }
  }, [])

  // ── Validation per method ─────────────────────────────────────────
  const cardValidNew =
    cardNumber.replace(/\s/g, "").length >= 12 &&
    /^\d{2}\/\d{2}$/.test(expiry) &&
    cvv.length >= 3 &&
    holder.trim().length >= 2
  const cardValid = method === "card" && (selectedSavedCardId !== null || cardValidNew)

  const canPay =
    method === "cash" ||
    cardValid ||
    (method === "deuna" && deunaConfirmed) ||
    (method === "payphone" && payphoneStep === "ready")
  // apple_pay/google_pay están disabled placeholders · canPay no aplica

  // ── Handlers ──────────────────────────────────────────────────────
  function handleSendPayphoneOtp() {
    if (payphonePhone.length < 9) return
    // Mock · en real wire enviaría OTP vía PayPhone API
    setPayphoneStep("otp")
  }

  function handleConfirmPayphoneOtp() {
    if (payphoneOtp.length < 4) return
    setPayphoneStep("ready")
  }

  function handlePay() {
    if (submitting || !canPay) return
    setSubmitting(true)

    // Save card si checkbox + new card
    if (method === "card" && saveCard && !selectedSavedCardId) {
      const newCard: SavedCard = {
        id: `card-${Date.now()}`,
        brand: detectCardBrand(cardNumber),
        last4: cardNumber.replace(/\D/g, "").slice(-4),
        expiry,
        holder,
      }
      try {
        const next = [...savedCards, newCard].slice(0, 3) // max 3 saved
        window.localStorage.setItem(LS_SAVED_CARDS, JSON.stringify(next))
      } catch {
        // ignore quota
      }
    }

    // Save email receipt preference
    if (emailReceipt && emailReceiptAddress) {
      try {
        window.localStorage.setItem(LS_EMAIL_RECEIPT, emailReceiptAddress)
      } catch {
        // ignore
      }
    }

    void onPay(method)
  }

  const isDigitalWallet = method === "apple_pay" || method === "google_pay"

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3
          className="font-[family-name:var(--font-bebas),sans-serif] text-xl tracking-wider"
          style={{ color: "#FFFFFF" }}
        >
          PAGO
        </h3>
        <button
          type="button"
          onClick={onCancel}
          className="text-[11px] font-medium text-slate-400 underline-offset-2 hover:underline"
        >
          ← Editar pedido
        </button>
      </div>

      {/* Total destacado */}
      <div
        className="flex items-baseline justify-between rounded-2xl border px-4 py-2.5"
        style={{
          background: "linear-gradient(90deg, rgba(77,212,216,0.10) 0%, rgba(61,36,102,0.15) 100%)",
          borderColor: "rgba(77,212,216,0.30)",
        }}
      >
        <span className="font-mono text-[10px] uppercase tracking-widest text-slate-400">
          Total a pagar
        </span>
        <span
          className="font-[family-name:var(--font-bebas),sans-serif] text-2xl tracking-wider"
          style={{ color: CYAN }}
        >
          ${totalUsd.toFixed(2)}
        </span>
      </div>

      {/* Method selector · 3x2 grid */}
      <div>
        <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-widest text-slate-400">
          ¿Cómo pagás?
        </span>
        <div className="grid grid-cols-3 gap-2">
          <MethodTab
            active={method === "card"}
            emoji="💳"
            label="Tarjeta"
            onClick={() => setMethod("card")}
          />
          <MethodTab
            active={method === "cash"}
            emoji="💵"
            label="Efectivo"
            onClick={() => setMethod("cash")}
          />
          <MethodTab
            active={method === "deuna"}
            emoji="🟣"
            label="DeUna"
            onClick={() => setMethod("deuna")}
          />
          <MethodTab
            active={method === "payphone"}
            emoji="📱"
            label="PayPhone"
            onClick={() => setMethod("payphone")}
          />
          <MethodTab
            active={method === "apple_pay"}
            emoji="🍎"
            label="Apple Pay"
            badge="pronto"
            disabled
            onClick={() => setMethod("apple_pay")}
          />
          <MethodTab
            active={method === "google_pay"}
            emoji="G"
            label="Google Pay"
            badge="pronto"
            disabled
            onClick={() => setMethod("google_pay")}
          />
        </div>
      </div>

      {/* Form por método */}
      {method === "card" ? (
        <CardForm
          savedCards={savedCards}
          selectedSavedCardId={selectedSavedCardId}
          onSelectSavedCard={(id) => setSelectedSavedCardId(id)}
          onUseNewCard={() => setSelectedSavedCardId(null)}
          cardNumber={cardNumber}
          setCardNumber={setCardNumber}
          expiry={expiry}
          setExpiry={setExpiry}
          cvv={cvv}
          setCvv={setCvv}
          holder={holder}
          setHolder={setHolder}
          saveCard={saveCard}
          setSaveCard={setSaveCard}
        />
      ) : method === "cash" ? (
        <CashForm totalUsd={totalUsd} />
      ) : method === "deuna" ? (
        <DeUnaForm
          confirmed={deunaConfirmed}
          onConfirm={() => setDeunaConfirmed(true)}
        />
      ) : method === "payphone" ? (
        <PayPhoneForm
          step={payphoneStep}
          phone={payphonePhone}
          setPhone={setPayphonePhone}
          otp={payphoneOtp}
          setOtp={setPayphoneOtp}
          onSendOtp={handleSendPayphoneOtp}
          onConfirmOtp={handleConfirmPayphoneOtp}
        />
      ) : isDigitalWallet ? (
        <DigitalWalletPlaceholder
          kind={method === "apple_pay" ? "apple" : "google"}
        />
      ) : null}

      {/* Propina motorizado · pattern Domino's · integrada en payment */}
      <div>
        <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-widest text-slate-400">
          Propina al motorizado · opcional
        </span>
        <TipChipsInline value={cart.tipUsd} onChange={cart.setTip} />
      </div>

      {/* Email receipt opcional */}
      <div>
        <label className="flex cursor-pointer items-center gap-2 text-[11px] text-slate-300">
          <input
            type="checkbox"
            checked={emailReceipt}
            onChange={(e) => setEmailReceipt(e.target.checked)}
            className="h-3.5 w-3.5 accent-cyan-400"
          />
          <span>Enviarme el recibo por email</span>
        </label>
        {emailReceipt ? (
          <input
            type="email"
            value={emailReceiptAddress}
            onChange={(e) => setEmailReceiptAddress(e.target.value)}
            placeholder="tu@email.com"
            className="mt-1.5 w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-cyan-500 focus:outline-none"
            autoComplete="email"
          />
        ) : null}
      </div>

      {/* Trust line · padlock + SSL + PCI + logos */}
      <div className="space-y-1.5 rounded-xl border border-slate-800 bg-slate-900/30 px-3 py-2">
        <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-400">
          <span>🔒</span>
          <span>Pago seguro · SSL 256-bit · PCI DSS compliant</span>
        </div>
        <div className="flex items-center justify-center gap-1.5">
          <BrandChip brand="visa" small />
          <BrandChip brand="mastercard" small />
          <BrandChip brand="amex" small />
          <BrandChip brand="discover" small />
          <DeUnaLogo small />
          <PayPhoneLogo small />
        </div>
      </div>

      {/* CTA · big purple button */}
      <button
        type="button"
        onClick={handlePay}
        disabled={!canPay || submitting}
        style={{
          background:
            canPay && !submitting
              ? `linear-gradient(90deg, ${CYAN} 0%, ${CYAN_DARK} 100%)`
              : "rgba(60,60,60,0.5)",
          boxShadow:
            canPay && !submitting
              ? "0 14px 32px -12px rgba(77,212,216,0.55)"
              : "none",
          color: canPay && !submitting ? PURPLE_DARK : "rgba(255,255,255,0.4)",
        }}
        className="flex w-full items-center justify-center gap-2 rounded-full px-3 py-3 text-base font-bold disabled:cursor-not-allowed"
      >
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Procesando...
          </>
        ) : (
          <>🔒 Pagar ${totalUsd.toFixed(2)}</>
        )}
      </button>
    </div>
  )
}
