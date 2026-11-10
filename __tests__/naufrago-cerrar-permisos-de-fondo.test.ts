// El cierre de los permisos de fondo del esquema naufrago (GO-LENOVO «dale Emilio» 10-nov 17:15Z) y su reversa exacta.
import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
// @ts-expect-error · módulo .mjs sin tipos
import { leerAcl, sqlCierre, sqlReversa, ROLES } from "../scripts/naufrago-permisos.mjs"

type Acl = { rol: string; privs: string[] }
type Foto = { medido_en: string; tablas: Array<{ nombre: string; acl: string | null }>; contadores: Array<{ nombre: string; acl: string | null }>; funciones: Array<{ nombre: string; args: string; acl: string | null }>; por_omision: Array<{ creador: string; tipo: string; acl: string }> }
const FOTO: Foto = JSON.parse(readFileSync("__tests__/fixtures/naufrago-permisos-foto-2026-11-10.json", "utf8"))
const cierre: string = sqlCierre(FOTO)
const reversa: string = sqlReversa(FOTO)
const lineas = (s: string) => s.split("\n").filter((l) => l && !l.startsWith("--"))

describe("leer los permisos guardados", () => {
  it("«todos» es el permiso sin nombre («=X/postgres»), y solo se leen los roles de afuera", () => {
    expect(leerAcl("{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}")).toEqual([
      { rol: "PUBLIC", privs: ["EXECUTE"] }, { rol: "anon", privs: ["EXECUTE"] }, { rol: "authenticated", privs: ["EXECUTE"] },
    ])
    expect(leerAcl("{anon=arwdDxtm/postgres}")[0].privs).toEqual(["INSERT", "SELECT", "UPDATE", "DELETE", "TRUNCATE", "REFERENCES", "TRIGGER", "MAINTAIN"])
    expect(leerAcl("{anon=rwU/postgres}")[0].privs).toEqual(["SELECT", "UPDATE", "USAGE"])
    expect(leerAcl(null)).toEqual([])
    expect(leerAcl("{}")).toEqual([])
  })
  it("lo que no entiende lo rechaza en vez de adivinar", () => {
    expect(() => leerAcl("{anon=rZ/postgres}")).toThrow(/desconocida/)
    expect(() => leerAcl("{anon=r*/postgres}")).toThrow(/cederlo/)
    expect(() => leerAcl("{basura}")).toThrow(/ilegible/)
  })
})

describe("el cambio", () => {
  it("quita a «todos», anónimos y cuentas TODO en cada una de las 21 tablas y las 5 funciones medidas", () => {
    expect(FOTO.tablas).toHaveLength(21)
    expect(FOTO.funciones).toHaveLength(5)
    for (const t of FOTO.tablas) expect(cierre).toContain(`revoke all on naufrago.${t.nombre} from public, anon, authenticated;`)
    for (const f of FOTO.funciones) expect(cierre).toContain(`revoke all on function naufrago.${f.nombre}(${f.args}) from public, anon, authenticated;`)
  })
  it("lo nuevo no nace abierto: cierra cada valor por omisión del esquema (tablas, contadores y funciones de postgres)", () => {
    expect(FOTO.por_omision.map((d) => `${d.creador}:${d.tipo}`).sort()).toEqual(["postgres:S", "postgres:f", "postgres:r"])
    for (const c of ["tables", "sequences", "functions"]) expect(cierre).toContain(`alter default privileges for role postgres in schema naufrago revoke all on ${c} from public, anon, authenticated;`)
  })
  it("NO toca al servidor, al dueño, las filas, las reglas ni el saldo en vivo", () => {
    const accion = lineas(cierre).filter((l) => /^(revoke|grant|alter|drop|delete|truncate|update|insert|create)\b/i.test(l))
    expect(accion.length).toBe(21 + 5 + 3)
    for (const l of accion) {
      expect(l).toMatch(/^(revoke all on|alter default privileges)/)
      expect(l).not.toMatch(/service_role|postgres\s*;|policy|publication|security|owner/i)
      expect(l).toMatch(/from public, anon, authenticated;$/)
    }
  })
  it("empieza comprobando que lo vivo sea IGUAL a la foto (si cambió, se detiene sin tocar nada) y lo hace antes de quitar", () => {
    const iComprobar = cierre.indexOf("cambió desde la foto"), iQuitar = cierre.indexOf("revoke all on")
    expect(iComprobar).toBeGreaterThan(0)
    expect(iComprobar).toBeLessThan(iQuitar)
    for (const t of FOTO.tablas) expect(cierre).toContain(`if (select relacl::text from pg_class where oid = 'naufrago.${t.nombre}'::regclass) is distinct from '${t.acl}' then raise exception`)
    for (const f of FOTO.funciones) expect(cierre).toContain(`if (select proacl::text from pg_proc where oid = 'naufrago.${f.nombre}(${f.args})'::regprocedure) is distinct from '${f.acl}' then raise exception`)
    expect(cierre).toContain(`if n <> 21 then raise exception 'cambió desde la foto: % tablas'`)
    expect(cierre).toContain(`if n <> 5 then raise exception 'cambió desde la foto: % funciones'`)
    expect(cierre).toContain(`if n <> 3 then raise exception 'cambió desde la foto: % valores por omisión'`)
    expect(cierre).toContain(`if n <> 0 then raise exception 'cambió desde la foto: % contadores'`)
  })
  it("termina comprobando que afuera no queda nada y que el servidor sigue leyendo cada tabla", () => {
    const iFinal = cierre.lastIndexOf("do $$")
    expect(iFinal).toBeGreaterThan(cierre.lastIndexOf("revoke all on"))
    const final = cierre.slice(iFinal)
    for (const t of FOTO.tablas) {
      expect(final).toContain(`raise exception 'sigue abierta: naufrago.${t.nombre}'`)
      expect(final).toContain(`if not has_table_privilege('service_role', 'naufrago.${t.nombre}', 'SELECT') then raise exception 'el servidor perdió: naufrago.${t.nombre}'`)
    }
    for (const f of FOTO.funciones) expect(final).toContain(`raise exception 'sigue abierta: naufrago.${f.nombre}(${f.args})'`)
  })
  it("todo va en una sola transacción", () => {
    const l = lineas(cierre)
    expect(l[0]).toBe("begin;")
    expect(l.at(-1)).toBe("commit;")
  })
})

describe("la reversa es exacta", () => {
  // aplicar «quitar todo a los 3 roles» y luego la reversa, en un modelo de permisos, debe dar lo mismo que la foto
  const modelo = (sql: string) => {
    const m = new Map<string, Set<string>>()
    for (const l of lineas(sql)) {
      const g = /^grant (.+) on (.+) to (public|anon|authenticated);$/.exec(l)
      const d = /^alter default privileges for role (\w+) in schema naufrago grant (.+) on (\w+) to (public|anon|authenticated);$/.exec(l)
      if (g) { const k = `${g[2]}|${g[3] === "public" ? "PUBLIC" : g[3]}`; m.set(k, new Set([...(m.get(k) ?? []), ...g[1].split(", ").map((p) => p.toUpperCase())])) }
      else if (d) { const k = `omision ${d[1]} ${d[3]}|${d[4] === "public" ? "PUBLIC" : d[4]}`; m.set(k, new Set([...(m.get(k) ?? []), ...d[2].split(", ").map((p) => p.toUpperCase())])) }
      else if (!/^(begin|commit);$/.test(l)) throw new Error(`línea inesperada en la reversa: ${l}`)
    }
    return m
  }
  const esperado = () => {
    const m = new Map<string, Set<string>>()
    const pon = (obj: string, acl: string | null) => { for (const { rol, privs } of leerAcl(acl) as Acl[]) if (privs.length) m.set(`${obj}|${rol}`, new Set(privs)) }
    for (const t of FOTO.tablas) pon(`naufrago.${t.nombre}`, t.acl)
    for (const f of FOTO.funciones) pon(`function naufrago.${f.nombre}(${f.args})`, f.acl)
    const clase: Record<string, string> = { r: "tables", S: "sequences", f: "functions" }
    for (const d of FOTO.por_omision) for (const { rol, privs } of leerAcl(d.acl) as Acl[]) m.set(`omision ${d.creador} ${clase[d.tipo]}|${rol}`, new Set(privs))
    return m
  }
  it("devuelve a cada rol de afuera exactamente lo que tenía en la foto, ni más ni menos", () => {
    const a = modelo(reversa), b = esperado()
    expect([...a.keys()].sort()).toEqual([...b.keys()].sort())
    for (const [k, v] of b) expect([...(a.get(k) ?? [])].sort()).toEqual([...v].sort())
  })
  it("incluye el «todos» de las funciones (la lección del paso 3b) y no le da nada al servidor ni al dueño", () => {
    for (const f of FOTO.funciones) expect(reversa).toContain(`grant execute on function naufrago.${f.nombre}(${f.args}) to public;`)
    expect(reversa).not.toMatch(/to (service_role|postgres|supabase_admin);/)
    for (const r of ROLES) expect(ROLES).toContain(r)
  })
  it("una función sin permisos guardados vuelve a quedar como Postgres la deja: «todos» la ejecuta", () => {
    const f = { ...FOTO, funciones: [{ nombre: "x", args: "", acl: null, dueno: "postgres" }], tablas: [], por_omision: [] }
    expect(sqlReversa(f)).toContain("grant execute on function naufrago.x() to public;")
  })
})

describe("los archivos del repositorio salen de la foto", () => {
  it("el cambio y la reversa guardados son exactamente lo que genera el script con esta foto", () => {
    expect(readFileSync("supabase/migrations/202611101830_naufrago_cerrar_permisos_de_fondo.sql", "utf8").replace(/\r\n/g, "\n")).toBe(cierre)
    expect(readFileSync("supabase/reversas/202611101830_naufrago_cerrar_permisos_de_fondo_REVERSA.sql", "utf8").replace(/\r\n/g, "\n")).toBe(reversa)
  })
  it("una foto incompleta no genera nada", () => {
    expect(() => sqlCierre({ ...FOTO, por_omision: undefined })).toThrow(/por_omision/)
    expect(() => sqlCierre({ ...FOTO, medido_en: "" })).toThrow(/medido_en/)
  })
})
