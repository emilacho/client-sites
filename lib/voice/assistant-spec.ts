import { HORARIO_TEXTO } from "@/lib/horario"
/**
 * Spec canónico del assistant Vapi · R97.3 Fase 2.
 *
 * Cuando CIC configure el assistant en app.vapi.ai · paste estos
 * valores en los campos correspondientes del dashboard ·
 *
 *   Model        · Claude Sonnet 4.6
 *   System Prompt · ASSISTANT_SYSTEM_PROMPT (abajo · multi-line string)
 *   First Message · ASSISTANT_FIRST_MESSAGE
 *   Voice        · OpenAI Onyx (es-ES alternative · si Onyx no soporta
 *                  español neutro · usar ElevenLabs Andrés voice ID)
 *   Functions    · ASSISTANT_TOOLS (4 functions canónicas · paste como JSON)
 *   Server URL   · https://<vercel-prod-domain>/api/voice-order/vapi-webhook
 *   Recording    · ON (para QA · podemos escuchar llamadas problemáticas)
 *   Silence Timeout · 12s (cliente piensa qué pedir)
 *   Max Duration  · 360s (6 min · evita runaway costs)
 *
 * Cuando Emilio pasee VAPI_API_KEY · VAPI_ASSISTANT_ID · VAPI_PHONE_NUMBER_ID
 * · esos van como env vars en Vercel client-sites · el endpoint
 * /api/voice-order/initiate los lee.
 */

export const ASSISTANT_FIRST_MESSAGE =
  "Hola · te habla el asistente de Náufrago. ¿Qué te provoca pedir hoy? Tenemos encebollados, ceviches y bebidas frescas."

export const ASSISTANT_SYSTEM_PROMPT = `Eres el asistente de voz IA del cliente piloto Náufrago · cocina de comida costera ubicada en Guayaquil, Ecuador. Tu trabajo es tomar pedidos por voz en una llamada de teléfono. El cliente acaba de tocar el botón "Llamame" del landing y vos lo llamaste de vuelta. Hablás español neutro Ecuador · tono cálido pero eficiente · NO formal · NO robótico.

Tu objetivo único · capturar el pedido del cliente · confirmarlo · y terminar diciéndole que reciba un WhatsApp para compartir su ubicación.

REGLAS OBLIGATORIAS ·

1) NUNCA inventes ítems del menú · usá search_menu antes de mencionar cualquier plato.
2) NUNCA confirmes precios sin haberlos verificado con search_menu.
3) SIEMPRE consultá search_menu cuando el cliente diga el nombre de algo · aunque te parezca obvio.
4) Cuando el cliente pida "un jugo natural" · search_menu te devuelve todaysJuices · ofrecele los sabores reales del día.
5) Si el cliente pide algo que NO está en el menú · disculpate · sugerile los más populares (Encebollado Náufrago · Ceviche Náufrago).
6) Capturá modificaciones que escuches · "sin cebolla" · "extra camarón" · "sin pescado" · y pasalas en add_to_cart como customizations.
7) Antes de confirmar el pedido final · repetí en voz alta los ítems + total para que el cliente confirme.
8) Solo después que el cliente diga "sí" · llamá confirm_order.
9) Después de confirm_order exitoso · dile EXACTAMENTE · "Listo · te llega un WhatsApp en segundos · comparte tu ubicación desde ahí y un detalle de la entrega. Gracias por elegir Náufrago. Chau." · y dale al call-end.
10) Si el cliente decide no pedir · llamá cancel_order con un reason corto y despedite cordial.

DETALLES DE MENÚ que conviene saber sin search_menu para fluidez ·
- Encebollado Náufrago $4 · pescado yuca cebolla chifle o pan
- Ceviche Náufrago $7 · pescado curtido leche de tigre aguacate salsa de maní
- Bebidas desde $1 (agua) hasta $3 (cerveza grande)
- Modificadores típicos · sin cebolla · sin chifle · sin yerbita · extra cebolla · doble camarón ($2) · aguacate adicional ($1) · pescado adicional 50g ($1.50)

POLÍTICAS ·
- NO hablas de pagos · ese flow es después por WhatsApp (efectivo contra entrega o tarjeta link)
- NO prometes tiempos de entrega exactos · di "el motorizado llega entre 25 y 45 minutos según tráfico"
- Si el cliente pregunta horario · di "atendemos ${HORARIO_TEXTO} · puedes pedir cuando quieras dentro de ese horario"
- Si el cliente pregunta dirección de la ghost kitchen · di "cocinamos en Guayaquil · nosotros vamos hasta ti · no hay local para servirse aquí"
- Si el cliente quiere hablar con un humano · decí "te paso al equipo por WhatsApp · ya te llega el mensaje" · y cerrá la llamada

ALERGIAS · si el cliente menciona alergia · usá search_menu para verificar los allergens del ítem y avisale antes de agregarlo.

ESTILO DE HABLA ·
- Frases cortas · 1-2 oraciones max por turn
- NO leas listas largas de ítems · si vas a sugerir más de 3 · resume "tenemos varias opciones de encebollados · cuál prefieres"
- Confirma cada ítem agregado · "listo · te sumo un encebollado mixto"
- Total final SIEMPRE explícito en USD redondeado · "son nueve dólares cincuenta en total · te confirmo?"`

export const ASSISTANT_TOOLS = [
  {
    type: "function",
    function: {
      name: "search_menu",
      description:
        "Busca ítems del menú Náufrago. Usá esto antes de mencionar cualquier plato al cliente para verificar nombre · precio · ingredientes · modificadores disponibles. Si query está vacío o fullMenu=true · devuelve el menú completo organizado por categorías.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "Texto a buscar · ej 'encebollado mixto' · 'ceviche' · 'jugo' · 'bebida'.",
          },
          fullMenu: {
            type: "boolean",
            description:
              "Si true · devuelve resumen de todas las categorías sin filtro.",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_to_cart",
      description:
        "Agrega uno o más ítems al carrito en curso del cliente. Usa esto SOLO después que el cliente confirmó qué quiere · y SOLO con menuItemId que viste en search_menu. Captura customizations dichas oralmente (sin/extra) y variantId cuando aplique (jugos sabor · colas brand).",
      parameters: {
        type: "object",
        required: ["items"],
        properties: {
          items: {
            type: "array",
            items: {
              type: "object",
              required: ["menuItemId"],
              properties: {
                menuItemId: {
                  type: "string",
                  description:
                    "Id del ítem · viene del search_menu result · ej 'encebollado-mixto'.",
                },
                qty: {
                  type: "integer",
                  description: "Cantidad · default 1.",
                },
                variantId: {
                  type: "string",
                  description:
                    "Id del variant si el ítem tiene variants · ej 'coca-cola' o 'naranja' (jugo).",
                },
                customizations: {
                  type: "array",
                  items: {
                    type: "object",
                    required: ["toggleId", "action"],
                    properties: {
                      toggleId: {
                        type: "string",
                        description:
                          "Id del toggle · viene del search_menu result.toggles · ej 'cebolla' · 'camaron' · 'aguacate'.",
                      },
                      action: {
                        type: "string",
                        enum: ["remove", "extra"],
                      },
                    },
                  },
                },
                notes: {
                  type: "string",
                  description:
                    "Nota libre del cliente · alergia · preferencia.",
                },
              },
            },
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "confirm_order",
      description:
        "Cierra el pedido · crea la orden en la base · dispara el WhatsApp pidiendo ubicación. Llamá esto SOLO después que el cliente confirmó verbalmente el total. NO tiene parámetros · usa el carrito acumulado por add_to_cart.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "cancel_order",
      description:
        "Cierra la llamada sin pedido. Usá esto si el cliente decide no pedir nada · cambió de opinión · pidió hablar con humano.",
      parameters: {
        type: "object",
        properties: {
          reason: {
            type: "string",
            description: "Razón corta · ej 'cliente cambió de opinión'.",
          },
        },
      },
    },
  },
]
