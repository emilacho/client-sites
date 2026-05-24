import { NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase"

/**
 * GET /api/dynamic-options/[key] · R96.25 · dynamic variants catalog.
 *
 * Cliente lee desde tabla naufrago_dynamic_options · catálogos
 * editables runtime sin redeploy (ej. sabor del día de jugos).
 * Cache CDN 5min · ETL local actualiza via Supabase Studio.
 */
export const runtime = "nodejs"
export const revalidate = 300

const VALID_KEY_REGEX = /^[a-z0-9_]{1,40}$/

interface DynamicOption {
  id: string
  label: string
  available?: boolean
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ key: string }> },
) {
  const { key } = await ctx.params
  if (!VALID_KEY_REGEX.test(key)) {
    return NextResponse.json(
      { ok: false, error: "invalid_key" },
      { status: 400 },
    )
  }

  try {
    const supa = getSupabaseAdmin()
    const { data, error } = await supa
      .from("naufrago_dynamic_options")
      .select("label, options, updated_at")
      .eq("client_slug", "naufrago")
      .eq("key", key)
      .maybeSingle()

    if (error || !data) {
      return NextResponse.json({
        ok: true,
        key,
        label: null,
        options: [],
        updatedAt: null,
      })
    }

    // Filter out unavailable ones (option.available === false)
    const opts = (data.options as DynamicOption[]).filter(
      (o) => o.available !== false,
    )

    return new NextResponse(
      JSON.stringify({
        ok: true,
        key,
        label: data.label,
        options: opts,
        updatedAt: data.updated_at,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control":
            "public, max-age=300, s-maxage=300, stale-while-revalidate=600",
        },
      },
    )
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "unknown_error",
      },
      { status: 500 },
    )
  }
}
