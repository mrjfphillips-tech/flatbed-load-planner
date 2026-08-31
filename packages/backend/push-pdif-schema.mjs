/**
 * Direct migration script for PDIF V1 tables.
 * Creates new tables without touching existing ones.
 */
import postgres from 'postgres';

const DATABASE_URL = 'postgresql://neondb_owner:npg_KuD3PfecMA4i@ep-bold-snow-amvxemmt.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require';
const sql = postgres(DATABASE_URL);

console.log('Creating PDIF V1 tables...');

try {
  // 1. pdif_sessions
  await sql`
    CREATE TABLE IF NOT EXISTS pdif_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      account_id UUID NOT NULL REFERENCES accounts(id),
      rep_id UUID NOT NULL,
      current_phase VARCHAR(20) NOT NULL DEFAULT 'discover',
      status VARCHAR(20) NOT NULL DEFAULT 'active',
      started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ended_at TIMESTAMPTZ,
      duration_seconds INTEGER,
      session_number INTEGER NOT NULL DEFAULT 1,
      attendees JSONB NOT NULL DEFAULT '[]',
      objectives JSONB NOT NULL DEFAULT '[]',
      summary TEXT,
      action_items JSONB NOT NULL DEFAULT '[]',
      follow_up_email TEXT,
      crm_exported BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS pdif_sessions_account_id_idx ON pdif_sessions(account_id)`;
  await sql`CREATE INDEX IF NOT EXISTS pdif_sessions_rep_id_idx ON pdif_sessions(rep_id)`;
  await sql`CREATE INDEX IF NOT EXISTS pdif_sessions_status_idx ON pdif_sessions(status)`;
  console.log('✓ pdif_sessions created');

  // 2. discovery_graph_nodes
  await sql`
    CREATE TABLE IF NOT EXISTS discovery_graph_nodes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      account_id UUID NOT NULL REFERENCES accounts(id),
      session_id UUID NOT NULL REFERENCES pdif_sessions(id),
      node_type VARCHAR(50) NOT NULL,
      label TEXT NOT NULL,
      properties JSONB NOT NULL DEFAULT '{}',
      confidence REAL NOT NULL DEFAULT 0.5,
      evidence_text TEXT,
      evidence_source VARCHAR(50) NOT NULL DEFAULT 'transcript',
      valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      valid_until TIMESTAMPTZ,
      version REAL NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS graph_nodes_account_id_idx ON discovery_graph_nodes(account_id)`;
  await sql`CREATE INDEX IF NOT EXISTS graph_nodes_session_id_idx ON discovery_graph_nodes(session_id)`;
  await sql`CREATE INDEX IF NOT EXISTS graph_nodes_node_type_idx ON discovery_graph_nodes(node_type)`;
  await sql`CREATE INDEX IF NOT EXISTS graph_nodes_valid_idx ON discovery_graph_nodes(valid_until)`;
  console.log('✓ discovery_graph_nodes created');

  // 3. discovery_graph_edges
  await sql`
    CREATE TABLE IF NOT EXISTS discovery_graph_edges (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      account_id UUID NOT NULL REFERENCES accounts(id),
      session_id UUID NOT NULL REFERENCES pdif_sessions(id),
      source_node_id UUID NOT NULL REFERENCES discovery_graph_nodes(id),
      target_node_id UUID NOT NULL REFERENCES discovery_graph_nodes(id),
      edge_type VARCHAR(50) NOT NULL,
      confidence REAL NOT NULL DEFAULT 0.7,
      properties JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS graph_edges_account_id_idx ON discovery_graph_edges(account_id)`;
  await sql`CREATE INDEX IF NOT EXISTS graph_edges_source_idx ON discovery_graph_edges(source_node_id)`;
  await sql`CREATE INDEX IF NOT EXISTS graph_edges_target_idx ON discovery_graph_edges(target_node_id)`;
  await sql`CREATE INDEX IF NOT EXISTS graph_edges_type_idx ON discovery_graph_edges(edge_type)`;
  console.log('✓ discovery_graph_edges created');

  // 4. confidence_scores
  await sql`
    CREATE TABLE IF NOT EXISTS confidence_scores (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      account_id UUID NOT NULL REFERENCES accounts(id),
      session_id UUID NOT NULL REFERENCES pdif_sessions(id),
      category VARCHAR(50) NOT NULL,
      score REAL NOT NULL DEFAULT 0,
      supporting_evidence JSONB NOT NULL DEFAULT '[]',
      gaps JSONB NOT NULL DEFAULT '[]',
      recommended_questions JSONB NOT NULL DEFAULT '[]',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS confidence_scores_account_id_idx ON confidence_scores(account_id)`;
  await sql`CREATE INDEX IF NOT EXISTS confidence_scores_session_id_idx ON confidence_scores(session_id)`;
  await sql`CREATE INDEX IF NOT EXISTS confidence_scores_category_idx ON confidence_scores(category)`;
  console.log('✓ confidence_scores created');

  // 5. session_transcripts
  await sql`
    CREATE TABLE IF NOT EXISTS session_transcripts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id UUID NOT NULL REFERENCES pdif_sessions(id),
      text TEXT NOT NULL,
      speaker VARCHAR(20) NOT NULL DEFAULT 'unknown',
      start_ms INTEGER NOT NULL,
      end_ms INTEGER NOT NULL,
      transcription_confidence REAL NOT NULL DEFAULT 0.9,
      processed BOOLEAN NOT NULL DEFAULT false,
      extracted_entities JSONB NOT NULL DEFAULT '[]',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS transcripts_session_id_idx ON session_transcripts(session_id)`;
  await sql`CREATE INDEX IF NOT EXISTS transcripts_speaker_idx ON session_transcripts(speaker)`;
  await sql`CREATE INDEX IF NOT EXISTS transcripts_processed_idx ON session_transcripts(processed)`;
  console.log('✓ session_transcripts created');

  // 6. question_suggestions
  await sql`
    CREATE TABLE IF NOT EXISTS question_suggestions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      account_id UUID NOT NULL REFERENCES accounts(id),
      session_id UUID NOT NULL REFERENCES pdif_sessions(id),
      question_text TEXT NOT NULL,
      pdif_phase VARCHAR(20) NOT NULL,
      topic_category VARCHAR(100),
      reasoning TEXT,
      source VARCHAR(50) NOT NULL DEFAULT 'ai_generated',
      rank INTEGER NOT NULL DEFAULT 1,
      scoring_factors JSONB NOT NULL DEFAULT '{}',
      was_asked BOOLEAN NOT NULL DEFAULT false,
      asked_at TIMESTAMPTZ,
      effectiveness REAL,
      suggested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS suggestions_account_id_idx ON question_suggestions(account_id)`;
  await sql`CREATE INDEX IF NOT EXISTS suggestions_session_id_idx ON question_suggestions(session_id)`;
  await sql`CREATE INDEX IF NOT EXISTS suggestions_phase_idx ON question_suggestions(pdif_phase)`;
  await sql`CREATE INDEX IF NOT EXISTS suggestions_asked_idx ON question_suggestions(was_asked)`;
  console.log('✓ question_suggestions created');

  console.log('\n✅ All PDIF V1 tables created successfully');
  console.log('Existing tables were not modified.');

} catch (err) {
  console.error('❌ Migration failed:', err.message);
} finally {
  await sql.end();
}
