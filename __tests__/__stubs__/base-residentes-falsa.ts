/**
 * Base falsa de las 3 tablas de residentes, con lo justo del constructor de consultas de Supabase que usan
 * `lib/residentes-validar.ts` y `lib/residentes-admin.ts`. Copia las reglas de la migración 202611120300 que
 * importan para la caja: el código es único y hay UNA visita válida por tarjeta y día de Ecuador.
 */
type Fila = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
type Filtro = (f: Fila) => boolean

export interface Tablas {
  residentes: Fila[]
  residente_codigos: Fila[]
  residente_visitas: Fila[]
}

const diaEc = (iso: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Guayaquil", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso))

/** El `max_rows` del proyecto de Supabase de Náufrago (medido por CC6 el 12-nov). */
export const MAX_FILAS = 1000

export function baseFalsa(inicial: Partial<Tablas> = {}, reloj: () => string = () => new Date().toISOString(), maxFilas: number = MAX_FILAS) {
  const t: Tablas = { residentes: [], residente_codigos: [], residente_visitas: [], ...structuredClone(inicial) }
  let idVisita = t.residente_visitas.length
  let idCodigo = 0
  const llamadas: string[] = []
  /** Para simular una base caída: si devuelve un error, esa operación falla. */
  let romper: ((tabla: string, op: string, fila?: Fila | null) => { code?: string; message?: string } | null) = () => null

  function consulta(tabla: keyof Tablas) {
    const filtros: Filtro[] = []
    let op: "select" | "insert" | "update" = "select"
    let fila: Fila | null = null
    let cambios: Fila | null = null
    const ordenes: { col: string; asc: boolean }[] = []
    let rango: [number, number] | null = null
    let tope = Infinity
    let uno = false

    const ejecutar = (): { data: any; error: any } => { // eslint-disable-line @typescript-eslint/no-explicit-any
      llamadas.push(`${op}:${tabla}`)
      const roto = romper(tabla, op, fila)
      if (roto) return { data: null, error: roto }
      if (op === "insert") {
        const nueva: Fila = { ...fila }
        if (tabla === "residente_visitas") {
          nueva.id = ++idVisita
          nueva.validado_en = nueva.validado_en ?? reloj()
          nueva.dia_ec = diaEc(nueva.validado_en)
          if (nueva.resultado === "valida" && t.residente_visitas.some((v) => v.resultado === "valida" && v.residente_id === nueva.residente_id && v.dia_ec === nueva.dia_ec)) {
            return { data: null, error: { code: "23505", message: 'duplicate key value violates unique constraint "residente_visitas_una_valida_por_dia"' } }
          }
        }
        if (tabla === "residente_codigos") {
          if (t.residente_codigos.some((c) => c.codigo === nueva.codigo)) {
            return { data: null, error: { code: "23505", message: 'duplicate key value violates unique constraint "residente_codigos_codigo_key"' } }
          }
          nueva.id = nueva.id ?? `00000000-0000-4000-8000-${String(++idCodigo).padStart(12, "0")}`
          nueva.creado_en = nueva.creado_en ?? reloj()
          nueva.usado_en = nueva.usado_en ?? null
          nueva.anulado_en = nueva.anulado_en ?? null
          nueva.residente_id = nueva.residente_id ?? null
        }
        t[tabla].push(nueva)
        return { data: null, error: null }
      }
      let filas = t[tabla].filter((f) => filtros.every((fn) => fn(f)))
      if (op === "update") {
        for (const f of filas) Object.assign(f, cambios)
        return { data: filas.map((f) => ({ id: f.id })), error: null }
      }
      if (ordenes.length) {
        // Como Postgres: entre filas empatadas el orden NO es estable de un pedido a otro (aquí cambia con cada pedido),
        // así que leer por páginas sin desempate repite o salta filas.
        const vuelta = llamadas.length
        const azar = new Map(filas.map((f, i) => [f, (i * 7919 + vuelta * 104729) % 1000003]))
        filas = [...filas].sort((a, b) => {
          for (const { col, asc } of ordenes) {
            const c = (a[col] < b[col] ? -1 : a[col] > b[col] ? 1 : 0) * (asc ? 1 : -1)
            if (c) return c
          }
          return (azar.get(a) as number) - (azar.get(b) as number)
        })
      }
      if (rango) filas = filas.slice(rango[0], rango[1] + 1)
      // como el `max_rows` del proyecto: nunca más de 1000 filas por pedido, y sin avisar
      filas = filas.slice(0, Math.min(tope, maxFilas))
      if (tabla === "residente_codigos") {
        filas = filas.map((c) => {
          const r = t.residentes.find((x) => x.id === c.residente_id)
          return { ...c, residentes: r ? { numero: r.numero, nombre: r.nombre } : null }
        })
      }
      if (uno) return { data: filas[0] ?? null, error: null }
      return { data: filas, error: null }
    }

    const q: any = { // eslint-disable-line @typescript-eslint/no-explicit-any
      select() { if (op === "select") op = "select"; return q },
      insert(f: Fila) { op = "insert"; fila = f; return q },
      update(c: Fila) { op = "update"; cambios = c; return q },
      eq(col: string, v: unknown) { filtros.push((f) => f[col] === v); return q },
      is(col: string, v: unknown) { filtros.push((f) => (f[col] ?? null) === v); return q },
      not(col: string, _op: string, v: unknown) { filtros.push((f) => (f[col] ?? null) !== v); return q },
      in(col: string, vs: unknown[]) { filtros.push((f) => vs.includes(f[col])); return q },
      order(col: string, o: { ascending: boolean }) { ordenes.push({ col, asc: o.ascending }); return q },
      limit(n: number) { tope = n; return q },
      range(desde: number, hasta: number) { rango = [desde, hasta]; return q },
      maybeSingle() { uno = true; return q },
      then(ok: (r: unknown) => unknown, mal?: (e: unknown) => unknown) {
        try { return Promise.resolve(ejecutar()).then(ok, mal) } catch (e) { return mal ? mal(e) : Promise.reject(e) }
      },
    }
    return q
  }

  return {
    base: { from: (tabla: string) => consulta(tabla as keyof Tablas) },
    tablas: t,
    llamadas,
    romperCon(fn: typeof romper) { romper = fn },
  }
}
