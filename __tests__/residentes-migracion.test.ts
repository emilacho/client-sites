// Tarjeta de residente · la migración nace cerrada y la reversa la deshace (revisión del texto;
// la corrida real se probó en un Postgres en memoria, ver el papel PARA-CERTIFICAR).
import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"

// los finales de línea de Windows (CRLF) no cambian el sentido: se leen como LF
const leer = (ruta: string) => readFileSync(ruta, "utf8").replace(/\r\n/g, "\n")
const mig = leer("supabase/migrations/202611120300_naufrago_residentes.sql")
const rev = leer("supabase/reversas/202611120300_naufrago_residentes_REVERSA.sql")
const TABLAS = ["residente_codigos", "residentes", "residente_visitas"]
const FIRMA = "registrar_residente(text, text, text, text, text, text, smallint, smallint, boolean)"

describe("migración de residentes", () => {
  it("crea las 3 tablas y la función de registro, todo en una transacción", () => {
    for (const t of TABLAS) expect(mig).toContain(`create table naufrago.${t} (`)
    expect(mig).toContain(
      "create function naufrago.registrar_residente(\n" +
        "  p_codigo text, p_nombre text, p_whatsapp text, p_ficha text,\n" +
        "  p_sector text, p_correo text, p_cumple_dia smallint, p_cumple_mes smallint, p_acepta_novedades boolean)",
    )
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
    expect(mig).toContain(`revoke all on function naufrago.${FIRMA} from public, anon, authenticated;`)
    expect(mig).toContain(`grant execute on function naufrago.${FIRMA} to service_role;`)
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
    // un mismo código no puede existir dos veces (CC6 · mutante m10); «Generar códigos» reintenta con el 23505
    expect(mig).toMatch(/\n {2}codigo +text not null unique check /)
    expect(mig).toMatch(/\n {2}ficha +text not null unique check /)
    expect(mig).toMatch(/\n {2}sector +text not null check /)
    expect(mig).toContain("case when p_acepta_novedades then now() end")
    expect(mig).toContain("(cumple_dia is null and cumple_mes is null)")
    expect(mig).toContain("cumple_dia is not null and cumple_mes is not null")
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
      `drop function if exists naufrago.${FIRMA};`,
      "drop table if exists naufrago.residente_visitas;",
      "alter table if exists naufrago.residente_codigos drop constraint if exists residente_codigos_residente_fk;",
      "drop table if exists naufrago.residentes;",
      "drop table if exists naufrago.residente_codigos;",
    ])
  })
})
