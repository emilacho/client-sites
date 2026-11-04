/**
 * Marca de prueba · R172 · un dispositivo se declara «de prueba» UNA vez
 * (abriendo el sitio con ?prueba=1) y desde ahí todo lo que haga lleva la
 * marca: el pedido (naufrago.orders.es_prueba) y cada evento de la analítica.
 * ?prueba=0 la quita. No cambia nada de lo que ve o recibe el cliente ni la
 * cocina: solo rotula, para que las pruebas no se lean como ventas reales.
 */
export const CLAVE_ES_PRUEBA = "naufrago_es_prueba"

export function esDispositivoDePrueba(): boolean {
  if (typeof window === "undefined") return false
  try {
    return window.localStorage.getItem(CLAVE_ES_PRUEBA) === "1"
  } catch {
    return false
  }
}

/** Lee ?prueba=1|0 de la dirección y lo deja guardado en el dispositivo. */
export function declararPruebaDesdeLaDireccion(search: string): void {
  if (typeof window === "undefined") return
  const v = new URLSearchParams(search).get("prueba")
  if (v !== "1" && v !== "0") return
  try {
    if (v === "1") window.localStorage.setItem(CLAVE_ES_PRUEBA, "1")
    else window.localStorage.removeItem(CLAVE_ES_PRUEBA)
  } catch {
    // sin almacenamiento: no hay marca, el sitio funciona igual
  }
}
