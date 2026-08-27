"use client"
/**
 * SpeechBubble · the character's hover bubble.
 *
 *  - "Pilas con ese YADO!" in Permanent Marker
 *  - violet border, soft drop-shadow
 *  - fade-in 200ms via framer-motion
 *  - desktop: shows while parent says `visible`
 *  - mobile: parent toggles via tap; this component hides itself
 *    after `autoHideMs` if `mobileAuto = true`
 */
import { useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"

export interface SpeechBubbleProps {
  visible: boolean
  /** When true, schedules a hide-after-3s on every visible→true edge. */
  mobileAuto?: boolean
  onAutoHide?: () => void
  className?: string
}

export function SpeechBubble({
  visible,
  mobileAuto = false,
  onAutoHide,
  className,
}: SpeechBubbleProps) {
  useEffect(() => {
    if (!visible || !mobileAuto || !onAutoHide) return
    const t = window.setTimeout(onAutoHide, 3000)
    return () => window.clearTimeout(t)
  }, [visible, mobileAuto, onAutoHide])

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          initial={{ opacity: 0, y: 6, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 4, scale: 0.97 }}
          transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
          className={[
            "relative inline-block rounded-2xl border-2 bg-white px-4 py-2 text-base text-slate-900",
            "font-[var(--font-marker)] shadow-[0_8px_24px_-6px_rgba(124,58,237,0.5)]",
            className ?? "",
          ].join(" ")}
          style={{
            borderColor: "#7c3aed",
            // Use Permanent Marker (loaded via next/font in the page) and
            // a comfy fallback so the bubble doesn't FOUC.
            fontFamily: 'var(--font-marker), "Permanent Marker", cursive',
          }}
        >
          ¡Pilas con ese YADO!
          {/* Speech-bubble tail */}
          <span
            aria-hidden
            className="absolute -bottom-2 left-6 h-0 w-0"
            style={{
              borderLeft: "8px solid transparent",
              borderRight: "8px solid transparent",
              borderTop: "10px solid #7c3aed",
            }}
          />
          <span
            aria-hidden
            className="absolute -bottom-[6px] left-[26px] h-0 w-0"
            style={{
              borderLeft: "6px solid transparent",
              borderRight: "6px solid transparent",
              borderTop: "8px solid white",
            }}
          />
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
