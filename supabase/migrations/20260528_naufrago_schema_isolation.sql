-- R97.2 · Schema isolation B · move all naufrago_* objects from public
-- to dedicated `naufrago` schema. Cleaner namespace + barrier técnico
-- contra accidental writes a tablas del sistema agencia.
--
-- End state ·
--   public.naufrago_orders                → naufrago.orders
--   public.naufrago_voice_calls           → naufrago.voice_calls
--   public.naufrago_customers             → naufrago.customers
--   ... (17 tablas en total)
--   public.naufrago_drivers_touch_*       → naufrago.drivers_touch_*
--   ... (5 functions en total)
--
-- Triggers no requieren recreate · referencian function por OID interno
-- y siguen al function move. FKs y indices siguen a la tabla en SET SCHEMA.
--
-- Realtime publication · single table (loyalty_balance) requires
-- explicit re-add post-move (publications no se mueven cross-schema).

------------------------------------------------------------------
-- 0) Schema + permisos
------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS naufrago;
GRANT USAGE ON SCHEMA naufrago TO anon, authenticated, service_role;
GRANT ALL ON SCHEMA naufrago TO service_role;

------------------------------------------------------------------
-- 1) Drop from realtime publication BEFORE schema move
------------------------------------------------------------------
ALTER PUBLICATION supabase_realtime DROP TABLE public.naufrago_loyalty_balance;

------------------------------------------------------------------
-- 2) Move all 17 tables → naufrago schema (FKs + indexes follow)
------------------------------------------------------------------
ALTER TABLE public.naufrago_consent_log         SET SCHEMA naufrago;
ALTER TABLE public.naufrago_customers           SET SCHEMA naufrago;
ALTER TABLE public.naufrago_drivers             SET SCHEMA naufrago;
ALTER TABLE public.naufrago_dynamic_options     SET SCHEMA naufrago;
ALTER TABLE public.naufrago_easy_orders         SET SCHEMA naufrago;
ALTER TABLE public.naufrago_juice_admin_log     SET SCHEMA naufrago;
ALTER TABLE public.naufrago_loyalty_balance     SET SCHEMA naufrago;
ALTER TABLE public.naufrago_loyalty_ledger      SET SCHEMA naufrago;
ALTER TABLE public.naufrago_order_events        SET SCHEMA naufrago;
ALTER TABLE public.naufrago_order_reviews       SET SCHEMA naufrago;
ALTER TABLE public.naufrago_orders              SET SCHEMA naufrago;
ALTER TABLE public.naufrago_otp_codes           SET SCHEMA naufrago;
ALTER TABLE public.naufrago_promo_usage         SET SCHEMA naufrago;
ALTER TABLE public.naufrago_push_subscriptions  SET SCHEMA naufrago;
ALTER TABLE public.naufrago_ruleta_spins        SET SCHEMA naufrago;
ALTER TABLE public.naufrago_subscribers         SET SCHEMA naufrago;
ALTER TABLE public.naufrago_voice_calls         SET SCHEMA naufrago;

------------------------------------------------------------------
-- 3) Drop the naufrago_ prefix from table names (clean end state)
------------------------------------------------------------------
ALTER TABLE naufrago.naufrago_consent_log        RENAME TO consent_log;
ALTER TABLE naufrago.naufrago_customers          RENAME TO customers;
ALTER TABLE naufrago.naufrago_drivers            RENAME TO drivers;
ALTER TABLE naufrago.naufrago_dynamic_options    RENAME TO dynamic_options;
ALTER TABLE naufrago.naufrago_easy_orders        RENAME TO easy_orders;
ALTER TABLE naufrago.naufrago_juice_admin_log    RENAME TO juice_admin_log;
ALTER TABLE naufrago.naufrago_loyalty_balance    RENAME TO loyalty_balance;
ALTER TABLE naufrago.naufrago_loyalty_ledger     RENAME TO loyalty_ledger;
ALTER TABLE naufrago.naufrago_order_events       RENAME TO order_events;
ALTER TABLE naufrago.naufrago_order_reviews      RENAME TO order_reviews;
ALTER TABLE naufrago.naufrago_orders             RENAME TO orders;
ALTER TABLE naufrago.naufrago_otp_codes          RENAME TO otp_codes;
ALTER TABLE naufrago.naufrago_promo_usage        RENAME TO promo_usage;
ALTER TABLE naufrago.naufrago_push_subscriptions RENAME TO push_subscriptions;
ALTER TABLE naufrago.naufrago_ruleta_spins       RENAME TO ruleta_spins;
ALTER TABLE naufrago.naufrago_subscribers        RENAME TO subscribers;
ALTER TABLE naufrago.naufrago_voice_calls        RENAME TO voice_calls;

------------------------------------------------------------------
-- 4) Move + rename trigger/helper functions
------------------------------------------------------------------
ALTER FUNCTION public.naufrago_drivers_touch_updated_at()     SET SCHEMA naufrago;
ALTER FUNCTION public.naufrago_dynamic_options_touch()        SET SCHEMA naufrago;
ALTER FUNCTION public.naufrago_loyalty_balance_touch()        SET SCHEMA naufrago;
ALTER FUNCTION public.naufrago_subscribers_touch_updated_at() SET SCHEMA naufrago;
ALTER FUNCTION public.gen_naufrago_order_code()               SET SCHEMA naufrago;

ALTER FUNCTION naufrago.naufrago_drivers_touch_updated_at()     RENAME TO drivers_touch_updated_at;
ALTER FUNCTION naufrago.naufrago_dynamic_options_touch()        RENAME TO dynamic_options_touch;
ALTER FUNCTION naufrago.naufrago_loyalty_balance_touch()        RENAME TO loyalty_balance_touch;
ALTER FUNCTION naufrago.naufrago_subscribers_touch_updated_at() RENAME TO subscribers_touch_updated_at;
ALTER FUNCTION naufrago.gen_naufrago_order_code()               RENAME TO gen_order_code;

------------------------------------------------------------------
-- 5) Grant table/function privileges (apply to existing + future)
------------------------------------------------------------------
GRANT ALL ON ALL TABLES    IN SCHEMA naufrago TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA naufrago TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA naufrago TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA naufrago GRANT ALL ON TABLES     TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA naufrago GRANT ALL ON SEQUENCES  TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA naufrago GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;

------------------------------------------------------------------
-- 6) Re-add loyalty_balance to supabase_realtime publication
--    (cliente subscribe a UPDATE para refresh del perlas chip post-DELIVERED)
------------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE naufrago.loyalty_balance;

------------------------------------------------------------------
-- 7) Schema-level comment
------------------------------------------------------------------
COMMENT ON SCHEMA naufrago IS
  'R97.2 · Cliente piloto Náufrago (ghost kitchen Olón) · namespace aislado para pedidos · clientes · jugos · lealtad · voz IA · subscriptores. Aislamiento Postgres del sistema agencia · futuro multi-cliente pattern.';
