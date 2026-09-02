CREATE TYPE "public"."ld_trailer_type" AS ENUM('flatbed', 'curtainsider', 'enclosed');--> statement-breakpoint
ALTER TABLE "trailer_profiles" ADD COLUMN "trailer_type" "ld_trailer_type" DEFAULT 'flatbed' NOT NULL;--> statement-breakpoint
ALTER TABLE "fleet_vehicles" ADD COLUMN "trailer_type" "ld_trailer_type" DEFAULT 'flatbed' NOT NULL;