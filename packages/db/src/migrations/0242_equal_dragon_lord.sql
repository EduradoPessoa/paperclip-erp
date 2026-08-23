CREATE TABLE "erp_cost_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"cost_center_id" uuid NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"description" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"source_type" text,
	"source_id" text,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "erp_cost_centers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "erp_cost_allocations" ADD CONSTRAINT "erp_cost_allocations_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp_cost_allocations" ADD CONSTRAINT "erp_cost_allocations_cost_center_id_erp_cost_centers_id_fk" FOREIGN KEY ("cost_center_id") REFERENCES "public"."erp_cost_centers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp_cost_centers" ADD CONSTRAINT "erp_cost_centers_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "erp_cost_allocations_company_period_idx" ON "erp_cost_allocations" USING btree ("company_id","period_start");--> statement-breakpoint
CREATE INDEX "erp_cost_allocations_center_idx" ON "erp_cost_allocations" USING btree ("cost_center_id");--> statement-breakpoint
CREATE INDEX "erp_cost_allocations_source_idx" ON "erp_cost_allocations" USING btree ("source_type","source_id");--> statement-breakpoint
CREATE UNIQUE INDEX "erp_cost_centers_company_code_uq" ON "erp_cost_centers" USING btree ("company_id","code");--> statement-breakpoint
CREATE INDEX "erp_cost_centers_company_idx" ON "erp_cost_centers" USING btree ("company_id");