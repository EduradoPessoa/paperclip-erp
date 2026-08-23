CREATE TABLE "erp_chart_of_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"account_type" text NOT NULL,
	"parent_id" uuid,
	"status" text DEFAULT 'active' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "erp_customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"tax_id" text NOT NULL,
	"email" text,
	"phone" text,
	"address" text,
	"city" text,
	"state" text,
	"status" text DEFAULT 'active' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "erp_products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"ncm" text,
	"cest" text,
	"unit" text DEFAULT 'UN' NOT NULL,
	"price_cents" integer,
	"cost_cents" integer,
	"status" text DEFAULT 'active' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "erp_suppliers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"tax_id" text NOT NULL,
	"email" text,
	"phone" text,
	"address" text,
	"city" text,
	"state" text,
	"status" text DEFAULT 'active' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "erp_chart_of_accounts" ADD CONSTRAINT "erp_chart_of_accounts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp_chart_of_accounts" ADD CONSTRAINT "erp_chart_of_accounts_parent_id_erp_chart_of_accounts_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."erp_chart_of_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp_customers" ADD CONSTRAINT "erp_customers_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp_products" ADD CONSTRAINT "erp_products_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp_suppliers" ADD CONSTRAINT "erp_suppliers_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "erp_chart_of_accounts_company_code_uq" ON "erp_chart_of_accounts" USING btree ("company_id","code");--> statement-breakpoint
CREATE INDEX "erp_chart_of_accounts_company_status_idx" ON "erp_chart_of_accounts" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "erp_chart_of_accounts_parent_idx" ON "erp_chart_of_accounts" USING btree ("parent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "erp_customers_company_code_uq" ON "erp_customers" USING btree ("company_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "erp_customers_company_tax_uq" ON "erp_customers" USING btree ("company_id","tax_id");--> statement-breakpoint
CREATE INDEX "erp_customers_company_status_idx" ON "erp_customers" USING btree ("company_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "erp_products_company_code_uq" ON "erp_products" USING btree ("company_id","code");--> statement-breakpoint
CREATE INDEX "erp_products_company_status_idx" ON "erp_products" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "erp_products_company_ncm_idx" ON "erp_products" USING btree ("company_id","ncm");--> statement-breakpoint
CREATE UNIQUE INDEX "erp_suppliers_company_code_uq" ON "erp_suppliers" USING btree ("company_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "erp_suppliers_company_tax_uq" ON "erp_suppliers" USING btree ("company_id","tax_id");--> statement-breakpoint
CREATE INDEX "erp_suppliers_company_status_idx" ON "erp_suppliers" USING btree ("company_id","status");