CREATE TABLE "erp_production_order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"production_order_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"planned_quantity" numeric(14, 4) NOT NULL,
	"unit_cost_cents" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "erp_production_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"code" text NOT NULL,
	"product_id" uuid NOT NULL,
	"planned_quantity" numeric(14, 4) NOT NULL,
	"status" text DEFAULT 'planned' NOT NULL,
	"notes" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "erp_production_order_items" ADD CONSTRAINT "erp_production_order_items_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp_production_order_items" ADD CONSTRAINT "erp_production_order_items_production_order_id_erp_production_orders_id_fk" FOREIGN KEY ("production_order_id") REFERENCES "public"."erp_production_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp_production_order_items" ADD CONSTRAINT "erp_production_order_items_product_id_erp_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."erp_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp_production_orders" ADD CONSTRAINT "erp_production_orders_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp_production_orders" ADD CONSTRAINT "erp_production_orders_product_id_erp_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."erp_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "erp_production_order_items_company_order_idx" ON "erp_production_order_items" USING btree ("company_id","production_order_id");--> statement-breakpoint
CREATE INDEX "erp_production_order_items_product_idx" ON "erp_production_order_items" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "erp_production_orders_company_code_uq" ON "erp_production_orders" USING btree ("company_id","code");--> statement-breakpoint
CREATE INDEX "erp_production_orders_company_status_idx" ON "erp_production_orders" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "erp_production_orders_product_idx" ON "erp_production_orders" USING btree ("product_id");