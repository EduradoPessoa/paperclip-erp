CREATE TABLE "erp_wms_cycle_counts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"location_id" uuid,
	"product_id" uuid NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"counted_quantity" numeric(14, 4) NOT NULL,
	"system_quantity" numeric(14, 4),
	"difference" numeric(14, 4),
	"notes" text,
	"counted_at" timestamp with time zone,
	"approved_at" timestamp with time zone,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "erp_wms_locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"code" text NOT NULL,
	"zone" text,
	"aisle" text,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "erp_wms_pick_waves" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"code" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"item_count" integer DEFAULT 0 NOT NULL,
	"created_by_user_id" text,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "erp_wms_cycle_counts" ADD CONSTRAINT "erp_wms_cycle_counts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp_wms_cycle_counts" ADD CONSTRAINT "erp_wms_cycle_counts_location_id_erp_wms_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."erp_wms_locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp_wms_cycle_counts" ADD CONSTRAINT "erp_wms_cycle_counts_product_id_erp_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."erp_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp_wms_locations" ADD CONSTRAINT "erp_wms_locations_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp_wms_pick_waves" ADD CONSTRAINT "erp_wms_pick_waves_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "erp_wms_cycle_counts_company_status_idx" ON "erp_wms_cycle_counts" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "erp_wms_cycle_counts_location_idx" ON "erp_wms_cycle_counts" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "erp_wms_cycle_counts_product_idx" ON "erp_wms_cycle_counts" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "erp_wms_locations_company_code_uq" ON "erp_wms_locations" USING btree ("company_id","code");--> statement-breakpoint
CREATE INDEX "erp_wms_locations_company_idx" ON "erp_wms_locations" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "erp_wms_pick_waves_company_code_uq" ON "erp_wms_pick_waves" USING btree ("company_id","code");--> statement-breakpoint
CREATE INDEX "erp_wms_pick_waves_company_status_idx" ON "erp_wms_pick_waves" USING btree ("company_id","status");