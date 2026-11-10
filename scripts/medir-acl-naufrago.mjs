// SOLO LECTURA · foto de los permisos del esquema `naufrago` tal como están guardados (relacl / proacl / defaclacl), para que
// el cierre de permisos de fondo (scripts/naufrago-permisos.mjs) se genere desde lo vivo y su reversa sea exacta.
// Lo corre quien mide (CC3), nunca quien aplica. Uso: doppler run -p zero-risk -c prd -- node scripts/medir-acl-naufrago.mjs <salida.json>
import { writeFileSync } from "node:fs"

const PROYECTO = "ordaeyxvvvdqsznsecjx"
async function q(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${PROYECTO}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  })
  const t = await r.text()
  if (r.status >= 300) throw new Error(`${r.status} ${t}`)
  return JSON.parse(t)
}

const foto = { medido_en: new Date().toISOString() }
foto.tablas = await q(`select c.relname nombre, c.relkind tipo, pg_get_userbyid(c.relowner) dueno, c.relacl::text acl
  from pg_class c where c.relnamespace = 'naufrago'::regnamespace and c.relkind in ('r','p','v','m','f') order by 1`)
foto.contadores = await q(`select c.relname nombre, pg_get_userbyid(c.relowner) dueno, c.relacl::text acl
  from pg_class c where c.relnamespace = 'naufrago'::regnamespace and c.relkind = 'S' order by 1`)
foto.funciones = await q(`select p.proname nombre, pg_get_function_identity_arguments(p.oid) args, pg_get_userbyid(p.proowner) dueno, p.prosecdef definidor, p.proacl::text acl
  from pg_proc p where p.pronamespace = 'naufrago'::regnamespace order by 1, 2`)
foto.por_omision = await q(`select pg_get_userbyid(d.defaclrole) creador, d.defaclobjtype tipo, d.defaclacl::text acl
  from pg_default_acl d where d.defaclnamespace = 'naufrago'::regnamespace order by 1, 2`)
// los globales (sin esquema) de los dos roles que crean cosas: no se tocan aquí, pero se dejan a la vista
foto.por_omision_global = await q(`select pg_get_userbyid(d.defaclrole) creador, d.defaclobjtype tipo, d.defaclacl::text acl
  from pg_default_acl d where d.defaclnamespace = 0 and pg_get_userbyid(d.defaclrole) in ('postgres', 'supabase_admin') order by 1, 2`)
foto.esquema = await q(`select nspacl::text acl from pg_namespace where nspname = 'naufrago'`)
foto.control = await q(`select has_table_privilege('service_role', 'naufrago.orders', 'SELECT') servidor_lee_orders`)
writeFileSync(process.argv[2], JSON.stringify(foto, null, 1))
console.log("tablas", foto.tablas.length, "· contadores", foto.contadores.length, "· funciones", foto.funciones.length, "· por omisión", foto.por_omision.length, "(globales", foto.por_omision_global.length + ")", "· control", JSON.stringify(foto.control))
