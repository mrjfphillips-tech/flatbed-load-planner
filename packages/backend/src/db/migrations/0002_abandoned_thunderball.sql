CREATE TYPE "public"."flatbed_user_role" AS ENUM('Planner', 'Loader', 'Driver', 'Supervisor', 'Administrator', 'Customer_Viewer');--> statement-breakpoint
CREATE TYPE "public"."deck_material" AS ENUM('steel', 'aluminum', 'wood');--> statement-breakpoint
CREATE TYPE "public"."load_pattern" AS ENUM('layered', 'column_building', 'row_building', 'long_product', 'nested', 'customer_zoning', 'mixed');--> statement-breakpoint
CREATE TYPE "public"."plan_status" AS ENUM('draft', 'pending_approval', 'approved', 'rejected', 'superseded');--> statement-breakpoint
CREATE TYPE "public"."securement_type" AS ENUM('chain', 'strap', 'chain_with_binder');--> statement-breakpoint
CREATE TYPE "public"."warning_severity" AS ENUM('error', 'warning', 'info');--> statement-breakpoint
CREATE TYPE "public"."rule_type" AS ENUM('hard_constraint', 'soft_preference', 'advisory');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"organization_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"rep_id" uuid NOT NULL,
	"deal_stage" varchar(50) DEFAULT 'first_discovery' NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"duration_seconds" integer,
	"is_offline_recovery" boolean DEFAULT false NOT NULL,
	"pre_call_plan_id" uuid,
	"experiment_assignment_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"full_name" varchar(255) NOT NULL,
	"job_title" varchar(255),
	"email" varchar(255),
	"phone" varchar(50),
	"address" text,
	"linkedin_url" varchar(500),
	"buyer_persona" varchar(100),
	"business_card_image_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "preferred_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rep_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"framework" varchar(50) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "preferred_questions_rep_question_unique" UNIQUE("rep_id","question_id")
);
--> statement-breakpoint
CREATE TABLE "questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"text" text NOT NULL,
	"framework" varchar(50) NOT NULL,
	"canonical_field" varchar(50),
	"framework_native_field" varchar(100),
	"buyer_persona" varchar(100),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "source_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(500) NOT NULL,
	"author" varchar(255),
	"framework_affiliation" varchar(50)[],
	"mime_type" varchar(100) NOT NULL,
	"file_url" text NOT NULL,
	"page_count" integer,
	"rights_profile_id" uuid NOT NULL,
	"ingestion_status" varchar(20) DEFAULT 'pending' NOT NULL,
	"ingested_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_document_id" uuid NOT NULL,
	"chunk_index" integer NOT NULL,
	"content" text NOT NULL,
	"canonical_fields" varchar(50)[],
	"framework_native_fields" varchar(100)[],
	"section_title" varchar(255),
	"page_number" integer,
	"embedding" vector(1536),
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rights_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"licensing_type" varchar(50) NOT NULL,
	"permitted_roles" varchar(20)[] NOT NULL,
	"permitted_teams" uuid[],
	"attribution_text" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evaluation_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"response_id" varchar(255) NOT NULL,
	"factuality" real NOT NULL,
	"groundedness" real NOT NULL,
	"citation_quality" real NOT NULL,
	"latency_ms" integer NOT NULL,
	"token_cost" integer NOT NULL,
	"passes_threshold" boolean NOT NULL,
	"issues" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"evaluated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "experiments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"control_strategy" jsonb NOT NULL,
	"treatment_strategy" jsonb NOT NULL,
	"target_population" jsonb NOT NULL,
	"duration_days" integer NOT NULL,
	"significance_threshold" real DEFAULT 0.05 NOT NULL,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rep_performance_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rep_id" uuid NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"framework_usage" jsonb,
	"avg_intent_scores" jsonb,
	"coverage_velocity_minutes" real,
	"talk_time_ratio" real,
	"question_acceptance_rate" real,
	"objection_handling_score" real,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pre_call_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"rep_id" uuid NOT NULL,
	"attendees" jsonb NOT NULL,
	"deal_stage" varchar(50) NOT NULL,
	"topics" jsonb,
	"notes" text,
	"generated_plan" jsonb,
	"rep_modified_plan" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "summaries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"ai_generated" text NOT NULL,
	"rep_edited" text,
	"coverage_snapshot" jsonb NOT NULL,
	"key_findings" jsonb NOT NULL,
	"action_items" jsonb NOT NULL,
	"next_steps" jsonb NOT NULL,
	"framework_contributions" jsonb,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_edited_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "crosswalk_mappings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"framework" varchar(50) NOT NULL,
	"native_field" varchar(100) NOT NULL,
	"canonical_field" varchar(50) NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "crosswalk_mappings_framework_native_unique" UNIQUE("framework","native_field")
);
--> statement-breakpoint
CREATE TABLE "framework_weighting_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_stage" varchar(50) NOT NULL,
	"weights" jsonb NOT NULL,
	"organization_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "framework_weighting_profiles_org_stage_unique" UNIQUE("organization_id","deal_stage")
);
--> statement-breakpoint
CREATE TABLE "objection_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"objection_type" varchar(50) NOT NULL,
	"trigger_text" text NOT NULL,
	"response_strategy" text,
	"framework_attribution" varchar(50),
	"effectiveness_score" real,
	"detected_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "export_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"platform" varchar(50) NOT NULL,
	"export_type" varchar(50) NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"external_id" varchar(255),
	"error" text,
	"payload" jsonb,
	"retry_count" varchar(10) DEFAULT '0',
	"retryable" boolean DEFAULT true,
	"exported_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coverage_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"field_type" varchar(20) NOT NULL,
	"field_name" varchar(100) NOT NULL,
	"framework" varchar(50),
	"score" real NOT NULL,
	"snapshot_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "question_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"event_type" varchar(20) NOT NULL,
	"framework" varchar(50) NOT NULL,
	"intent_score" real,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pdif_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"rep_id" uuid NOT NULL,
	"current_phase" varchar(20) DEFAULT 'discover' NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"duration_seconds" integer,
	"session_number" integer DEFAULT 1 NOT NULL,
	"attendees" jsonb DEFAULT '[]' NOT NULL,
	"objectives" jsonb DEFAULT '[]' NOT NULL,
	"summary" text,
	"action_items" jsonb DEFAULT '[]' NOT NULL,
	"follow_up_email" text,
	"crm_exported" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discovery_graph_edges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"source_node_id" uuid NOT NULL,
	"target_node_id" uuid NOT NULL,
	"edge_type" varchar(50) NOT NULL,
	"confidence" real DEFAULT 0.7 NOT NULL,
	"properties" jsonb DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discovery_graph_nodes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"node_type" varchar(50) NOT NULL,
	"label" text NOT NULL,
	"properties" jsonb DEFAULT '{}' NOT NULL,
	"confidence" real DEFAULT 0.5 NOT NULL,
	"evidence_text" text,
	"evidence_source" varchar(50) DEFAULT 'transcript' NOT NULL,
	"valid_from" timestamp with time zone DEFAULT now() NOT NULL,
	"valid_until" timestamp with time zone,
	"version" real DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "confidence_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"category" varchar(50) NOT NULL,
	"score" real DEFAULT 0 NOT NULL,
	"supporting_evidence" jsonb DEFAULT '[]' NOT NULL,
	"gaps" jsonb DEFAULT '[]' NOT NULL,
	"recommended_questions" jsonb DEFAULT '[]' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "question_suggestions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"question_text" text NOT NULL,
	"pdif_phase" varchar(20) NOT NULL,
	"topic_category" varchar(100),
	"reasoning" text,
	"source" varchar(50) DEFAULT 'ai_generated' NOT NULL,
	"rank" integer DEFAULT 1 NOT NULL,
	"scoring_factors" jsonb DEFAULT '{}' NOT NULL,
	"was_asked" boolean DEFAULT false NOT NULL,
	"asked_at" timestamp with time zone,
	"effectiveness" real,
	"suggested_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session_transcripts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"text" text NOT NULL,
	"speaker" varchar(20) DEFAULT 'unknown' NOT NULL,
	"start_ms" integer NOT NULL,
	"end_ms" integer NOT NULL,
	"transcription_confidence" real DEFAULT 0.9 NOT NULL,
	"processed" boolean DEFAULT false NOT NULL,
	"extracted_entities" jsonb DEFAULT '[]' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flatbed_user_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "flatbed_user_role" NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flatbed_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"password_hash" varchar(512),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "flatbed_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "equipment_tractors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"steer_axle_rating" real NOT NULL,
	"drive_axle_rating" real NOT NULL,
	"fifth_wheel_position" real NOT NULL,
	"tare_weight" real NOT NULL,
	"drive_axle_count" integer DEFAULT 2 NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "equipment_trailers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"length_ft" real NOT NULL,
	"deck_width_in" real NOT NULL,
	"deck_height_in" real NOT NULL,
	"max_gross_weight" real NOT NULL,
	"tare_weight" real NOT NULL,
	"axle_count" integer NOT NULL,
	"axle_positions" json NOT NULL,
	"axle_weight_ratings" json NOT NULL,
	"kingpin_position" real NOT NULL,
	"rear_overhang_limit" real NOT NULL,
	"deck_material" "deck_material" DEFAULT 'steel' NOT NULL,
	"stake_pockets" json NOT NULL,
	"anchor_points" json NOT NULL,
	"max_concentrated_load_psf" real NOT NULL,
	"is_template" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "load_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_by" uuid NOT NULL,
	"trailer_id" uuid NOT NULL,
	"tractor_id" uuid NOT NULL,
	"current_version" integer DEFAULT 1 NOT NULL,
	"status" "plan_status" DEFAULT 'draft' NOT NULL,
	"pattern" "load_pattern",
	"freight_manifest" json,
	"multi_load_set_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "multi_load_sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255),
	"description" text,
	"created_by" uuid NOT NULL,
	"total_freight_count" integer,
	"total_weight" real,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plan_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"version_status" "plan_status" DEFAULT 'draft' NOT NULL,
	"placed_freight" json,
	"weight_metrics" json,
	"securement_plan" json,
	"loading_sequence" json,
	"warnings" json,
	"created_by" uuid,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"rejection_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plan_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"order_number" varchar(100) NOT NULL,
	"customer_name" varchar(255),
	"delivery_stop" integer NOT NULL,
	"product_type" varchar(100) NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"piece_weight" real NOT NULL,
	"total_line_weight" real NOT NULL,
	"dimension_length" real NOT NULL,
	"dimension_width" real NOT NULL,
	"dimension_height" real NOT NULL,
	"position_x" real,
	"position_y" real,
	"position_z" real,
	"orientation" varchar(20),
	"layer" integer DEFAULT 0,
	"support_method" varchar(50),
	"handling_method" varchar(20) NOT NULL,
	"stack_permission" varchar(20) NOT NULL,
	"max_stack_height" real,
	"max_stack_weight" real,
	"orientation_requirement" varchar(20),
	"dunnage_required" boolean DEFAULT false NOT NULL,
	"special_notes" text,
	"geometric_type" varchar(50),
	"contact_footprint" json,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plan_warnings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"rule_id" varchar(100),
	"severity" "warning_severity" NOT NULL,
	"message" text NOT NULL,
	"affected_items" json,
	"threshold" real,
	"actual" real,
	"suggested_action" text,
	"acknowledged" boolean DEFAULT false NOT NULL,
	"acknowledged_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "securement_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"plan_item_id" uuid NOT NULL,
	"type" "securement_type" NOT NULL,
	"wll" real NOT NULL,
	"anchor_point_id" varchar(100),
	"route_description" text,
	"edge_protector_required" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification_checklists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_version_id" uuid NOT NULL,
	"driver_id" uuid,
	"item_presence_checks" json,
	"securement_checks" json,
	"weight_check_verified" boolean DEFAULT false,
	"weight_check_notes" text,
	"damage_check_verified" boolean DEFAULT false,
	"damage_check_notes" text,
	"all_verified" boolean DEFAULT false NOT NULL,
	"verified_at" timestamp with time zone,
	"non_conformance_description" text,
	"supervisor_notified" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flatbed_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"type" "rule_type" NOT NULL,
	"conditions" json,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rule_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rule_id" uuid NOT NULL,
	"changed_by" uuid NOT NULL,
	"previous_type" "rule_type" NOT NULL,
	"new_type" "rule_type" NOT NULL,
	"change_description" text,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preferred_questions" ADD CONSTRAINT "preferred_questions_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_documents" ADD CONSTRAINT "source_documents_rights_profile_id_rights_profiles_id_fk" FOREIGN KEY ("rights_profile_id") REFERENCES "public"."rights_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chunks" ADD CONSTRAINT "chunks_source_document_id_source_documents_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."source_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluation_records" ADD CONSTRAINT "evaluation_records_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pre_call_plans" ADD CONSTRAINT "pre_call_plans_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "summaries" ADD CONSTRAINT "summaries_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "objection_events" ADD CONSTRAINT "objection_events_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "export_events" ADD CONSTRAINT "export_events_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coverage_snapshots" ADD CONSTRAINT "coverage_snapshots_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_events" ADD CONSTRAINT "question_events_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_events" ADD CONSTRAINT "question_events_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pdif_sessions" ADD CONSTRAINT "pdif_sessions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovery_graph_edges" ADD CONSTRAINT "discovery_graph_edges_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovery_graph_edges" ADD CONSTRAINT "discovery_graph_edges_session_id_pdif_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."pdif_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovery_graph_edges" ADD CONSTRAINT "discovery_graph_edges_source_node_id_discovery_graph_nodes_id_fk" FOREIGN KEY ("source_node_id") REFERENCES "public"."discovery_graph_nodes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovery_graph_edges" ADD CONSTRAINT "discovery_graph_edges_target_node_id_discovery_graph_nodes_id_fk" FOREIGN KEY ("target_node_id") REFERENCES "public"."discovery_graph_nodes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovery_graph_nodes" ADD CONSTRAINT "discovery_graph_nodes_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovery_graph_nodes" ADD CONSTRAINT "discovery_graph_nodes_session_id_pdif_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."pdif_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "confidence_scores" ADD CONSTRAINT "confidence_scores_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "confidence_scores" ADD CONSTRAINT "confidence_scores_session_id_pdif_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."pdif_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_suggestions" ADD CONSTRAINT "question_suggestions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_suggestions" ADD CONSTRAINT "question_suggestions_session_id_pdif_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."pdif_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_transcripts" ADD CONSTRAINT "session_transcripts_session_id_pdif_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."pdif_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flatbed_user_roles" ADD CONSTRAINT "flatbed_user_roles_user_id_flatbed_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."flatbed_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment_tractors" ADD CONSTRAINT "equipment_tractors_created_by_flatbed_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."flatbed_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment_trailers" ADD CONSTRAINT "equipment_trailers_created_by_flatbed_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."flatbed_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "load_plans" ADD CONSTRAINT "load_plans_created_by_flatbed_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."flatbed_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "load_plans" ADD CONSTRAINT "load_plans_trailer_id_equipment_trailers_id_fk" FOREIGN KEY ("trailer_id") REFERENCES "public"."equipment_trailers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "load_plans" ADD CONSTRAINT "load_plans_tractor_id_equipment_tractors_id_fk" FOREIGN KEY ("tractor_id") REFERENCES "public"."equipment_tractors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "load_plans" ADD CONSTRAINT "load_plans_multi_load_set_id_multi_load_sets_id_fk" FOREIGN KEY ("multi_load_set_id") REFERENCES "public"."multi_load_sets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "multi_load_sets" ADD CONSTRAINT "multi_load_sets_created_by_flatbed_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."flatbed_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_versions" ADD CONSTRAINT "plan_versions_plan_id_load_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."load_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_versions" ADD CONSTRAINT "plan_versions_created_by_flatbed_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."flatbed_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_versions" ADD CONSTRAINT "plan_versions_approved_by_flatbed_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."flatbed_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_items" ADD CONSTRAINT "plan_items_plan_id_load_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."load_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_warnings" ADD CONSTRAINT "plan_warnings_plan_id_load_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."load_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "securement_assignments" ADD CONSTRAINT "securement_assignments_plan_id_load_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."load_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "securement_assignments" ADD CONSTRAINT "securement_assignments_plan_item_id_plan_items_id_fk" FOREIGN KEY ("plan_item_id") REFERENCES "public"."plan_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_checklists" ADD CONSTRAINT "verification_checklists_plan_version_id_plan_versions_id_fk" FOREIGN KEY ("plan_version_id") REFERENCES "public"."plan_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_checklists" ADD CONSTRAINT "verification_checklists_driver_id_flatbed_users_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."flatbed_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flatbed_rules" ADD CONSTRAINT "flatbed_rules_created_by_flatbed_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."flatbed_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rule_audit_log" ADD CONSTRAINT "rule_audit_log_rule_id_flatbed_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."flatbed_rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rule_audit_log" ADD CONSTRAINT "rule_audit_log_changed_by_flatbed_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."flatbed_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accounts_organization_id_idx" ON "accounts" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "sessions_account_id_idx" ON "sessions" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "sessions_rep_id_idx" ON "sessions" USING btree ("rep_id");--> statement-breakpoint
CREATE INDEX "sessions_status_idx" ON "sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "contacts_account_id_idx" ON "contacts" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "contacts_email_idx" ON "contacts" USING btree ("email");--> statement-breakpoint
CREATE INDEX "preferred_questions_rep_id_idx" ON "preferred_questions" USING btree ("rep_id");--> statement-breakpoint
CREATE INDEX "questions_framework_idx" ON "questions" USING btree ("framework");--> statement-breakpoint
CREATE INDEX "questions_canonical_field_idx" ON "questions" USING btree ("canonical_field");--> statement-breakpoint
CREATE INDEX "questions_is_active_idx" ON "questions" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "source_documents_rights_profile_id_idx" ON "source_documents" USING btree ("rights_profile_id");--> statement-breakpoint
CREATE INDEX "source_documents_ingestion_status_idx" ON "source_documents" USING btree ("ingestion_status");--> statement-breakpoint
CREATE INDEX "chunks_source_document_id_idx" ON "chunks" USING btree ("source_document_id");--> statement-breakpoint
CREATE INDEX "chunks_source_doc_chunk_idx" ON "chunks" USING btree ("source_document_id","chunk_index");--> statement-breakpoint
CREATE INDEX "evaluation_records_session_id_idx" ON "evaluation_records" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "evaluation_records_evaluated_at_idx" ON "evaluation_records" USING btree ("evaluated_at");--> statement-breakpoint
CREATE INDEX "experiments_status_idx" ON "experiments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "rep_performance_metrics_rep_id_idx" ON "rep_performance_metrics" USING btree ("rep_id");--> statement-breakpoint
CREATE INDEX "rep_performance_metrics_period_idx" ON "rep_performance_metrics" USING btree ("period_start","period_end");--> statement-breakpoint
CREATE INDEX "pre_call_plans_account_id_idx" ON "pre_call_plans" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "pre_call_plans_rep_id_idx" ON "pre_call_plans" USING btree ("rep_id");--> statement-breakpoint
CREATE INDEX "summaries_session_id_idx" ON "summaries" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "crosswalk_mappings_framework_idx" ON "crosswalk_mappings" USING btree ("framework");--> statement-breakpoint
CREATE INDEX "crosswalk_mappings_canonical_field_idx" ON "crosswalk_mappings" USING btree ("canonical_field");--> statement-breakpoint
CREATE INDEX "framework_weighting_profiles_deal_stage_idx" ON "framework_weighting_profiles" USING btree ("deal_stage");--> statement-breakpoint
CREATE INDEX "objection_events_session_id_idx" ON "objection_events" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "objection_events_type_idx" ON "objection_events" USING btree ("objection_type");--> statement-breakpoint
CREATE INDEX "export_events_session_id_idx" ON "export_events" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "export_events_platform_idx" ON "export_events" USING btree ("platform");--> statement-breakpoint
CREATE INDEX "export_events_status_idx" ON "export_events" USING btree ("status");--> statement-breakpoint
CREATE INDEX "coverage_snapshots_session_id_idx" ON "coverage_snapshots" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "coverage_snapshots_field_type_idx" ON "coverage_snapshots" USING btree ("field_type");--> statement-breakpoint
CREATE INDEX "coverage_snapshots_field_name_idx" ON "coverage_snapshots" USING btree ("field_name");--> statement-breakpoint
CREATE INDEX "question_events_session_id_idx" ON "question_events" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "question_events_question_id_idx" ON "question_events" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "question_events_framework_idx" ON "question_events" USING btree ("framework");--> statement-breakpoint
CREATE INDEX "pdif_sessions_account_id_idx" ON "pdif_sessions" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "pdif_sessions_rep_id_idx" ON "pdif_sessions" USING btree ("rep_id");--> statement-breakpoint
CREATE INDEX "pdif_sessions_status_idx" ON "pdif_sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "graph_edges_account_id_idx" ON "discovery_graph_edges" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "graph_edges_source_idx" ON "discovery_graph_edges" USING btree ("source_node_id");--> statement-breakpoint
CREATE INDEX "graph_edges_target_idx" ON "discovery_graph_edges" USING btree ("target_node_id");--> statement-breakpoint
CREATE INDEX "graph_edges_type_idx" ON "discovery_graph_edges" USING btree ("edge_type");--> statement-breakpoint
CREATE INDEX "graph_nodes_account_id_idx" ON "discovery_graph_nodes" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "graph_nodes_session_id_idx" ON "discovery_graph_nodes" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "graph_nodes_node_type_idx" ON "discovery_graph_nodes" USING btree ("node_type");--> statement-breakpoint
CREATE INDEX "graph_nodes_valid_idx" ON "discovery_graph_nodes" USING btree ("valid_until");--> statement-breakpoint
CREATE INDEX "confidence_scores_account_id_idx" ON "confidence_scores" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "confidence_scores_session_id_idx" ON "confidence_scores" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "confidence_scores_category_idx" ON "confidence_scores" USING btree ("category");--> statement-breakpoint
CREATE INDEX "suggestions_account_id_idx" ON "question_suggestions" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "suggestions_session_id_idx" ON "question_suggestions" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "suggestions_phase_idx" ON "question_suggestions" USING btree ("pdif_phase");--> statement-breakpoint
CREATE INDEX "suggestions_asked_idx" ON "question_suggestions" USING btree ("was_asked");--> statement-breakpoint
CREATE INDEX "transcripts_session_id_idx" ON "session_transcripts" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "transcripts_speaker_idx" ON "session_transcripts" USING btree ("speaker");--> statement-breakpoint
CREATE INDEX "transcripts_processed_idx" ON "session_transcripts" USING btree ("processed");--> statement-breakpoint
CREATE INDEX "flatbed_user_roles_user_id_idx" ON "flatbed_user_roles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "flatbed_user_roles_unique_idx" ON "flatbed_user_roles" USING btree ("user_id","role");--> statement-breakpoint
CREATE INDEX "flatbed_users_email_idx" ON "flatbed_users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "equipment_tractors_created_by_idx" ON "equipment_tractors" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "equipment_trailers_template_idx" ON "equipment_trailers" USING btree ("is_template");--> statement-breakpoint
CREATE INDEX "equipment_trailers_created_by_idx" ON "equipment_trailers" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "load_plans_created_by_idx" ON "load_plans" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "load_plans_status_idx" ON "load_plans" USING btree ("status");--> statement-breakpoint
CREATE INDEX "load_plans_multi_load_set_idx" ON "load_plans" USING btree ("multi_load_set_id");--> statement-breakpoint
CREATE INDEX "multi_load_sets_created_by_idx" ON "multi_load_sets" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "plan_versions_plan_id_idx" ON "plan_versions" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "plan_versions_version_number_idx" ON "plan_versions" USING btree ("plan_id","version_number");--> statement-breakpoint
CREATE INDEX "plan_items_plan_id_idx" ON "plan_items" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "plan_items_order_number_idx" ON "plan_items" USING btree ("order_number");--> statement-breakpoint
CREATE INDEX "plan_items_delivery_stop_idx" ON "plan_items" USING btree ("plan_id","delivery_stop");--> statement-breakpoint
CREATE INDEX "plan_warnings_plan_id_idx" ON "plan_warnings" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "plan_warnings_severity_idx" ON "plan_warnings" USING btree ("plan_id","severity");--> statement-breakpoint
CREATE INDEX "securement_assignments_plan_id_idx" ON "securement_assignments" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "securement_assignments_item_id_idx" ON "securement_assignments" USING btree ("plan_item_id");--> statement-breakpoint
CREATE INDEX "verification_checklists_plan_version_idx" ON "verification_checklists" USING btree ("plan_version_id");--> statement-breakpoint
CREATE INDEX "verification_checklists_driver_idx" ON "verification_checklists" USING btree ("driver_id");--> statement-breakpoint
CREATE INDEX "flatbed_rules_type_idx" ON "flatbed_rules" USING btree ("type");--> statement-breakpoint
CREATE INDEX "flatbed_rules_active_idx" ON "flatbed_rules" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "rule_audit_log_rule_id_idx" ON "rule_audit_log" USING btree ("rule_id");--> statement-breakpoint
CREATE INDEX "rule_audit_log_changed_by_idx" ON "rule_audit_log" USING btree ("changed_by");--> statement-breakpoint
CREATE INDEX "rule_audit_log_changed_at_idx" ON "rule_audit_log" USING btree ("changed_at");