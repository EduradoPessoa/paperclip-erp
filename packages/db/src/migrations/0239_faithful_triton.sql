CREATE TABLE "erp_oms_order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"oms_order_id" uuid NOT NULL,
	"product_id" uuid,
	"position" integer DEFAULT 0 NOT NULL,
	"description" text NOT NULL,
	"quantity" numeric(14, 4) NOT NULL,
	"unit_price_cents" integer NOT NULL,
	"total_cents" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "erp_oms_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"code" text NOT NULL,
	"channel" text NOT NULL,
	"external_order_id" text,
	"customer_id" uuid,
	"sales_order_case_id" uuid,
	"status" text DEFAULT 'received' NOT NULL,
	"promise_at" timestamp with time zone,
	"placed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"shipped_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"notes" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "erp_oms_order_items" ADD CONSTRAINT "erp_oms_order_items_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp_oms_order_items" ADD CONSTRAINT "erp_oms_order_items_oms_order_id_erp_oms_orders_id_fk" FOREIGN KEY ("oms_order_id") REFERENCES "public"."erp_oms_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp_oms_order_items" ADD CONSTRAINT "erp_oms_order_items_product_id_erp_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."erp_products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp_oms_orders" ADD CONSTRAINT "erp_oms_orders_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp_oms_orders" ADD CONSTRAINT "erp_oms_orders_customer_id_erp_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."erp_customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "erp_oms_order_items_company_order_idx" ON "erp_oms_order_items" USING btree ("company_id","oms_order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "erp_oms_order_items_order_position_uq" ON "erp_oms_order_items" USING btree ("oms_order_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "erp_oms_orders_company_code_uq" ON "erp_oms_orders" USING btree ("company_id","code");--> statement-breakpoint
CREATE INDEX "erp_oms_orders_company_channel_idx" ON "erp_oms_orders" USING btree ("company_id","channel");--> statement-breakpoint
CREATE INDEX "erp_oms_orders_company_status_idx" ON "erp_oms_orders" USING btree ("company_id","status");