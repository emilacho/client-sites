/**
 * Una base de datos de mentira que SÍ guarda lo que le escriben · R168
 *
 * POR QUÉ HACÍA FALTA
 * Hasta ahora cada prueba fingía la base con un objeto que contestaba
 * siempre lo mismo. Eso alcanza para probar un paso suelto, pero no
 * puede probar un CICLO: lo que el paso 1 escribe, el paso 3 no lo lee,
 * porque no hay dónde quedar guardado.
 *
 * Justo ahí viven los errores más caros. El cobro con tarjeta pasa por
 * tres momentos separados en el tiempo -se reserva, se cobra, se
 * despacha- y cada uno lee lo que dejó el anterior. Si la reserva
 * guarda la dirección en un campo y el despacho la busca en otro, con
 * las pruebas viejas los dos pasan y el pedido real se pierde.
 *
 * Esto guarda las filas en memoria y las devuelve como haría la base.
 *
 * QUÉ NO ES · no valida tipos, ni permisos, ni las reglas de la propia
 * base (por ejemplo la lista de estados permitidos). Prueba el flujo
 * del código, no la estructura · para eso está la migración.
 */

type Fila = Record<string, unknown>
type Filtro = (f: Fila) => boolean

let secuencia = 0

export class BaseFalsa {
  /** nombre de tabla → filas */
  tablas = new Map<string, Fila[]>()

  filas(tabla: string): Fila[] {
    if (!this.tablas.has(tabla)) this.tablas.set(tabla, [])
    return this.tablas.get(tabla)!
  }

  /** Siembra filas sin pasar por el código · para armar escenarios. */
  sembrar(tabla: string, ...filas: Fila[]) {
    this.filas(tabla).push(...filas.map((f) => ({ id: `sem-${++secuencia}`, ...f })))
  }

  from(tabla: string) {
    return new Consulta(this, tabla)
  }
}

class Consulta implements PromiseLike<{ data: unknown; error: null }> {
  private filtros: Filtro[] = []
  private orden: { campo: string; asc: boolean } | null = null
  private tope: number | null = null
  private modo: "select" | "insert" | "update" | "upsert" = "select"
  private carga: Fila | Fila[] | null = null
  private conflicto: string | null = null
  private devolver = false

  constructor(
    private base: BaseFalsa,
    private tabla: string,
  ) {}

  // ── filtros ────────────────────────────────────────────────────────
  eq(campo: string, valor: unknown) {
    this.filtros.push((f) => f[campo] === valor)
    return this
  }
  neq(campo: string, valor: unknown) {
    this.filtros.push((f) => f[campo] !== valor)
    return this
  }
  in(campo: string, valores: unknown[]) {
    this.filtros.push((f) => valores.includes(f[campo]))
    return this
  }
  gte(campo: string, valor: unknown) {
    this.filtros.push((f) => String(f[campo] ?? "") >= String(valor))
    return this
  }
  lte(campo: string, valor: unknown) {
    this.filtros.push((f) => String(f[campo] ?? "") <= String(valor))
    return this
  }
  is(campo: string, valor: unknown) {
    this.filtros.push((f) => (f[campo] ?? null) === valor)
    return this
  }
  order(campo: string, o?: { ascending?: boolean }) {
    this.orden = { campo, asc: o?.ascending !== false }
    return this
  }
  limit(n: number) {
    this.tope = n
    return this
  }

  // ── escritura ──────────────────────────────────────────────────────
  insert(carga: Fila | Fila[]) {
    this.modo = "insert"
    this.carga = carga
    return this
  }
  update(carga: Fila) {
    this.modo = "update"
    this.carga = carga
    return this
  }
  upsert(carga: Fila, o?: { onConflict?: string }) {
    this.modo = "upsert"
    this.carga = carga
    this.conflicto = o?.onConflict ?? null
    return this
  }
  select(_campos?: string) {
    this.devolver = true
    return this
  }

  // ── resolución ─────────────────────────────────────────────────────
  private aplicar(): Fila[] {
    let r = this.base.filas(this.tabla).filter((f) => this.filtros.every((p) => p(f)))
    if (this.orden) {
      const { campo, asc } = this.orden
      r = [...r].sort((a, b) => {
        const x = String(a[campo] ?? "")
        const y = String(b[campo] ?? "")
        return asc ? x.localeCompare(y) : y.localeCompare(x)
      })
    }
    if (this.tope != null) r = r.slice(0, this.tope)
    return r
  }

  private ejecutar(): Fila[] {
    const filas = this.base.filas(this.tabla)
    if (this.modo === "insert") {
      const nuevas = (Array.isArray(this.carga) ? this.carga : [this.carga!]).map(
        (f) => ({ id: `fila-${++secuencia}`, created_at: new Date().toISOString(), ...f }),
      )
      filas.push(...nuevas)
      return nuevas
    }
    if (this.modo === "upsert") {
      const f = this.carga as Fila
      const clave = this.conflicto
      const previa = clave ? filas.find((x) => x[clave] === f[clave]) : undefined
      if (previa) {
        Object.assign(previa, f)
        return [previa]
      }
      const nueva = { id: `fila-${++secuencia}`, created_at: new Date().toISOString(), ...f }
      filas.push(nueva)
      return [nueva]
    }
    if (this.modo === "update") {
      const alcanzadas = this.aplicar()
      for (const f of alcanzadas) Object.assign(f, this.carga as Fila)
      return alcanzadas
    }
    return this.aplicar()
  }

  async maybeSingle() {
    const r = this.ejecutar()
    return { data: r[0] ?? null, error: null }
  }
  async single() {
    const r = this.ejecutar()
    return r.length === 1
      ? { data: r[0], error: null }
      : { data: null, error: { message: "se esperaba exactamente una fila" } }
  }

  then<A, B = never>(
    ok?: ((v: { data: unknown; error: null }) => A | PromiseLike<A>) | null,
    mal?: ((r: unknown) => B | PromiseLike<B>) | null,
  ): PromiseLike<A | B> {
    const r = this.ejecutar()
    return Promise.resolve({ data: this.devolver ? r : null, error: null }).then(ok, mal)
  }
}
