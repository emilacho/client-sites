import { z } from "zod"

export const contactSubmissionSchema = z.object({
  name: z.string().min(1, "name_required").max(120),
  email: z.string().email("invalid_email").max(180),
  phone: z.string().max(40).optional().or(z.literal("")),
  message: z.string().min(1, "message_required").max(4000),
  turnstile_token: z.string().min(10, "missing_turnstile_token").optional(),
})

export type ContactSubmissionInput = z.infer<typeof contactSubmissionSchema>
