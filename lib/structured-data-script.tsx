/**
 * JsonLdScript · R96.131 · helper para inyectar JSON-LD en JSX.
 */
type JsonLd = Record<string, unknown>

export function JsonLdScript({ data }: { data: JsonLd | JsonLd[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}
