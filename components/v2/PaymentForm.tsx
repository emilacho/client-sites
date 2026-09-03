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

// ─── Brand logos SVG · inline · brand-accurate ──────────────────────
function BrandChip({ brand, small }: { brand: CardBrand; small?: boolean }) {
  if (brand === "unknown") {
    return (
      <span
        className={[
          "flex items-center justify-center rounded text-[9px]",
          small ? "h-5 w-9" : "h-6 w-11",
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
  const h = small ? 20 : 24
  const w = small ? 36 : 44
  if (brand === "visa") {
    return (
      <span
        className="flex items-center justify-center rounded bg-white px-1"
        style={{ width: w, height: h }}
      >
        <svg viewBox="0 0 60 20" width={w - 6} height={h - 6}>
          <text
            x="30"
            y="15"
            textAnchor="middle"
            fontFamily="Arial Black, sans-serif"
            fontWeight="900"
            fontSize="14"
            fontStyle="italic"
            fill="#1A1F71"
            letterSpacing="0.5"
          >
            VISA
          </text>
        </svg>
      </span>
    )
  }
  if (brand === "mastercard") {
    return (
      <span
        className="flex items-center justify-center rounded bg-white px-1"
        style={{ width: w, height: h }}
      >
        <svg viewBox="0 0 40 24" width={w - 6} height={h - 4}>
          <circle cx="14" cy="12" r="9" fill="#EB001B" />
          <circle cx="26" cy="12" r="9" fill="#F79E1B" />
          <path
            d="M20 5.5 A 9 9 0 0 1 20 18.5 A 9 9 0 0 1 20 5.5 Z"
            fill="#FF5F00"
          />
        </svg>
      </span>
    )
  }
  if (brand === "amex") {
    return (
      <span
        className="flex items-center justify-center rounded px-1"
        style={{ width: w, height: h, background: "#006FCF" }}
      >
        <svg viewBox="0 0 60 20" width={w - 6} height={h - 6}>
          <text
            x="30"
            y="14"
            textAnchor="middle"
            fontFamily="Arial Black, sans-serif"
            fontWeight="900"
            fontSize="11"
            fill="#FFFFFF"
            letterSpacing="-0.5"
          >
            AMEX
          </text>
        </svg>
      </span>
    )
  }
  if (brand === "discover") {
    return (
      <span
        className="flex items-center justify-center rounded bg-white px-1"
        style={{ width: w, height: h }}
      >
        <svg viewBox="0 0 60 20" width={w - 6} height={h - 6}>
          <text
            x="30"
            y="14"
            textAnchor="middle"
            fontFamily="Arial Black, sans-serif"
            fontWeight="900"
            fontSize="9"
            fill="#000000"
            letterSpacing="-0.3"
          >
            DISCOVER
          </text>
          <circle cx="50" cy="13" r="3" fill="#FF6000" />
        </svg>
      </span>
    )
  }
  return null
}

// ─── DeUna logo · branding Banco Pichincha ──────────────────────────
function DeUnaLogo({ small }: { small?: boolean }) {
  const w = small ? 44 : 56
  const h = small ? 20 : 24
  return (
    <span
      className="flex items-center justify-center rounded"
      style={{ width: w, height: h, background: "#FFFFFF" }}
    >
      <svg viewBox="0 0 60 20" width={w - 6} height={h - 6}>
        <text
          x="30"
          y="15"
          textAnchor="middle"
          fontFamily="system-ui, -apple-system, sans-serif"
          fontWeight="800"
          fontSize="14"
          letterSpacing="-0.5"
        >
          <tspan fill="#7B1FA2">De</tspan>
          <tspan fill="#FFC107">Una</tspan>
        </text>
      </svg>
    </span>
  )
}

// ─── PayPhone logo · branding ecuatoriano ───────────────────────────
function PayPhoneLogo({ small }: { small?: boolean }) {
  const w = small ? 56 : 68
  const h = small ? 20 : 24
  return (
    <span
      className="flex items-center justify-center rounded"
      style={{ width: w, height: h, background: "#FFFFFF" }}
    >
      <svg viewBox="0 0 100 20" width={w - 6} height={h - 6}>
        <text
          x="50"
          y="14"
          textAnchor="middle"
          fontFamily="system-ui, -apple-system, sans-serif"
          fontWeight="800"
          fontSize="13"
          fill="#0E2A5C"
          letterSpacing="-0.3"
        >
          PayPhone
        </text>
      </svg>
    </span>
  )
}

// ─── Apple Pay button · brand-accurate · black rounded ──────────────
function ApplePayButton({
  onClick,
  disabled,
}: {
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center justify-center gap-2 rounded-full px-4 py-3 font-semibold disabled:cursor-not-allowed disabled:opacity-50"
      style={{
        background: "#000000",
        color: "#FFFFFF",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, system-ui, sans-serif",
      }}
    >
      <svg width="20" height="24" viewBox="0 0 17 21" fill="currentColor">
        <path d="M14.0833 11.0166C14.0667 8.9166 15.7167 7.875 15.7917 7.825C14.7833 6.35 13.2083 6.1416 12.65 6.125C11.325 5.9833 10.05 6.9166 9.375 6.9166C8.6833 6.9166 7.6417 6.1416 6.525 6.1666C5.075 6.1833 3.725 7.025 2.9833 8.325C1.475 10.9416 2.6083 14.825 4.075 16.95C4.8083 17.9833 5.6667 19.1416 6.7917 19.1C7.8917 19.0583 8.3 18.4 9.625 18.4C10.95 18.4 11.325 19.1 12.475 19.075C13.6583 19.05 14.4 18.0333 15.1083 17C15.9583 15.825 16.3083 14.675 16.325 14.625C16.3 14.6166 14.1 13.7666 14.0833 11.0166ZM11.95 4.75C12.5333 4.0416 12.9333 3.05 12.8 2.0666C11.975 2.1 10.95 2.625 10.3417 3.3166C9.8 3.9333 9.3083 4.9666 9.45 5.925C10.3833 5.9916 11.35 5.45 11.95 4.75Z" />
      </svg>
      <span className="text-base">Pay</span>
    </button>
  )
}

// ─── Google Pay button · brand-accurate · white o black ─────────────
function GooglePayButton({
  onClick,
  disabled,
}: {
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center justify-center gap-1 rounded-full border-2 px-4 py-3 font-medium disabled:cursor-not-allowed disabled:opacity-50"
      style={{
        background: "#FFFFFF",
        borderColor: "#DADCE0",
        color: "#3C4043",
        fontFamily: "Roboto, system-ui, sans-serif",
      }}
    >
      {/* G logo multicolor · simplificado */}
      <svg width="26" height="26" viewBox="0 0 48 48">
        <path
          fill="#4285F4"
          d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
        />
        <path
          fill="#34A853"
          d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
        />
        <path
          fill="#FBBC05"
          d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
        />
        <path
          fill="#EA4335"
          d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
        />
      </svg>
      <span className="text-base">Pay</span>
    </button>
  )
}

// ─── Icons SVG · check verde + lock · reemplazan emojis ✅ 🔒 ───────
function CheckIcon({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="11" fill="#10B981" />
      <path
        d="M7 12.5l3.5 3.5L17 9"
        stroke="#FFFFFF"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  )
}

function LockIcon({ size = 14, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <path
        d="M5 9V6.5a5 5 0 0 1 10 0V9M4 9h12v9H4z"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="10" cy="13.5" r="1.4" fill={color} />
    </svg>
  )
}

function CashIconLarge() {
  return (
    <svg width="44" height="32" viewBox="0 0 44 32" fill="none">
      <rect x="2" y="4" width="40" height="24" rx="3" fill="#16A34A" stroke="#15803D" strokeWidth="1.5" />
      <rect x="5" y="7" width="34" height="18" rx="1.5" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="0.8" />
      <circle cx="22" cy="16" r="6" fill="none" stroke="#FFFFFF" strokeWidth="1.2" />
      <text
        x="22"
        y="20"
        textAnchor="middle"
        fontFamily="Arial Black, sans-serif"
        fontSize="11"
        fontWeight="900"
        fill="#FFFFFF"
      >
        $
      </text>
    </svg>
  )
}

// ─── Method tab · brand logo node + label ───────────────────────────
function MethodTab({
  active,
  disabled,
  logo,
  label,
  onClick,
}: {
  active: boolean
  disabled?: boolean
  logo: React.ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        "relative flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 px-2 py-2.5 text-[11px] font-semibold transition-all",
        active
          ? "border-[#4DD4D8] bg-[rgba(77,212,216,0.10)] text-cyan-200"
          : disabled
            ? "border-slate-800 bg-slate-950/50 text-slate-600"
            : "border-slate-700 bg-slate-950 text-slate-400 hover:border-slate-600",
      ].join(" ")}
    >
      <span className="flex h-7 items-center justify-center">{logo}</span>
      <span className="leading-tight">{label}</span>
    </button>
  )
}

// ─── Tab logos · cada método con su brand mark ──────────────────────

// Tarjeta tab · 3 mini cards stacked (Visa/MC/Amex)
function CardsStackLogo() {
  return (
    <div className="flex items-center gap-0.5">
      <BrandChip brand="visa" small />
      <BrandChip brand="mastercard" small />
    </div>
  )
}

// Efectivo · icono $ minimalista · NO emoji (Emilio aprobó genérico aquí)
function CashLogo() {
  return (
    <svg width="28" height="22" viewBox="0 0 32 24" fill="none">
      <rect
        x="2"
        y="4"
        width="28"
        height="16"
        rx="2"
        fill="#16A34A"
        stroke="#15803D"
        strokeWidth="1"
      />
      <circle cx="16" cy="12" r="4.5" fill="none" stroke="#FFFFFF" strokeWidth="1" />
      <text
        x="16"
        y="15"
        textAnchor="middle"
        fontFamily="Arial Black, sans-serif"
        fontSize="8"
        fontWeight="900"
        fill="#FFFFFF"
      >
        $
      </text>
    </svg>
  )
}

// Apple Pay tab · Apple SVG + Pay text · compacto
function ApplePayTabLogo() {
  return (
    <div
      className="flex h-6 items-center justify-center gap-0.5 rounded px-1.5"
      style={{ background: "#000000", color: "#FFFFFF" }}
    >
      <svg width="11" height="13" viewBox="0 0 17 21" fill="currentColor">
        <path d="M14.0833 11.0166C14.0667 8.9166 15.7167 7.875 15.7917 7.825C14.7833 6.35 13.2083 6.1416 12.65 6.125C11.325 5.9833 10.05 6.9166 9.375 6.9166C8.6833 6.9166 7.6417 6.1416 6.525 6.1666C5.075 6.1833 3.725 7.025 2.9833 8.325C1.475 10.9416 2.6083 14.825 4.075 16.95C4.8083 17.9833 5.6667 19.1416 6.7917 19.1C7.8917 19.0583 8.3 18.4 9.625 18.4C10.95 18.4 11.325 19.1 12.475 19.075C13.6583 19.05 14.4 18.0333 15.1083 17C15.9583 15.825 16.3083 14.675 16.325 14.625C16.3 14.6166 14.1 13.7666 14.0833 11.0166ZM11.95 4.75C12.5333 4.0416 12.9333 3.05 12.8 2.0666C11.975 2.1 10.95 2.625 10.3417 3.3166C9.8 3.9333 9.3083 4.9666 9.45 5.925C10.3833 5.9916 11.35 5.45 11.95 4.75Z" />
      </svg>
      <span
        className="text-[10px] font-semibold"
        style={{ fontFamily: "-apple-system, BlinkMacSystemFont, system-ui, sans-serif" }}
      >
        Pay
      </span>
    </div>
  )
}

// Google Pay tab · G multicolor + Pay text · white background
function GooglePayTabLogo() {
  return (
    <div
      className="flex h-6 items-center justify-center gap-0.5 rounded border px-1.5"
      style={{ background: "#FFFFFF", borderColor: "#DADCE0", color: "#3C4043" }}
    >
      <svg width="12" height="12" viewBox="0 0 48 48">
        <path
          fill="#4285F4"
          d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
        />
        <path
          fill="#34A853"
          d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
        />
        <path
          fill="#FBBC05"
          d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
        />
        <path
          fill="#EA4335"
          d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
        />
      </svg>
      <span
        className="text-[10px] font-medium"
        style={{ fontFamily: "Roboto, system-ui, sans-serif" }}
      >
        Pay
      </span>
    </div>
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
          <div className="flex justify-center">
            <CheckIcon size={36} />
          </div>
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
        <div className="space-y-1 text-center">
          <div className="flex justify-center">
            <CheckIcon size={36} />
          </div>
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

// ─── Apple Pay / Google Pay form · botones oficiales styled ─────────
// Hoy click → mock validating · cuando Kushki esté wireado · el click
// invoca el SDK real (ApplePaySession para iOS · google.payments.api
// para Android) que abre el sheet nativo del wallet del cliente.
function DigitalWalletForm({
  kind,
  confirmed,
  validating,
  onTrigger,
}: {
  kind: "apple" | "google"
  confirmed: boolean
  validating: boolean
  onTrigger: () => void
}) {
  return (
    <div
      className="space-y-3 rounded-xl border-2 px-4 py-4"
      style={{
        background:
          kind === "apple"
            ? "linear-gradient(180deg, rgba(0,0,0,0.30) 0%, rgba(0,0,0,0.45) 100%)"
            : "linear-gradient(180deg, rgba(66,133,244,0.10) 0%, rgba(52,168,83,0.15) 100%)",
        borderColor:
          kind === "apple" ? "rgba(255,255,255,0.30)" : "rgba(66,133,244,0.40)",
      }}
    >
      {confirmed ? (
        <div className="space-y-1 text-center">
          <div className="flex justify-center">
            <CheckIcon size={36} />
          </div>
          <p className="mt-1 text-sm font-semibold text-emerald-300">
            {kind === "apple" ? "Apple Pay" : "Google Pay"} confirmado
          </p>
          <p className="text-[11px] text-slate-400">
            Procesando · click Pagar para finalizar
          </p>
        </div>
      ) : validating ? (
        <div className="flex items-center justify-center gap-2 py-3 text-sm text-slate-300">
          <Loader2 className="h-4 w-4 animate-spin" />
          Validando con tu wallet...
        </div>
      ) : (
        <>
          <p className="text-center text-[11px] text-slate-300">
            {kind === "apple"
              ? "Confirma con Touch ID / Face ID en tu iPhone"
              : "Selecciona tu tarjeta guardada en Google Pay"}
          </p>
          {kind === "apple" ? (
            <ApplePayButton onClick={onTrigger} />
          ) : (
            <GooglePayButton onClick={onTrigger} />
          )}
        </>
      )}
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
      <div className="flex justify-center">
        <CashIconLarge />
      </div>
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
  /** R148 · las formas que el SERVIDOR dice que se pueden cobrar de
   *  verdad. La pantalla muestra estas y sólo estas. Vacío = todavía no
   *  contestó · no se ofrece ninguna, antes que ofrecer uno que no cobra. */
  metodosDisponibles: string[]
  onCancel: () => void
  onPay: (selectedMethod: PaymentMethod) => void | Promise<void>
}

export function PaymentForm({
  totalUsd,
  metodosDisponibles,
  onCancel,
  onPay,
}: PaymentFormProps) {
  // priceUsd + etaMinutes son reservados para futuras integraciones
  // (mostrar resumen de envío adicional) · por ahora no se usan acá ·
  // viven en el resumen del cart drawer arriba
  const cart = useCart()
  // Si la lista viene vacía —el servidor no contestó, o contestó una
  // versión vieja— se cae a efectivo, que es la única que SIEMPRE se
  // puede cobrar. Mejor una sola forma real que ninguna, o que seis de
  // mentira.
  const lista = metodosDisponibles.length > 0 ? metodosDisponibles : ["cash"]
  const disponible = (m: PaymentMethod) => lista.includes(m)
  const [method, setMethod] = useState<PaymentMethod>(
    (lista[0] as PaymentMethod) ?? "cash",
  )

  // Si la lista llega o cambia después del primer dibujo, y lo que
  // estaba elegido no está en ella, se corrige solo.
  const listaFirma = lista.join(",")
  useEffect(() => {
    const actuales = listaFirma.split(",")
    if (!actuales.includes(method)) {
      setMethod(actuales[0] as PaymentMethod)
    }
  }, [listaFirma, method])

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

  // ── Apple Pay / Google Pay state ──────────────────────────────────
  const [walletValidating, setWalletValidating] = useState(false)
  const [walletConfirmed, setWalletConfirmed] = useState<
    "apple" | "google" | null
  >(null)

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
    (method === "payphone" && payphoneStep === "ready") ||
    (method === "apple_pay" && walletConfirmed === "apple") ||
    (method === "google_pay" && walletConfirmed === "google")

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

  // Apple/Google Pay trigger · mock por ahora · cuando esté Kushki
  // wireado invoca el SDK real del wallet (ApplePaySession / google.payments)
  function handleWalletTrigger(kind: "apple" | "google") {
    if (walletValidating || walletConfirmed) return
    setWalletValidating(true)
    window.setTimeout(() => {
      setWalletValidating(false)
      setWalletConfirmed(kind)
    }, 1500)
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
          ¿Cómo pagas?
        </span>
        <div className="grid grid-cols-3 gap-2">
          {disponible("card") ? (
          <MethodTab
            active={method === "card"}
            logo={<CardsStackLogo />}
            label="Tarjeta"
            onClick={() => setMethod("card")}
          />
          ) : null}
          {disponible("cash") ? (
          <MethodTab
            active={method === "cash"}
            logo={<CashLogo />}
            label="Efectivo"
            onClick={() => setMethod("cash")}
          />
          ) : null}
          {disponible("deuna") ? (
          <MethodTab
            active={method === "deuna"}
            logo={<DeUnaLogo small />}
            label="DeUna"
            onClick={() => setMethod("deuna")}
          />
          ) : null}
          {disponible("payphone") ? (
          <MethodTab
            active={method === "payphone"}
            logo={<PayPhoneLogo small />}
            label="PayPhone"
            onClick={() => setMethod("payphone")}
          />
          ) : null}
          {disponible("apple_pay") ? (
          <MethodTab
            active={method === "apple_pay"}
            logo={<ApplePayTabLogo />}
            label="Apple Pay"
            onClick={() => setMethod("apple_pay")}
          />
          ) : null}
          {disponible("google_pay") ? (
          <MethodTab
            active={method === "google_pay"}
            logo={<GooglePayTabLogo />}
            label="Google Pay"
            onClick={() => setMethod("google_pay")}
          />
          ) : null}
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
        <DigitalWalletForm
          kind={method === "apple_pay" ? "apple" : "google"}
          confirmed={
            walletConfirmed === (method === "apple_pay" ? "apple" : "google")
          }
          validating={walletValidating}
          onTrigger={() =>
            handleWalletTrigger(method === "apple_pay" ? "apple" : "google")
          }
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
          <LockIcon size={12} color="#94A3B8" />
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
          <>
            <LockIcon size={16} color={canPay && !submitting ? PURPLE_DARK : "rgba(255,255,255,0.4)"} />
            <span>Pagar ${totalUsd.toFixed(2)}</span>
          </>
        )}
      </button>
    </div>
  )
}
