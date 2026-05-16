import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Tailwind class merger · resolves conflicts via tailwind-merge, joins via clsx.
 * Used by every shadcn/ui component and the canon utility primitives.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
