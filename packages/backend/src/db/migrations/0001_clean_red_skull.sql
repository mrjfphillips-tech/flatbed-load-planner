CREATE TYPE "public"."ld_plan_status" AS ENUM('draft', 'computed', 'reviewed', 'finalized');--> statement-breakpoint
CREATE TYPE "public"."ld_unit_system" AS ENUM('metric', 'imperial');--> statement-breakpoint
CREATE TABLE "ld_load_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"load_plan_id" uuid NOT NULL,
	"item_id" varchar(255) NOT NULL,
	"description" text,
	"length_mm" integer NOT NULL,
	"width_mm" integer NOT NULL,
	"height_mm" integer NOT NULL,
	"weight_kg" real NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"stackability_class" varchar(128),
	"max_stack_weight_kg" real,
	"delivery_stop" integer,
	"temperature_zone" varchar(128),
	"floor_only" boolean DEFAULT false NOT NULL,
	"top_load_prohibited" boolean DEFAULT false NOT NULL,
	"placed_x_mm" integer,
	"placed_y_mm" integer,
	"placed_z_mm" integer,
	"placed_orientation" varchar(8),
	"load_sequence" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ld_load_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trailer_profile_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"status" "ld_plan_status" DEFAULT 'draft' NOT NULL,
	"source_unit_system" "ld_unit_system" DEFAULT 'metric' NOT NULL,
	"display_unit_system" "ld_unit_system" DEFAULT 'metric' NOT NULL,
	"total_weight_kg" real,
	"volume_utilization_percent" real,
	"axle_weights" json,
	"item_count" integer,
	"computed_at" timestamp with time zone,
	"finalized_at" timestamp with time zone,
	"optiflow_route_id" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ld_plan_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"load_plan_id" uuid NOT NULL,
	"action" varchar(64) NOT NULL,
	"previous_state" json,
	"new_state" json,
	"adjusted_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trailer_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"internal_length_mm" integer NOT NULL,
	"internal_width_mm" integer NOT NULL,
	"internal_height_mm" integer NOT NULL,
	"max_payload_weight_kg" real NOT NULL,
	"axle_count" integer NOT NULL,
	"axle_weight_limits" json NOT NULL,
	"display_unit_system" "ld_unit_system" DEFAULT 'metric' NOT NULL,
	"door_config" json,
	"is_template" boolean DEFAULT false NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ld_load_items" ADD CONSTRAINT "ld_load_items_load_plan_id_ld_load_plans_id_fk" FOREIGN KEY ("load_plan_id") REFERENCES "public"."ld_load_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ld_load_plans" ADD CONSTRAINT "ld_load_plans_trailer_profile_id_trailer_profiles_id_fk" FOREIGN KEY ("trailer_profile_id") REFERENCES "public"."trailer_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ld_plan_history" ADD CONSTRAINT "ld_plan_history_load_plan_id_ld_load_plans_id_fk" FOREIGN KEY ("load_plan_id") REFERENCES "public"."ld_load_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ld_load_items_plan_idx" ON "ld_load_items" USING btree ("load_plan_id");--> statement-breakpoint
CREATE INDEX "ld_load_plans_trailer_idx" ON "ld_load_plans" USING btree ("trailer_profile_id");--> statement-breakpoint
CREATE INDEX "ld_load_plans_status_idx" ON "ld_load_plans" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ld_plan_history_plan_idx" ON "ld_plan_history" USING btree ("load_plan_id");--> statement-breakpoint
CREATE INDEX "trailer_profiles_template_idx" ON "trailer_profiles" USING btree ("is_template");