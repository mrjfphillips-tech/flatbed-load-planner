-- Row-Level Security Policies for role-based access
-- Requirements: 12.1, 12.3, 12.4, 12.5
--
-- Roles:
--   rep: read/write only own sessions, read own accounts
--   manager: read all sessions, transcripts, summaries, and coverage
--   admin: full access to all data

-- Create application roles if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'ptv_rep') THEN
    CREATE ROLE ptv_rep;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'ptv_manager') THEN
    CREATE ROLE ptv_manager;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'ptv_admin') THEN
    CREATE ROLE ptv_admin;
  END IF;
END
$$;

-- Grant basic usage on schema
GRANT USAGE ON SCHEMA public TO ptv_rep, ptv_manager, ptv_admin;

-- ─── Sessions RLS ─────────────────────────────────────────────────────────────

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- Rep can only see and modify their own sessions
CREATE POLICY sessions_rep_select ON sessions
  FOR SELECT TO ptv_rep
  USING (rep_id = current_setting('app.current_user_id', true)::uuid);

CREATE POLICY sessions_rep_insert ON sessions
  FOR INSERT TO ptv_rep
  WITH CHECK (rep_id = current_setting('app.current_user_id', true)::uuid);

CREATE POLICY sessions_rep_update ON sessions
  FOR UPDATE TO ptv_rep
  USING (rep_id = current_setting('app.current_user_id', true)::uuid)
  WITH CHECK (rep_id = current_setting('app.current_user_id', true)::uuid);

-- Manager can read all sessions
CREATE POLICY sessions_manager_select ON sessions
  FOR SELECT TO ptv_manager
  USING (true);

-- Admin has full access
CREATE POLICY sessions_admin_all ON sessions
  FOR ALL TO ptv_admin
  USING (true)
  WITH CHECK (true);

-- ─── Accounts RLS ─────────────────────────────────────────────────────────────

ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;

-- Rep can see accounts they have sessions for
CREATE POLICY accounts_rep_select ON accounts
  FOR SELECT TO ptv_rep
  USING (
    EXISTS (
      SELECT 1 FROM sessions s
      WHERE s.account_id = accounts.id
      AND s.rep_id = current_setting('app.current_user_id', true)::uuid
    )
  );

CREATE POLICY accounts_rep_insert ON accounts
  FOR INSERT TO ptv_rep
  WITH CHECK (true);

-- Manager can read all accounts
CREATE POLICY accounts_manager_select ON accounts
  FOR SELECT TO ptv_manager
  USING (true);

-- Admin has full access
CREATE POLICY accounts_admin_all ON accounts
  FOR ALL TO ptv_admin
  USING (true)
  WITH CHECK (true);

-- ─── Contacts RLS ─────────────────────────────────────────────────────────────

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

-- Rep can see contacts for accounts they have sessions for
CREATE POLICY contacts_rep_select ON contacts
  FOR SELECT TO ptv_rep
  USING (
    EXISTS (
      SELECT 1 FROM sessions s
      WHERE s.account_id = contacts.account_id
      AND s.rep_id = current_setting('app.current_user_id', true)::uuid
    )
  );

CREATE POLICY contacts_rep_insert ON contacts
  FOR INSERT TO ptv_rep
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sessions s
      WHERE s.account_id = contacts.account_id
      AND s.rep_id = current_setting('app.current_user_id', true)::uuid
    )
  );

CREATE POLICY contacts_rep_update ON contacts
  FOR UPDATE TO ptv_rep
  USING (
    EXISTS (
      SELECT 1 FROM sessions s
      WHERE s.account_id = contacts.account_id
      AND s.rep_id = current_setting('app.current_user_id', true)::uuid
    )
  );

-- Manager can read all contacts
CREATE POLICY contacts_manager_select ON contacts
  FOR SELECT TO ptv_manager
  USING (true);

-- Admin has full access
CREATE POLICY contacts_admin_all ON contacts
  FOR ALL TO ptv_admin
  USING (true)
  WITH CHECK (true);

-- ─── Summaries RLS ────────────────────────────────────────────────────────────

ALTER TABLE summaries ENABLE ROW LEVEL SECURITY;

-- Rep can see summaries for their own sessions
CREATE POLICY summaries_rep_select ON summaries
  FOR SELECT TO ptv_rep
  USING (
    EXISTS (
      SELECT 1 FROM sessions s
      WHERE s.id = summaries.session_id
      AND s.rep_id = current_setting('app.current_user_id', true)::uuid
    )
  );

CREATE POLICY summaries_rep_insert ON summaries
  FOR INSERT TO ptv_rep
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sessions s
      WHERE s.id = summaries.session_id
      AND s.rep_id = current_setting('app.current_user_id', true)::uuid
    )
  );

CREATE POLICY summaries_rep_update ON summaries
  FOR UPDATE TO ptv_rep
  USING (
    EXISTS (
      SELECT 1 FROM sessions s
      WHERE s.id = summaries.session_id
      AND s.rep_id = current_setting('app.current_user_id', true)::uuid
    )
  );

-- Manager can read all summaries
CREATE POLICY summaries_manager_select ON summaries
  FOR SELECT TO ptv_manager
  USING (true);

-- Admin has full access
CREATE POLICY summaries_admin_all ON summaries
  FOR ALL TO ptv_admin
  USING (true)
  WITH CHECK (true);

-- ─── Evaluation Records RLS ───────────────────────────────────────────────────

ALTER TABLE evaluation_records ENABLE ROW LEVEL SECURITY;

-- Rep can see evaluation records for their own sessions
CREATE POLICY evaluation_records_rep_select ON evaluation_records
  FOR SELECT TO ptv_rep
  USING (
    EXISTS (
      SELECT 1 FROM sessions s
      WHERE s.id = evaluation_records.session_id
      AND s.rep_id = current_setting('app.current_user_id', true)::uuid
    )
  );

-- Manager can read all evaluation records
CREATE POLICY evaluation_records_manager_select ON evaluation_records
  FOR SELECT TO ptv_manager
  USING (true);

-- Admin has full access
CREATE POLICY evaluation_records_admin_all ON evaluation_records
  FOR ALL TO ptv_admin
  USING (true)
  WITH CHECK (true);

-- ─── Source Documents RLS ─────────────────────────────────────────────────────

ALTER TABLE source_documents ENABLE ROW LEVEL SECURITY;

-- Access controlled via rights_profiles (role-based filtering in application layer)
-- All authenticated users can read source documents; rights are enforced at query time
CREATE POLICY source_documents_read ON source_documents
  FOR SELECT TO ptv_rep, ptv_manager
  USING (true);

-- Only admin can manage source documents
CREATE POLICY source_documents_admin_all ON source_documents
  FOR ALL TO ptv_admin
  USING (true)
  WITH CHECK (true);

-- ─── Chunks RLS ───────────────────────────────────────────────────────────────

ALTER TABLE chunks ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read chunks; rights enforced at application level
CREATE POLICY chunks_read ON chunks
  FOR SELECT TO ptv_rep, ptv_manager
  USING (true);

-- Only admin can manage chunks
CREATE POLICY chunks_admin_all ON chunks
  FOR ALL TO ptv_admin
  USING (true)
  WITH CHECK (true);

-- ─── Rights Profiles RLS ──────────────────────────────────────────────────────

ALTER TABLE rights_profiles ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read rights profiles
CREATE POLICY rights_profiles_read ON rights_profiles
  FOR SELECT TO ptv_rep, ptv_manager
  USING (true);

-- Only admin can manage rights profiles
CREATE POLICY rights_profiles_admin_all ON rights_profiles
  FOR ALL TO ptv_admin
  USING (true)
  WITH CHECK (true);

-- ─── Experiments RLS ──────────────────────────────────────────────────────────

ALTER TABLE experiments ENABLE ROW LEVEL SECURITY;

-- Manager and rep can read experiments
CREATE POLICY experiments_read ON experiments
  FOR SELECT TO ptv_rep, ptv_manager
  USING (true);

-- Only admin can manage experiments
CREATE POLICY experiments_admin_all ON experiments
  FOR ALL TO ptv_admin
  USING (true)
  WITH CHECK (true);

-- ─── Preferred Questions RLS ──────────────────────────────────────────────────

ALTER TABLE preferred_questions ENABLE ROW LEVEL SECURITY;

-- Rep can only manage their own preferred questions
CREATE POLICY preferred_questions_rep_all ON preferred_questions
  FOR ALL TO ptv_rep
  USING (rep_id = current_setting('app.current_user_id', true)::uuid)
  WITH CHECK (rep_id = current_setting('app.current_user_id', true)::uuid);

-- Manager can read all preferred questions
CREATE POLICY preferred_questions_manager_select ON preferred_questions
  FOR SELECT TO ptv_manager
  USING (true);

-- Admin has full access
CREATE POLICY preferred_questions_admin_all ON preferred_questions
  FOR ALL TO ptv_admin
  USING (true)
  WITH CHECK (true);

-- ─── Objection Events RLS ─────────────────────────────────────────────────────

ALTER TABLE objection_events ENABLE ROW LEVEL SECURITY;

-- Rep can see objection events for their own sessions
CREATE POLICY objection_events_rep_select ON objection_events
  FOR SELECT TO ptv_rep
  USING (
    EXISTS (
      SELECT 1 FROM sessions s
      WHERE s.id = objection_events.session_id
      AND s.rep_id = current_setting('app.current_user_id', true)::uuid
    )
  );

CREATE POLICY objection_events_rep_insert ON objection_events
  FOR INSERT TO ptv_rep
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sessions s
      WHERE s.id = objection_events.session_id
      AND s.rep_id = current_setting('app.current_user_id', true)::uuid
    )
  );

-- Manager can read all objection events
CREATE POLICY objection_events_manager_select ON objection_events
  FOR SELECT TO ptv_manager
  USING (true);

-- Admin has full access
CREATE POLICY objection_events_admin_all ON objection_events
  FOR ALL TO ptv_admin
  USING (true)
  WITH CHECK (true);

-- ─── Export Events RLS ────────────────────────────────────────────────────────

ALTER TABLE export_events ENABLE ROW LEVEL SECURITY;

-- Rep can see export events for their own sessions
CREATE POLICY export_events_rep_select ON export_events
  FOR SELECT TO ptv_rep
  USING (
    EXISTS (
      SELECT 1 FROM sessions s
      WHERE s.id = export_events.session_id
      AND s.rep_id = current_setting('app.current_user_id', true)::uuid
    )
  );

CREATE POLICY export_events_rep_insert ON export_events
  FOR INSERT TO ptv_rep
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sessions s
      WHERE s.id = export_events.session_id
      AND s.rep_id = current_setting('app.current_user_id', true)::uuid
    )
  );

-- Manager can read all export events
CREATE POLICY export_events_manager_select ON export_events
  FOR SELECT TO ptv_manager
  USING (true);

-- Admin has full access
CREATE POLICY export_events_admin_all ON export_events
  FOR ALL TO ptv_admin
  USING (true)
  WITH CHECK (true);

-- ─── Questions RLS ────────────────────────────────────────────────────────────

ALTER TABLE questions ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read questions
CREATE POLICY questions_read ON questions
  FOR SELECT TO ptv_rep, ptv_manager
  USING (true);

-- Only admin can manage questions
CREATE POLICY questions_admin_all ON questions
  FOR ALL TO ptv_admin
  USING (true)
  WITH CHECK (true);

-- ─── Rep Performance Metrics RLS ──────────────────────────────────────────────

ALTER TABLE rep_performance_metrics ENABLE ROW LEVEL SECURITY;

-- Rep can only see their own metrics
CREATE POLICY rep_performance_metrics_rep_select ON rep_performance_metrics
  FOR SELECT TO ptv_rep
  USING (rep_id = current_setting('app.current_user_id', true)::uuid);

-- Manager can see all metrics
CREATE POLICY rep_performance_metrics_manager_select ON rep_performance_metrics
  FOR SELECT TO ptv_manager
  USING (true);

-- Admin has full access
CREATE POLICY rep_performance_metrics_admin_all ON rep_performance_metrics
  FOR ALL TO ptv_admin
  USING (true)
  WITH CHECK (true);

-- ─── Pre-Call Plans RLS ───────────────────────────────────────────────────────

ALTER TABLE pre_call_plans ENABLE ROW LEVEL SECURITY;

-- Rep can manage their own pre-call plans
CREATE POLICY pre_call_plans_rep_all ON pre_call_plans
  FOR ALL TO ptv_rep
  USING (rep_id = current_setting('app.current_user_id', true)::uuid)
  WITH CHECK (rep_id = current_setting('app.current_user_id', true)::uuid);

-- Manager can read all pre-call plans
CREATE POLICY pre_call_plans_manager_select ON pre_call_plans
  FOR SELECT TO ptv_manager
  USING (true);

-- Admin has full access
CREATE POLICY pre_call_plans_admin_all ON pre_call_plans
  FOR ALL TO ptv_admin
  USING (true)
  WITH CHECK (true);

-- ─── Crosswalk Mappings RLS ───────────────────────────────────────────────────

ALTER TABLE crosswalk_mappings ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read crosswalk mappings
CREATE POLICY crosswalk_mappings_read ON crosswalk_mappings
  FOR SELECT TO ptv_rep, ptv_manager
  USING (true);

-- Only admin can manage crosswalk mappings
CREATE POLICY crosswalk_mappings_admin_all ON crosswalk_mappings
  FOR ALL TO ptv_admin
  USING (true)
  WITH CHECK (true);

-- ─── Framework Weighting Profiles RLS ─────────────────────────────────────────

ALTER TABLE framework_weighting_profiles ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read weighting profiles
CREATE POLICY framework_weighting_profiles_read ON framework_weighting_profiles
  FOR SELECT TO ptv_rep, ptv_manager
  USING (true);

-- Only admin can manage weighting profiles
CREATE POLICY framework_weighting_profiles_admin_all ON framework_weighting_profiles
  FOR ALL TO ptv_admin
  USING (true)
  WITH CHECK (true);
