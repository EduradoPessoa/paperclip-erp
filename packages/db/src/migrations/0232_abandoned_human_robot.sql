CREATE TABLE "erp_inventory_lots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"lot_code" text NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expiry_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "erp_inventory_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"lot_id" uuid,
	"movement_type" text NOT NULL,
	"delta_quantity" numeric(14, 4) NOT NULL,
	"unit_cost_cents" integer,
	"reference_type" text,
	"reference_id" text,
	"note" text,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "erp_inventory_lots" ADD CONSTRAINT "erp_inventory_lots_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp_inventory_lots" ADD CONSTRAINT "erp_inventory_lots_product_id_erp_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."erp_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp_inventory_movements" ADD CONSTRAINT "erp_inventory_movements_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp_inventory_movements" ADD CONSTRAINT "erp_inventory_movements_product_id_erp_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."erp_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp_inventory_movements" ADD CONSTRAINT "erp_inventory_movements_lot_id_erp_inventory_lots_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."erp_inventory_lots"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "erp_inventory_lots_company_product_lot_uq" ON "erp_inventory_lots" USING btree ("company_id","product_id","lot_code");--> statement-breakpoint
CREATE INDEX "erp_inventory_lots_company_product_idx" ON "erp_inventory_lots" USING btree ("company_id","product_id");--> statement-breakpoint
CREATE INDEX "erp_inventory_movements_company_created_idx" ON "erp_inventory_movements" USING btree ("company_id","created_at");--> statement-breakpoint
CREATE INDEX "erp_inventory_movements_company_product_idx" ON "erp_inventory_movements" USING btree ("company_id","product_id");--> statement-breakpoint
CREATE INDEX "erp_inventory_movements_lot_idx" ON "erp_inventory_movements" USING btree ("lot_id");--> statement-breakpoint
CREATE INDEX "erp_inventory_movements_reference_idx" ON "erp_inventory_movements" USING btree ("reference_type","reference_id");