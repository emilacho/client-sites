// Cierre de los permisos de fondo del esquema `naufrago` (GO-LENOVO «dale Emilio» 10-nov 17:15Z).
// Genera el cambio y su reversa EXACTA a partir de una foto de los permisos tal como están guardados en la base
// (relacl / proacl / defaclacl, sacada solo leyendo por CC3 con scripts/medir-acl-naufrago.mjs).
//
//   node scripts/naufrago-permisos.mjs <foto.json> <fecha-yyyymmddhhmm>
//     → supabase/migrations/<fecha>_naufrago_cerrar_permisos_de_fondo.sql
//     → supabase/reversas/<fecha>_naufrago_cerrar_permisos_de_fondo_REVERSA.sql
//
// Qué hace el cambio: a «todos» (PUBLIC), anónimos y cuentas con sesión les quita TODO sobre las tablas, contadores y
// funciones del esquema, y los permisos «por omisión» del esquema. No toca filas, reglas, el dueño ni la llave del servidor.
// El cambio empieza comprobando que lo vivo sea IGUAL a la foto: si algo cambió desde que se midió, se detiene sin tocar
// nada (así la reversa devuelve exactamente lo que había). Y termina comprobando que el servidor conserva lo suyo.
//
// Límite (Postgres, no elegible): el EXECUTE que «todos» recibe en las funciones NUEVAS viene de un valor por omisión
// GLOBAL, que no se puede quitar esquema por esquema; quitarlo cambia todos los esquemas. Las 5 funciones de hoy sí se
// cierran; para las nuevas hace falta otra decisión.
import { readFileSync, writeFileSync } from "node:fs"
import { pathToFileURL } from "node:url"

export const ROLES = ["PUBLIC", "anon", "authenticated"]
const LETRAS = { r: "SELECT", a: "INSERT", w: "UPDATE", d: "DELETE", D: "TRUNCATE", x: "REFERENCES", t: "TRIGGER", m: "MAINTAIN", X: "EXECUTE", U: "USAGE", C: "CREATE", c: "CONNECT", T: "TEMPORARY" }
const CLASE_POR_OMISION = { r: "tables", S: "sequences", f: "functions", T: "types", n: "schemas" }

/** «{=X/postgres,anon=arwd/postgres}» → [{ rol: "PUBLIC", privs: ["EXECUTE"] }, …] (solo los roles de afuera) */
export function leerAcl(acl) {
  if (acl == null) return []
  const cuerpo = String(acl).replace(/^\{|\}$/g, "")
  if (!cuerpo) return []
  return cuerpo.split(",").map((item) => {
    const m = /^"?([^=]*)=([A-Za-z*]*)\/(.+?)"?$/.exec(item.trim())
    if (!m) throw new Error(`permiso ilegible: ${item}`)
    if (m[2].includes("*")) throw new Error(`permiso con opción de cederlo, no previsto: ${item}`)
    const privs = [...m[2]].map((l) => { if (!LETRAS[l]) throw new Error(`letra de permiso desconocida «${l}» en ${item}`); return LETRAS[l] })
    return { rol: m[1] === "" ? "PUBLIC" : m[1], privs }
  }).filter((x) => ROLES.includes(x.rol))
}

const ident = (s) => (/^[a-z_][a-z0-9_]*$/.test(s) ? s : `"${String(s).replace(/"/g, '""')}"`)
const tabla = (t) => `naufrago.${ident(t.nombre)}`
const funcion = (f) => `naufrago.${ident(f.nombre)}(${f.args ?? ""})`
const lit = (s) => (s == null ? "null" : `'${String(s).replace(/'/g, "''")}'`)
// una función sin permisos guardados (proacl null) tiene el valor de Postgres: su dueño y «todos» la ejecutan
const aclFuncion = (f) => f.acl ?? `{=X/${f.dueno ?? "postgres"},${f.dueno ?? "postgres"}=X/${f.dueno ?? "postgres"}}`

function validar(foto) {
  for (const k of ["tablas", "funciones", "contadores", "por_omision"]) if (!Array.isArray(foto[k])) throw new Error(`a la foto le falta «${k}»`)
  if (!foto.medido_en) throw new Error("a la foto le falta «medido_en»")
}

export function sqlCierre(foto) {
  validar(foto)
  const L = []
  L.push(`-- Cierre de los permisos de fondo del esquema naufrago · GO-LENOVO «dale Emilio» 10-nov 17:15Z · generado por scripts/naufrago-permisos.mjs`)
  L.push(`-- Foto de lo vivo: ${foto.medido_en} (${foto.tablas.length} tablas, ${foto.funciones.length} funciones, ${foto.contadores.length} contadores, ${foto.por_omision.length} valores por omisión)`)
  L.push(`-- A «todos», anónimos y cuentas con sesión: nada sobre tablas, contadores ni funciones de naufrago, y lo nuevo no nace abierto.`)
  L.push(`-- No toca filas, reglas, el dueño ni la llave del servidor. Reversa exacta: supabase/reversas/ (mismo nombre, _REVERSA).`)
  L.push(`begin;`)
  L.push(`-- 1 · lo vivo tiene que ser IGUAL a la foto; si algo cambió, se detiene sin tocar nada`)
  L.push(`do $$`)
  L.push(`declare n int;`)
  L.push(`begin`)
  for (const t of foto.tablas) L.push(`  if (select relacl::text from pg_class where oid = ${lit(tabla(t))}::regclass) is distinct from ${lit(t.acl)} then raise exception 'cambió desde la foto: ${tabla(t).replace(/'/g, "''")}'; end if;`)
  for (const s of foto.contadores) L.push(`  if (select relacl::text from pg_class where oid = ${lit(tabla(s))}::regclass) is distinct from ${lit(s.acl)} then raise exception 'cambió desde la foto: ${tabla(s).replace(/'/g, "''")}'; end if;`)
  for (const f of foto.funciones) L.push(`  if (select proacl::text from pg_proc where oid = ${lit(funcion(f))}::regprocedure) is distinct from ${lit(f.acl)} then raise exception 'cambió desde la foto: ${funcion(f).replace(/'/g, "''")}'; end if;`)
  L.push(`  select count(*) into n from pg_class where relnamespace = 'naufrago'::regnamespace and relkind in ('r','p','v','m','f'); if n <> ${foto.tablas.length} then raise exception 'cambió desde la foto: % tablas', n; end if;`)
  L.push(`  select count(*) into n from pg_class where relnamespace = 'naufrago'::regnamespace and relkind = 'S'; if n <> ${foto.contadores.length} then raise exception 'cambió desde la foto: % contadores', n; end if;`)
  L.push(`  select count(*) into n from pg_proc where pronamespace = 'naufrago'::regnamespace; if n <> ${foto.funciones.length} then raise exception 'cambió desde la foto: % funciones', n; end if;`)
  L.push(`  select count(*) into n from pg_default_acl where defaclnamespace = 'naufrago'::regnamespace; if n <> ${foto.por_omision.length} then raise exception 'cambió desde la foto: % valores por omisión', n; end if;`)
  for (const d of foto.por_omision) L.push(`  if (select defaclacl::text from pg_default_acl where defaclnamespace = 'naufrago'::regnamespace and defaclrole = ${lit(d.creador)}::regrole and defaclobjtype = ${lit(d.tipo)}) is distinct from ${lit(d.acl)} then raise exception 'cambió desde la foto: por omisión ${d.creador} ${d.tipo}'; end if;`)
  L.push(`end $$;`)
  L.push(`-- 2 · quitar`)
  for (const t of foto.tablas) L.push(`revoke all on ${tabla(t)} from public, anon, authenticated;`)
  for (const s of foto.contadores) L.push(`revoke all on sequence ${tabla(s)} from public, anon, authenticated;`)
  for (const f of foto.funciones) L.push(`revoke all on function ${funcion(f)} from public, anon, authenticated;`)
  for (const d of foto.por_omision) {
    const clase = CLASE_POR_OMISION[d.tipo]; if (!clase) throw new Error(`tipo por omisión desconocido: ${d.tipo}`)
    L.push(`alter default privileges for role ${ident(d.creador)} in schema naufrago revoke all on ${clase} from public, anon, authenticated;`)
  }
  L.push(`-- 3 · comprobar: afuera no queda nada y el servidor conserva lo suyo`)
  L.push(`do $$`)
  L.push(`begin`)
  for (const t of foto.tablas) {
    L.push(`  if has_table_privilege('anon', ${lit(tabla(t))}, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') or has_table_privilege('authenticated', ${lit(tabla(t))}, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') then raise exception 'sigue abierta: ${tabla(t)}'; end if;`)
    if (/service_role=[a-zA-Z]*r/.test(t.acl ?? "")) L.push(`  if not has_table_privilege('service_role', ${lit(tabla(t))}, 'SELECT') then raise exception 'el servidor perdió: ${tabla(t)}'; end if;`)
  }
  for (const f of foto.funciones) L.push(`  if has_function_privilege('anon', ${lit(funcion(f))}, 'EXECUTE') or has_function_privilege('authenticated', ${lit(funcion(f))}, 'EXECUTE') then raise exception 'sigue abierta: ${funcion(f)}'; end if;`)
  L.push(`end $$;`)
  L.push(`commit;`)
  return L.join("\n") + "\n"
}

export function sqlReversa(foto) {
  validar(foto)
  const L = []
  L.push(`-- Reversa exacta del cierre de permisos de fondo de naufrago · devuelve lo que estaba en la foto de lo vivo (${foto.medido_en})`)
  L.push(`begin;`)
  const devolver = (objeto, acl) => { for (const { rol, privs } of leerAcl(acl)) if (privs.length) L.push(`grant ${privs.map((p) => p.toLowerCase()).join(", ")} on ${objeto} to ${rol === "PUBLIC" ? "public" : rol};`) }
  for (const t of foto.tablas) devolver(tabla(t), t.acl)
  for (const s of foto.contadores) devolver(`sequence ${tabla(s)}`, s.acl)
  for (const f of foto.funciones) devolver(`function ${funcion(f)}`, aclFuncion(f))
  for (const d of foto.por_omision) {
    const clase = CLASE_POR_OMISION[d.tipo]
    for (const { rol, privs } of leerAcl(d.acl)) if (privs.length) L.push(`alter default privileges for role ${ident(d.creador)} in schema naufrago grant ${privs.map((p) => p.toLowerCase()).join(", ")} on ${clase} to ${rol === "PUBLIC" ? "public" : rol};`)
  }
  L.push(`commit;`)
  return L.join("\n") + "\n"
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const [fotoRuta, fecha] = process.argv.slice(2)
  if (!fotoRuta || !/^\d{12}$/.test(fecha ?? "")) { console.error("uso: node scripts/naufrago-permisos.mjs <foto.json> <yyyymmddhhmm>"); process.exit(2) }
  const foto = JSON.parse(readFileSync(fotoRuta, "utf8"))
  const base = `${fecha}_naufrago_cerrar_permisos_de_fondo`
  writeFileSync(`supabase/migrations/${base}.sql`, sqlCierre(foto))
  writeFileSync(`supabase/reversas/${base}_REVERSA.sql`, sqlReversa(foto))
  console.log(`escrito supabase/migrations/${base}.sql y supabase/reversas/${base}_REVERSA.sql`)
}
