CREATE TABLE "erp_freight_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"code" text NOT NULL,
	"carrier_name" text NOT NULL,
	"carrier_tax_id" text,
	"origin_city" text,
	"origin_state" text,
	"destination_city" text,
	"destination_state" text,
	"status" text DEFAULT 'planned' NOT NULL,
	"pickup_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"freight_cost_cents" integer,
	"fiscal_document_id" uuid,
	"notes" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "erp_freight_tracking_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"freight_order_id" uuid NOT NULL,
	"status" text NOT NULL,
	"location" text,
	"note" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "erp_freight_orders" ADD CONSTRAINT "erp_freight_orders_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp_freight_orders" ADD CONSTRAINT "erp_freight_orders_fiscal_document_id_fiscal_documents_id_fk" FOREIGN KEY ("fiscal_document_id") REFERENCES "public"."fiscal_documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp_freight_tracking_events" ADD CONSTRAINT "erp_freight_tracking_events_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp_freight_tracking_events" ADD CONSTRAINT "erp_freight_tracking_events_freight_order_id_erp_freight_orders_id_fk" FOREIGN KEY ("freight_order_id") REFERENCES "public"."erp_freight_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "erp_freight_orders_company_code_uq" ON "erp_freight_orders" USING btree ("company_id","code");--> statement-breakpoint
CREATE INDEX "erp_freight_orders_company_status_idx" ON "erp_freight_orders" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "erp_freight_orders_fiscal_idx" ON "erp_freight_orders" USING btree ("fiscal_document_id");--> statement-breakpoint
CREATE INDEX "erp_freight_tracking_events_company_order_created_idx" ON "erp_freight_tracking_events" USING btree ("company_id","freight_order_id","created_at");--> statement-breakpoint
CREATE INDEX "erp_freight_tracking_events_order_idx" ON "erp_freight_tracking_events" USING btree ("freight_order_id");