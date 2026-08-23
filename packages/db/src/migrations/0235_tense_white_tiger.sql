CREATE TABLE "erp_service_order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"service_order_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"description" text NOT NULL,
	"quantity" numeric(12, 4) NOT NULL,
	"unit_price_cents" integer NOT NULL,
	"total_cents" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "erp_service_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"code" text NOT NULL,
	"customer_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'open' NOT NULL,
	"scheduled_at" timestamp with time zone,
	"sla_due_at" timestamp with time zone,
	"sla_met" boolean,
	"completed_at" timestamp with time zone,
	"notes" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "erp_service_order_items" ADD CONSTRAINT "erp_service_order_items_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp_service_order_items" ADD CONSTRAINT "erp_service_order_items_service_order_id_erp_service_orders_id_fk" FOREIGN KEY ("service_order_id") REFERENCES "public"."erp_service_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp_service_orders" ADD CONSTRAINT "erp_service_orders_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp_service_orders" ADD CONSTRAINT "erp_service_orders_customer_id_erp_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."erp_customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "erp_service_order_items_company_order_idx" ON "erp_service_order_items" USING btree ("company_id","service_order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "erp_service_order_items_order_position_uq" ON "erp_service_order_items" USING btree ("service_order_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "erp_service_orders_company_code_uq" ON "erp_service_orders" USING btree ("company_id","code");--> statement-breakpoint
CREATE INDEX "erp_service_orders_company_status_idx" ON "erp_service_orders" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "erp_service_orders_customer_idx" ON "erp_service_orders" USING btree ("customer_id");