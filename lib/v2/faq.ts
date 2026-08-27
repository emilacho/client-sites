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
      "Atendemos de jueves a lunes de 9:00 AM a 5:00 PM. Martes y miércoles cerramos para descanso de la cocina.",
  },
  {
    question: "¿A qué zonas hacen entrega?",
    answer:
      "Entregamos en Olón y zonas cercanas dentro de un radio de ~15 km vía PedidosYa motorizado. Si tu dirección está fuera del radio podés coordinar pickup por WhatsApp.",
  },
  {
    question: "¿Cuánto tarda la entrega?",
    answer:
      "El motorizado de PedidosYa cotiza al instante y la entrega suele ser entre 20 y 35 minutos dependiendo de la distancia. Cuando confirmás recibís la cotización exacta antes de pagar.",
  },
  {
    question: "¿Qué métodos de pago aceptan?",
    answer:
      "Cobro contra entrega (efectivo al motorizado) o coordinación previa por WhatsApp. Próximamente vamos a integrar pago con tarjeta vía Kushki.",
  },
  {
    question: "¿Cómo funcionan las perlas del náufrago?",
    answer:
      "Por cada pedido entregado ganás un 10% del total en perlas (1 perla = $0.01). Las podés usar como descuento en futuros pedidos (cap 50% del subtotal) o canjear por rewards · 5% descuento (100 perlas) · 15% descuento (600 perlas).",
  },
  {
    question: "¿Cómo accedo a mi cuenta?",
    answer:
      "Sin password · solo email magic link o continuá con Google desde el ícono usuario en la barra superior. Tu cuenta queda activa 90 días en el mismo device.",
  },
  {
    question: "¿Cómo cambio mi número de WhatsApp?",
    answer:
      "En Mi Cuenta → 'Mi WhatsApp' → Cambiar. Te enviamos un código de 4 dígitos al nuevo número para confirmar · al verificar transferimos automáticamente tu balance de perlas + histórico de pedidos al nuevo WhatsApp.",
  },
  {
    question: "¿Puedo eliminar mi cuenta y mis datos?",
    answer:
      "Sí · desde Mi Cuenta → 'Eliminar cuenta'. Cumplimos LOPDP Ecuador · soft delete con 30 días de cooldown (podés cancelar el proceso volviendo a iniciar sesión). También podés descargar todos tus datos en formato JSON antes de eliminar.",
  },
  {
    question: "¿Cómo funciona la ruleta del cofre del náufrago?",
    answer:
      "Click el cofre en la isla · gira el timón · podés ganar chifle · pan · cola gratis · o seguir intentando. Solo 1 spin por IP cada 24 horas. Si ganás un premio se agrega automáticamente al carrito como regalo · cuando pagues el motorizado te lo lleva sin costo.",
  },
  {
    question: "¿Qué hago si mi pedido llega frío · tarde o con problemas?",
    answer:
      "Escribinos por WhatsApp al 0997744288 · te respondemos al instante · resolvemos con reposición · descuento o reembolso según el caso. Tu derecho está protegido bajo la Ley de Defensa del Consumidor de Ecuador.",
  },
]
