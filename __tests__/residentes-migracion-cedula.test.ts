// Tarjeta de residente · migración «cédula + fecha de nacimiento» (revisión del texto; la corrida real se
// probó en un Postgres en memoria encima de la primera migración, ver el papel PARA-CERTIFICAR).
import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"

const leer = (ruta: string) => readFileSync(ruta, "utf8").replace(/\r\n/g, "\n")
const mig = leer("supabase/migrations/202611121200_naufrago_residentes_cedula_nacimiento.sql")
const rev = leer("supabase/reversas/202611121200_naufrago_residentes_cedula_nacimiento_REVERSA.sql")
const primera = leer("supabase/migrations/202611120300_naufrago_residentes.sql")
const NUEVA = "registrar_residente(text, text, text, text, text, text, text, date, boolean)"
const VIEJA = "registrar_residente(text, text, text, text, text, text, smallint, smallint, boolean)"

describe("migración cédula + fecha de nacimiento", () => {
  it("una transacción que solo toca naufrago.residentes y la función de registro", () => {
    expect(mig.split("\n").find((l) => l && !l.startsWith("--"))).toBe("begin;")
    expect(mig.trimEnd().endsWith("commit;")).toBe(true)
    const tocadas = [...mig.matchAll(/(?:alter table|revoke all on|grant [a-z, ]+ on|drop table|insert into|update)\s+naufrago\.(\w+)/gi)].map((m) => m[1])
    for (const t of tocadas) expect(["residentes", "residente_codigos"]).toContain(t)
    expect(mig).not.toMatch(/drop column|drop table/i)
  })
  it("la cédula: solo números de 6 a 15, una tarjeta activa por cédula, y obligatoria al registrar", () => {
    expect(mig).toContain("add column cedula text check (cedula ~ '^[0-9]{6,15}$')")
    expect(mig).toContain("create unique index residentes_cedula_activa on naufrago.residentes (cedula) where baja_en is null and cedula is not null;")
    expect(mig).toContain("raise exception 'cédula obligatoria';")
    expect(mig).toContain("return jsonb_build_object('resultado', 'cedula_registrada');")
    expect(mig).toContain("if v_restr = 'residentes_cedula_activa' then")
  })
  it("la fecha de nacimiento: con año, desde 1900 y no en el futuro (día de Ecuador)", () => {
    expect(mig).toContain("add column fecha_nacimiento date check (fecha_nacimiento >= date '1900-01-01')")
    expect(mig).toContain("p_fecha_nacimiento > (now() at time zone 'America/Guayaquil')::date")
  })
  it("cambia la firma y la cierra: afuera nada, el servidor sí, y queda una sola", () => {
    expect(mig).toContain(`drop function naufrago.${VIEJA};`)
    expect(mig).toContain(`revoke all on function naufrago.${NUEVA} from public, anon, authenticated;`)
    expect(mig).toContain(`grant execute on function naufrago.${NUEVA} to service_role;`)
    expect(mig).toContain("raise exception 'columna abierta: cedula'")
    expect(mig).toContain("raise exception 'quedó más de una registrar_residente'")
    expect(mig).not.toMatch(/grant [^;]* to (anon|authenticated|public)/i)
  })
  it("la reversa vuelve a la función vieja copiada EXACTA de la primera migración", () => {
    const inicio = primera.indexOf("-- acepta novedades = la casilla")
    const fin = primera.indexOf("$$;", inicio) + 3
    const vieja = primera.slice(inicio, fin)
    expect(vieja.length).toBeGreaterThan(500)
    expect(rev).toContain(vieja)
    expect(rev).toContain(`drop function if exists naufrago.${NUEVA};`)
    expect(rev).toContain(`grant execute on function naufrago.${VIEJA} to service_role;`)
    expect(rev).toContain("drop index if exists naufrago.residentes_cedula_activa;")
    expect(rev).toContain("alter table naufrago.residentes drop column if exists fecha_nacimiento, drop column if exists cedula;")
  })
})
