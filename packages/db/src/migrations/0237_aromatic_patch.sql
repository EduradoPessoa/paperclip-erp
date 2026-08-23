CREATE TABLE "erp_import_order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"import_order_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"quantity" numeric(14, 4) NOT NULL,
	"invoice_value_cents" integer DEFAULT 0 NOT NULL,
	"allocated_cost_cents" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "erp_import_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"code" text NOT NULL,
	"supplier_id" uuid NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"document_number" text,
	"document_date" timestamp with time zone,
	"arrival_date" timestamp with time zone,
	"freight_cost_cents" integer DEFAULT 0 NOT NULL,
	"insurance_cost_cents" integer DEFAULT 0 NOT NULL,
	"exchange_rate_bps" integer,
	"total_cost_cents" integer,
	"notes" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "erp_import_order_items" ADD CONSTRAINT "erp_import_order_items_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp_import_order_items" ADD CONSTRAINT "erp_import_order_items_import_order_id_erp_import_orders_id_fk" FOREIGN KEY ("import_order_id") REFERENCES "public"."erp_import_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp_import_order_items" ADD CONSTRAINT "erp_import_order_items_product_id_erp_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."erp_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp_import_orders" ADD CONSTRAINT "erp_import_orders_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp_import_orders" ADD CONSTRAINT "erp_import_orders_supplier_id_erp_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."erp_suppliers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "erp_import_order_items_company_order_idx" ON "erp_import_order_items" USING btree ("company_id","import_order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "erp_import_order_items_order_position_uq" ON "erp_import_order_items" USING btree ("import_order_id","position");--> statement-breakpoint
CREATE INDEX "erp_import_order_items_product_idx" ON "erp_import_order_items" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "erp_import_orders_company_code_uq" ON "erp_import_orders" USING btree ("company_id","code");--> statement-breakpoint
CREATE INDEX "erp_import_orders_company_status_idx" ON "erp_import_orders" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "erp_import_orders_supplier_idx" ON "erp_import_orders" USING btree ("supplier_id");