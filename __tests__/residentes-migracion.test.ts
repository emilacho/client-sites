// Tarjeta de residente · la migración nace cerrada y la reversa la deshace (revisión del texto;
// la corrida real se probó en un Postgres en memoria, ver el papel PARA-CERTIFICAR).
import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"

const mig = readFileSync("supabase/migrations/202611120300_naufrago_residentes.sql", "utf8")
const rev = readFileSync("supabase/reversas/202611120300_naufrago_residentes_REVERSA.sql", "utf8")
const TABLAS = ["residente_codigos", "residentes", "residente_visitas"]

describe("migración de residentes", () => {
  it("crea las 3 tablas y la función de registro, todo en una transacción", () => {
    for (const t of TABLAS) expect(mig).toContain(`create table naufrago.${t} (`)
    expect(mig).toContain("create function naufrago.registrar_residente(p_codigo text, p_nombre text, p_whatsapp text, p_ficha text)")
    expect(mig.trimStart().split("\n").find((l) => l && !l.startsWith("--"))).toBe("begin;")
    expect(mig.trimEnd().endsWith("commit;")).toBe(true)
  })
  it("cierra afuera las 3 tablas, sus contadores y la función; el servidor conserva acceso", () => {
    for (const t of TABLAS) {
      expect(mig).toMatch(new RegExp(`revoke all on naufrago\\.${t}\\s+from public, anon, authenticated;`))
      expect(mig).toMatch(new RegExp(`grant select, insert, update, delete on naufrago\\.${t}\\s+to service_role;`))
      expect(mig).toContain(`alter table naufrago.${t}`)
    }
    expect(mig).toContain("revoke all on sequence %s from public, anon, authenticated")
    expect(mig).toContain("revoke all on function naufrago.registrar_residente(text, text, text, text) from public, anon, authenticated;")
    expect(mig).toContain("grant execute on function naufrago.registrar_residente(text, text, text, text) to service_role;")
    expect(mig).not.toMatch(/grant [^;]* to (anon|authenticated|public)/i)
  })
  it("comprueba al final que nada quedó abierto (si quedó, se detiene)", () => {
    expect(mig).toContain("raise exception 'sigue abierta: %'")
    expect(mig).toContain("raise exception 'contador abierto: %'")
    expect(mig).toContain("raise exception 'función abierta: registrar_residente'")
    expect(mig.lastIndexOf("sigue abierta")).toBeGreaterThan(mig.lastIndexOf("revoke all"))
  })
  it("las reglas del negocio viven en la base", () => {
    expect(mig).toContain("codigo ~ '^NAU-[2-9A-HJKMNP-Z]{6}$'")
    expect(mig).toContain("create unique index residentes_whatsapp_activo on naufrago.residentes (whatsapp_e164) where baja_en is null;")
    expect(mig).toContain("on naufrago.residente_visitas (residente_id, dia_ec) where resultado = 'valida';")
    expect(mig).toContain("(now() at time zone 'America/Guayaquil')::date")
    expect(mig).toContain("for update")
  })
  it("no toca ninguna tabla que ya existía", () => {
    const tocadas = [...mig.matchAll(/(?:alter table|revoke all on|grant [a-z, ]+ on|drop table|update|insert into)\s+(?:if exists\s+)?naufrago\.(\w+)/gi)].map((m) => m[1])
    for (const t of tocadas) expect([...TABLAS]).toContain(t)
  })
  it("la reversa borra exactamente lo creado, en orden", () => {
    const pasos = rev.split("\n").filter((l) => /^(drop|alter)/.test(l))
    expect(pasos).toEqual([
      "drop function if exists naufrago.registrar_residente(text, text, text, text);",
      "drop table if exists naufrago.residente_visitas;",
      "alter table if exists naufrago.residente_codigos drop constraint if exists residente_codigos_residente_fk;",
      "drop table if exists naufrago.residentes;",
      "drop table if exists naufrago.residente_codigos;",
    ])
  })
})
