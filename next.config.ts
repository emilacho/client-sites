import type { NextConfig } from "next"

/**
 * R96.132 · Wave 2 Item #4 · Security hardening · headers globales.
 * - HSTS (https forced 1 year preload-ready)
 * - X-Content-Type-Options nosniff
 * - X-Frame-Options DENY (clickjacking)
 * - Referrer-Policy strict-origin-when-cross-origin
 * - Permissions-Policy (geolocation=self · camera/microphone deny)
 * - X-XSS-Protection 0 (deprecated · CSP es la defensa real)
 *
 * R165.1 · SE AGREGA CSP, EN MODO OBSERVACIÓN.
 *
 * Qué es · la lista de sitios desde los que esta página tiene permitido
 * cargar cosas. Sin ella, un guión ajeno que llegue a colarse puede leer
 * lo que el cliente escribe. Con un formulario de tarjeta de verdad en
 * la pantalla, eso deja de ser teórico: es el robo de tarjetas clásico.
 *
 * POR QUÉ EN OBSERVACIÓN Y NO PROHIBIENDO YA
 * Una lista mal armada rompe el sitio entero y en silencio: el mapa deja
 * de dibujarse, la isla no carga, el pago no abre · y no hay error
 * visible, simplemente no pasa nada. Publicar eso de una sobre un sitio
 * vivo sería apostar.
 *
 * `Content-Security-Policy-Report-Only` avisa lo que HABRÍA bloqueado
 * sin bloquear nada. Se deja unos días, se mira qué reportó, se corrige
 * la lista, y recién entonces se cambia el nombre del encabezado a
 * `Content-Security-Policy` y empieza a prohibir de verdad.
 *
 * Los avisos llegan a /api/csp-reporte.
 */

/**
 * De dónde tiene permiso de cargar cosas esta página.
 *
 * Cada línea es una decisión y ninguna está de adorno:
 *
 * · payphonetodoesposible.com · el formulario de pago. Su archivo de
 *   código y su hoja de estilos vienen del cdn, y el formulario habla
 *   con pay y paymentbox. Sin estos tres, no hay cobro con tarjeta.
 * · googleapis / gstatic / google.com · el mapa donde el cliente marca
 *   su dirección · las imágenes de las calles vienen de esos dominios.
 * · posthog · los avisos de error y las mediciones.
 * · supabase · las fotos de los platos.
 * · blob: y data: · la isla en 3D arma texturas en memoria y las carga
 *   desde ahí · sin esto la portada queda gris.
 *
 * 'unsafe-inline' en los guiones es una concesión, no un descuido: el
 * armazón del sitio (Next.js) mete guiones sueltos en la página y la
 * forma correcta de firmarlos uno por uno pide una capa intermedia que
 * hoy no existe. Queda anotado como lo próximo a mejorar · aun así,
 * esta lista ya impide que un guión de OTRO sitio se ejecute acá, que
 * es el caso que roba tarjetas.
 */
const PAYPHONE = "https://*.payphonetodoesposible.com"
const CSP = [
  `default-src 'self'`,
  `script-src 'self' 'unsafe-inline' 'unsafe-eval' ${PAYPHONE} https://*.googleapis.com https://*.gstatic.com https://us-assets.i.posthog.com`,
  `style-src 'self' 'unsafe-inline' ${PAYPHONE} https://fonts.googleapis.com`,
  `font-src 'self' data: https://fonts.gstatic.com`,
  `img-src 'self' data: blob: ${PAYPHONE} https://*.googleapis.com https://*.gstatic.com https://*.google.com https://ordaeyxvvvdqsznsecjx.supabase.co`,
  `media-src 'self' data: blob:`,
  `connect-src 'self' blob: ${PAYPHONE} https://*.googleapis.com https://*.gstatic.com https://us.i.posthog.com https://us-assets.i.posthog.com https://ordaeyxvvvdqsznsecjx.supabase.co wss://ordaeyxvvvdqsznsecjx.supabase.co`,
  `frame-src 'self' ${PAYPHONE}`,
  `worker-src 'self' blob:`,
  // Nadie puede meter esta página dentro de un marco · es lo mismo que
  // dice X-Frame-Options, escrito en el idioma moderno.
  `frame-ancestors 'none'`,
  // Un formulario de esta página no puede enviarse a otro sitio.
  `form-action 'self' ${PAYPHONE}`,
  `base-uri 'self'`,
  `object-src 'none'`,
  `report-uri /api/csp-reporte`,
].join("; ")
const config: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "ordaeyxvvvdqsznsecjx.supabase.co",
        pathname: "/storage/v1/object/public/agent-images/**",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value:
              "geolocation=(self), camera=(), microphone=(), payment=(), usb=(), accelerometer=(), gyroscope=()",
          },
          { key: "X-XSS-Protection", value: "0" },
          // R165.1 · en observación · avisa, todavía no prohíbe.
          { key: "Content-Security-Policy-Report-Only", value: CSP },
        ],
      },
    ]
  },
}

export default config
