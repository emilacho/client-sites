"use client"
/**
 * useQaMode · returns `true` when the page is loaded with `?qa=1` in
 * the query string. Used to freeze the 3D scene's camera + disable
 * idle pulse + disable the character speech bubble so QA harnesses
 * can capture pixel-comparable screenshots across deploys.
 *
 * SSR-safe · returns `false` during SSR and the actual flag after
 * hydration. Re-reads on subsequent navigations via popstate / Next
 * router push (Next's `?` updates do NOT trigger a remount of the
 * top-level page, so we listen for popstate explicitly).
 */
import { useEffect, useState } from "react"

export function useQaMode(): boolean {
  const [qa, setQa] = useState(false)
  useEffect(() => {
    const read = () =>
      setQa(new URLSearchParams(window.location.search).get("qa") === "1")
    read()
    window.addEventListener("popstate", read)
    return () => window.removeEventListener("popstate", read)
  }, [])
  return qa
}
