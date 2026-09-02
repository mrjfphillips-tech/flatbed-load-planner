CREATE TABLE "fleet_vehicles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fleet_id" uuid NOT NULL,
	"vehicle_id" varchar(255) NOT NULL,
	"vehicle_name" varchar(255) NOT NULL,
	"vehicle_account" varchar(255),
	"license_plate" varchar(64),
	"max_weight_kg" real NOT NULL,
	"platform_length_mm" real NOT NULL,
	"platform_width_mm" real NOT NULL,
	"platform_height_mm" real,
	"cost_per_stop" real,
	"fixed_cost" real,
	"cost_per_hour" real,
	"cost_per_km" real,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fleets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"display_unit_system" "ld_unit_system" DEFAULT 'metric' NOT NULL,
	"created_by" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ld_load_plans" ADD COLUMN "fleet_vehicle_id" uuid;--> statement-breakpoint
ALTER TABLE "fleet_vehicles" ADD CONSTRAINT "fleet_vehicles_fleet_id_fleets_id_fk" FOREIGN KEY ("fleet_id") REFERENCES "public"."fleets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "fleet_vehicles_fleet_idx" ON "fleet_vehicles" USING btree ("fleet_id");--> statement-breakpoint
CREATE INDEX "fleets_name_idx" ON "fleets" USING btree ("name");