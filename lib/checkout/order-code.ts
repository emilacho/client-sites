import "server-only"
/**
 * Order code generator · Round 98.
 *
 * Matches the format produced by SQL function
 * `public.gen_naufrago_order_code()` (R96 migration): `NF-YYYY-XXXXXX`
 * where YYYY is the year in America/Guayaquil and XXXXXX is 6
 * upper-case hex chars.
 *
 * Computed in JS so the API can pre-compute the code, return it
 * in the response, and pass it to the insert. (DB column has no
 * default referencing the function · the API is authoritative.)
 */
import { randomBytes } from "node:crypto"

function yearGuayaquil(): string {
  // America/Guayaquil is fixed UTC-5 with no DST · safe to use Intl
  // with a hardcoded timeZone option.
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Guayaquil",
    year: "numeric",
  })
  return fmt.format(new Date())
}

export function generateOrderCode(): string {
  const yr = yearGuayaquil()
  const hex = randomBytes(3).toString("hex").toUpperCase()
  return `NF-${yr}-${hex}`
}
