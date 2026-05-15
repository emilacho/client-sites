-- client-sites · Phase 0 scaffolding · contact_submissions table
--
-- Backs the `POST /api/contact` route in every client site app. The same
-- table serves N clients · we discriminate via `client_slug` (matches
-- `cliente.config.ts.slug`) so a single Supabase Pro project covers the
-- whole client portfolio without per-client schema sprawl.
--
-- Service-role only writes · public never reads or writes this table. The
-- email delivery state (Resend message id, sent flags) is updated by the
-- same route after Resend ack lands · idempotent so a retry of the same
-- submission_id from the form won't duplicate the email send.
--
-- Idempotent · CREATE TABLE IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS contact_submissions (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_slug          TEXT NOT NULL,
  name                 TEXT NOT NULL,
  email                TEXT NOT NULL,
  phone                TEXT,
  message              TEXT NOT NULL,
  turnstile_token      TEXT,
  ip_address           TEXT,
  user_agent           TEXT,
  resend_message_id    TEXT,
  email_sent           BOOLEAN NOT NULL DEFAULT FALSE,
  notification_sent    BOOLEAN NOT NULL DEFAULT FALSE,
  submitted_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contact_submissions_client_submitted
  ON contact_submissions (client_slug, submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_contact_submissions_pending
  ON contact_submissions (submitted_at DESC)
  WHERE email_sent = FALSE OR notification_sent = FALSE;

ALTER TABLE contact_submissions ENABLE ROW LEVEL SECURITY;

-- Service-role only · same pattern as agent_invocations and
-- agent_image_generations. The Vercel routes use the service-role key so
-- all writes flow through it.
DROP POLICY IF EXISTS "contact_submissions_service_role_all"
  ON contact_submissions;

CREATE POLICY "contact_submissions_service_role_all"
  ON contact_submissions
  FOR ALL
  TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

COMMENT ON TABLE contact_submissions IS
  'Contact form submissions across all client sites in the client-sites monorepo. '
  'client_slug discriminates · matches cliente.config.ts.slug. '
  'Service-role writes only · email delivery state tracked in same row.';
