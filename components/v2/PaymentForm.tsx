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

const LS_SAVED_CARDS = "naufrago_saved_cards"
const LS_EMAIL_RECEIPT = "naufrago_email_receipt"

// R164 · acá vivían el detector de marca de tarjeta y los que le daban
// formato al número y a la fecha mientras el cliente escribía. No hacen
// falta: esas casillas ya no existen · las pide PayPhone.

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
        Prepara ${totalUsd.toFixed(2)} exactos cuando llegue · el motorizado
        rara vez tiene cambio para billetes grandes
      </p>
    </div>
  )
}

/**
 * R164 · lo que se le muestra al cliente cuando elige tarjeta.
 *
 * Es a propósito corto: la promesa (pago protegido), qué va a pasar
 * (se abre el formulario de PayPhone) y cuánto. Nada más · cada casilla
 * de más en esta pantalla es un cliente menos que termina el pedido.
 */
function PagoSeguroAviso({ totalUsd }: { totalUsd: number }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3.5">
      <p className="text-sm font-semibold text-white">Pago protegido</p>
      <p className="mt-1 text-xs leading-relaxed text-white/60">
        Al continuar se abre el formulario seguro de PayPhone para que
        ingreses tu tarjeta. Tus datos viajan directo a ellos · nosotros
        nunca los vemos ni los guardamos.
      </p>
      <p className="mt-2.5 text-xs text-white/50">
        Se cobrará{" "}
        <span className="font-semibold text-white">${totalUsd.toFixed(2)}</span>{" "}
        y tu pedido sale a la cocina apenas se apruebe.
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

  // R164 · acá vivían el número de tarjeta, la fecha, el código de
  // seguridad, el nombre del titular, las tarjetas guardadas y un
  // código de verificación de PayPhone. Ninguno cobraba nada · y el
  // navegador del cliente terminaba guardando los últimos dígitos de
  // su tarjeta sin necesidad. Todo eso ahora lo pide PayPhone en su
  // propio formulario.

  // ── DeUna state ───────────────────────────────────────────────────
  const [deunaConfirmed, setDeunaConfirmed] = useState(false)

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

  // R164 · se leía el correo guardado y TAMBIÉN las tarjetas guardadas
  // en este navegador. Lo segundo se fue: no se guarda ninguna tarjeta.
  useEffect(() => {
    try {
      const email = window.localStorage.getItem(LS_EMAIL_RECEIPT)
      if (email) setEmailReceiptAddress(email)
      // Limpieza · si un cliente viejo tiene tarjetas guardadas de la
      // versión anterior, se le borran de su navegador al pasar por acá.
      window.localStorage.removeItem(LS_SAVED_CARDS)
    } catch {
      // ignore
    }
  }, [])

  const canPay =
    method === "cash" ||
    // R164 · la tarjeta ya NO se escribe acá. Los datos se cargan en el
    // formulario de PayPhone, que se abre en el paso siguiente · esta
    // pantalla sólo elige la forma de pago. Por eso no hay nada que
    // validar: el botón está listo desde el principio.
    method === "card" ||
    method === "payphone" ||
    (method === "deuna" && deunaConfirmed) ||
    (method === "apple_pay" && walletConfirmed === "apple") ||
    (method === "google_pay" && walletConfirmed === "google")

  // ── Handlers ──────────────────────────────────────────────────────

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
      {method === "card" || method === "payphone" ? (
        // R164 · acá NO se piden datos de tarjeta.
        //
        // Antes esta pantalla tenía casillas para el número, la fecha y
        // el código de seguridad · y no cobraban nada: eran de adorno.
        // Peor: los guardaba en el propio navegador del cliente.
        //
        // Ahora los datos se escriben en el formulario de PayPhone, que
        // es de ellos y está certificado para eso. Nosotros nunca vemos
        // ni guardamos un número de tarjeta.
        <PagoSeguroAviso totalUsd={totalUsd} />
      ) : method === "cash" ? (
        <CashForm totalUsd={totalUsd} />
      ) : method === "deuna" ? (
        <DeUnaForm
          confirmed={deunaConfirmed}
          onConfirm={() => setDeunaConfirmed(true)}
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
        {/* R167 · LA PROPINA ES SIEMPRE EN EFECTIVO, TAMBIÉN CON TARJETA.
            Esa plata es del motorizado. Si la cobráramos con la tarjeta,
            entraría a la cuenta del local y después habría que hacérsela
            llegar · quedaríamos debiéndosela. Así que el cliente la
            elige acá igual que siempre, pero se la entrega en la mano.
            Sin esta línea, quien paga con tarjeta cree que la propina ya
            fue y el motorizado se queda sin nada. */}
        {(method === "card" || method === "payphone") && cart.tipUsd > 0 ? (
          <p className="mt-1.5 text-[11px] leading-snug text-amber-200/80">
            Esta propina se la entregas al motorizado{" "}
            <strong className="font-semibold">en efectivo</strong> cuando
            recibas el pedido · no se cobra con la tarjeta.
          </p>
        ) : null}
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

      {/* R148.1 · La franja de abajo anunciaba VISA, Mastercard, AMEX,
          Discover, DeUna y PayPhone · y ninguna cobraba. Un cliente que
          llegaba a pagar en efectivo veía seis logos de tarjeta y podía
          irse creyendo que se había equivocado de sitio.

          Y decía "PCI DSS compliant", que es una certificación que este
          formulario no tiene y hoy ni necesita: no toca una tarjeta.
          Anunciar una certificación que no se tiene no es un adorno.

          Ahora sólo se muestran los logos de lo que de verdad se puede
          cobrar. Con una sola forma, la franja entera sobra. */}
      {disponible("card") ? (
        <div className="space-y-1.5 rounded-xl border border-slate-800 bg-slate-900/30 px-3 py-2">
          <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-400">
            <LockIcon size={12} color="#94A3B8" />
            <span>Pago seguro · el número de tu tarjeta no pasa por nosotros</span>
          </div>
          <div className="flex items-center justify-center gap-1.5">
            <BrandChip brand="visa" small />
            <BrandChip brand="mastercard" small />
            <BrandChip brand="amex" small />
            <BrandChip brand="discover" small />
            {disponible("payphone") ? <PayPhoneLogo small /> : null}
          </div>
        </div>
      ) : null}

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
