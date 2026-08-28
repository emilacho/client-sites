import { DIAS_CERRADO, HORARIO_TEXTO } from "@/lib/horario"
import { PORCENTAJE_GANANCIA } from "@/lib/perlas"

/**
 * FAQ canon Náufrago · R96.136 · 10 preguntas frecuentes.
 * Source único · usado por /faq page + JSON-LD FAQPage schema.
 */
export interface FaqItem {
  question: string
  answer: string
}

export const FAQ: FaqItem[] = [
  {
    question: "¿Cuáles son los horarios de pedido?",
    answer:
      `Atendemos ${HORARIO_TEXTO}. ${DIAS_CERRADO.charAt(0).toUpperCase() + DIAS_CERRADO.slice(1)} cerramos para descanso de la cocina.`,
  },
  {
    question: "¿A qué zonas hacen entrega?",
    answer:
      "Cocinamos en Guayaquil y entregamos con motorizado de PedidosYa. Al escribir tu dirección te decimos al instante si llegamos hasta ahí y cuánto cuesta el envío, antes de que pagues. Si quedas fuera de cobertura puedes coordinar el retiro por WhatsApp.",
  },
  {
    question: "¿Cuánto tarda la entrega?",
    answer:
      "El motorizado de PedidosYa cotiza al instante y la entrega suele ser entre 20 y 35 minutos dependiendo de la distancia. Cuando confirmas recibes la cotización exacta antes de pagar.",
  },
  {
    question: "¿Qué métodos de pago aceptan?",
    answer:
      "Cobro contra entrega (efectivo al motorizado) o coordinación previa por WhatsApp. El pago con tarjeta está en camino.",
  },
  {
    question: "¿Cómo funciona el tesoro de náufrago?",
    answer:
      `Por cada pedido entregado acumulas el ${PORCENTAJE_GANANCIA}% del total en tesoro de náufrago. Lo puedes usar como descuento en tus próximos pedidos (hasta la mitad del subtotal) o cambiarlo por premios · 5% de descuento por $1.00 de tesoro · 15% de descuento por $6.00 de tesoro.`,
  },
  {
    question: "¿Cómo accedo a mi cuenta?",
    answer:
      "Sin contraseña · entra con un enlace que te enviamos al correo o continúa con Google desde el ícono de usuario en la barra superior. Tu cuenta queda activa 90 días en el mismo dispositivo.",
  },
  {
    question: "¿Cómo cambio mi número de WhatsApp?",
    answer:
      "En Mi Cuenta → 'Mi WhatsApp' → Cambiar. Te enviamos un código de 4 dígitos al nuevo número para confirmar · al verificar transferimos automáticamente tu tesoro de náufrago + histórico de pedidos al nuevo WhatsApp.",
  },
  {
    question: "¿Puedo eliminar mi cuenta y mis datos?",
    answer:
      "Sí · desde Mi Cuenta → 'Eliminar cuenta'. Cumplimos LOPDP Ecuador · el borrado se completa a los 30 días (puedes cancelar el proceso volviendo a iniciar sesión). También puedes descargar todos tus datos en formato JSON antes de eliminar.",
  },
  {
    question: "¿Cómo funciona la ruleta del cofre del náufrago?",
    answer:
      "Toca el cofre en la isla · gira el timón · puedes ganar chifle · pan · cola gratis · o seguir intentando. Solo un giro por dispositivo cada 24 horas. Si ganas un premio se agrega automáticamente al carrito como regalo · cuando pagues el motorizado te lo lleva sin costo.",
  },
  {
    question: "¿Qué hago si mi pedido llega frío · tarde o con problemas?",
    answer:
      "Escríbenos por WhatsApp al 0997744288 · te respondemos al instante · resolvemos con reposición · descuento o reembolso según el caso. Tu derecho está protegido bajo la Ley de Defensa del Consumidor de Ecuador.",
  },
]
