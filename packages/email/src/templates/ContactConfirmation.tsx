import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components"

export interface ContactConfirmationProps {
  clientName: string
  submitterName: string
  message: string
}

export function ContactConfirmation({
  clientName,
  submitterName,
  message,
}: ContactConfirmationProps) {
  return (
    <Html>
      <Head />
      <Preview>{`${clientName} · recibimos tu mensaje`}</Preview>
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          <Heading style={headingStyle}>Hola {submitterName},</Heading>
          <Text style={paragraphStyle}>
            Recibimos tu mensaje en <strong>{clientName}</strong>. Vamos a
            revisarlo y te respondemos dentro de las próximas 24 horas
            laborables.
          </Text>
          <Section style={quoteWrapper}>
            <Text style={quoteStyle}>{message}</Text>
          </Section>
          <Text style={paragraphStyle}>Gracias por escribirnos.</Text>
          <Text style={signatureStyle}>— Equipo {clientName}</Text>
        </Container>
      </Body>
    </Html>
  )
}

const bodyStyle = { backgroundColor: "#fafafa", fontFamily: "system-ui, sans-serif" }
const containerStyle = { padding: "32px", maxWidth: "560px", margin: "0 auto" }
const headingStyle = { fontSize: "18px", color: "#111" }
const paragraphStyle = { fontSize: "15px", color: "#333", lineHeight: "1.6" }
const quoteWrapper = { borderLeft: "3px solid #ddd", paddingLeft: "16px", margin: "24px 0" }
const quoteStyle = { fontSize: "14px", color: "#555", fontStyle: "italic", whiteSpace: "pre-wrap" as const }
const signatureStyle = { fontSize: "14px", color: "#666", marginTop: "32px" }
