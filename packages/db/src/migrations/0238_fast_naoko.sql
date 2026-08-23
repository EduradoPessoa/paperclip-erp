CREATE TABLE "erp_export_order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"export_order_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"quantity" numeric(14, 4) NOT NULL,
	"unit_price_cents" integer NOT NULL,
	"total_cents" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "erp_export_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"code" text NOT NULL,
	"customer_id" uuid NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"document_number" text,
	"document_date" timestamp with time zone,
	"incoterm" text,
	"currency" text DEFAULT 'USD' NOT NULL,
	"exchange_rate_bps" integer,
	"total_value_cents" integer,
	"shipped_at" timestamp with time zone,
	"notes" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "erp_export_order_items" ADD CONSTRAINT "erp_export_order_items_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp_export_order_items" ADD CONSTRAINT "erp_export_order_items_export_order_id_erp_export_orders_id_fk" FOREIGN KEY ("export_order_id") REFERENCES "public"."erp_export_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp_export_order_items" ADD CONSTRAINT "erp_export_order_items_product_id_erp_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."erp_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp_export_orders" ADD CONSTRAINT "erp_export_orders_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp_export_orders" ADD CONSTRAINT "erp_export_orders_customer_id_erp_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."erp_customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "erp_export_order_items_company_order_idx" ON "erp_export_order_items" USING btree ("company_id","export_order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "erp_export_order_items_order_position_uq" ON "erp_export_order_items" USING btree ("export_order_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "erp_export_orders_company_code_uq" ON "erp_export_orders" USING btree ("company_id","code");--> statement-breakpoint
CREATE INDEX "erp_export_orders_company_status_idx" ON "erp_export_orders" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "erp_export_orders_customer_idx" ON "erp_export_orders" USING btree ("customer_id");