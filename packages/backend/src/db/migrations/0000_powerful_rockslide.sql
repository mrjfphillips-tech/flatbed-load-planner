CREATE TYPE "public"."flatbed_user_role" AS ENUM('Planner', 'Loader', 'Driver', 'Supervisor', 'Administrator', 'Customer_Viewer');--> statement-breakpoint
CREATE TYPE "public"."deck_material" AS ENUM('steel', 'aluminum', 'wood');--> statement-breakpoint
CREATE TYPE "public"."load_pattern" AS ENUM('layered', 'column_building', 'row_building', 'long_product', 'nested', 'customer_zoning', 'mixed');--> statement-breakpoint
CREATE TYPE "public"."plan_status" AS ENUM('draft', 'pending_approval', 'approved', 'rejected', 'superseded');--> statement-breakpoint
CREATE TYPE "public"."securement_type" AS ENUM('chain', 'strap', 'chain_with_binder');--> statement-breakpoint
CREATE TYPE "public"."warning_severity" AS ENUM('error', 'warning', 'info');--> statement-breakpoint
CREATE TYPE "public"."rule_type" AS ENUM('hard_constraint', 'soft_preference', 'advisory');--> statement-breakpoint
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
CREATE TABLE "loading_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"total_steps" integer NOT NULL,
	"completed_steps" integer DEFAULT 0 NOT NULL,
	"steps" json,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
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
ALTER TABLE "loading_progress" ADD CONSTRAINT "loading_progress_plan_id_load_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."load_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_checklists" ADD CONSTRAINT "verification_checklists_plan_version_id_plan_versions_id_fk" FOREIGN KEY ("plan_version_id") REFERENCES "public"."plan_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_checklists" ADD CONSTRAINT "verification_checklists_driver_id_flatbed_users_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."flatbed_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flatbed_rules" ADD CONSTRAINT "flatbed_rules_created_by_flatbed_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."flatbed_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rule_audit_log" ADD CONSTRAINT "rule_audit_log_rule_id_flatbed_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."flatbed_rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rule_audit_log" ADD CONSTRAINT "rule_audit_log_changed_by_flatbed_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."flatbed_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
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
CREATE INDEX "loading_progress_plan_id_idx" ON "loading_progress" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "verification_checklists_plan_version_idx" ON "verification_checklists" USING btree ("plan_version_id");--> statement-breakpoint
CREATE INDEX "verification_checklists_driver_idx" ON "verification_checklists" USING btree ("driver_id");--> statement-breakpoint
CREATE INDEX "flatbed_rules_type_idx" ON "flatbed_rules" USING btree ("type");--> statement-breakpoint
CREATE INDEX "flatbed_rules_active_idx" ON "flatbed_rules" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "rule_audit_log_rule_id_idx" ON "rule_audit_log" USING btree ("rule_id");--> statement-breakpoint
CREATE INDEX "rule_audit_log_changed_by_idx" ON "rule_audit_log" USING btree ("changed_by");--> statement-breakpoint
CREATE INDEX "rule_audit_log_changed_at_idx" ON "rule_audit_log" USING btree ("changed_at");