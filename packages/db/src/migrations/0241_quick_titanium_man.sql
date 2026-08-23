CREATE TABLE "erp_depreciation_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"depreciation_cents" integer NOT NULL,
	"book_value_after_cents" integer NOT NULL,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "erp_fixed_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"category" text,
	"acquisition_date" timestamp with time zone NOT NULL,
	"acquisition_cost_cents" integer NOT NULL,
	"useful_life_months" integer NOT NULL,
	"salvage_value_cents" integer DEFAULT 0 NOT NULL,
	"depreciation_method" text DEFAULT 'linear' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"accumulated_depreciation_cents" integer DEFAULT 0 NOT NULL,
	"book_value_cents" integer NOT NULL,
	"disposed_at" timestamp with time zone,
	"disposal_value_cents" integer,
	"notes" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "erp_depreciation_runs" ADD CONSTRAINT "erp_depreciation_runs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp_depreciation_runs" ADD CONSTRAINT "erp_depreciation_runs_asset_id_erp_fixed_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."erp_fixed_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp_fixed_assets" ADD CONSTRAINT "erp_fixed_assets_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "erp_depreciation_runs_company_asset_period_idx" ON "erp_depreciation_runs" USING btree ("company_id","asset_id","period_end");--> statement-breakpoint
CREATE INDEX "erp_depreciation_runs_asset_idx" ON "erp_depreciation_runs" USING btree ("asset_id");--> statement-breakpoint
CREATE UNIQUE INDEX "erp_fixed_assets_company_code_uq" ON "erp_fixed_assets" USING btree ("company_id","code");--> statement-breakpoint
CREATE INDEX "erp_fixed_assets_company_status_idx" ON "erp_fixed_assets" USING btree ("company_id","status");