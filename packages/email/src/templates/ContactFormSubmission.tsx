import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components"

export interface ContactFormSubmissionProps {
  clientName: string
  submitterName: string
  submitterEmail: string
  submitterPhone?: string
  message: string
  submittedAt: string
}

export function ContactFormSubmission({
  clientName,
  submitterName,
  submitterEmail,
  submitterPhone,
  message,
  submittedAt,
}: ContactFormSubmissionProps) {
  return (
    <Html>
      <Head />
      <Preview>{`Nuevo contacto en ${clientName} · ${submitterName}`}</Preview>
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          <Heading style={headingStyle}>Nuevo contacto en {clientName}</Heading>
          <Section style={fieldStyle}>
            <Text style={labelStyle}>Nombre</Text>
            <Text style={valueStyle}>{submitterName}</Text>
          </Section>
          <Section style={fieldStyle}>
            <Text style={labelStyle}>Email</Text>
            <Text style={valueStyle}>{submitterEmail}</Text>
          </Section>
          {submitterPhone ? (
            <Section style={fieldStyle}>
              <Text style={labelStyle}>Teléfono</Text>
              <Text style={valueStyle}>{submitterPhone}</Text>
            </Section>
          ) : null}
          <Hr style={hrStyle} />
          <Section style={fieldStyle}>
            <Text style={labelStyle}>Mensaje</Text>
            <Text style={messageStyle}>{message}</Text>
          </Section>
          <Hr style={hrStyle} />
          <Text style={footerStyle}>Recibido {submittedAt}</Text>
        </Container>
      </Body>
    </Html>
  )
}

const bodyStyle = { backgroundColor: "#fafafa", fontFamily: "system-ui, sans-serif" }
const containerStyle = { padding: "32px", maxWidth: "560px", margin: "0 auto" }
const headingStyle = { fontSize: "20px", marginBottom: "24px", color: "#111" }
const fieldStyle = { marginBottom: "16px" }
const labelStyle = { fontSize: "12px", color: "#666", textTransform: "uppercase" as const, letterSpacing: "0.05em" }
const valueStyle = { fontSize: "15px", color: "#111", marginTop: "4px" }
const messageStyle = { fontSize: "15px", color: "#111", marginTop: "4px", whiteSpace: "pre-wrap" as const }
const hrStyle = { borderTop: "1px solid #eee", margin: "24px 0" }
const footerStyle = { fontSize: "12px", color: "#999" }
