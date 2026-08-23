CREATE TABLE "erp_payables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"supplier_id" uuid,
	"fiscal_document_id" uuid,
	"company_id" uuid NOT NULL,
	"description" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency" text DEFAULT 'BRL' NOT NULL,
	"due_date" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"paid_at" timestamp with time zone,
	"paid_amount_cents" integer,
	"payment_method" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "erp_receivables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid,
	"fiscal_document_id" uuid,
	"company_id" uuid NOT NULL,
	"description" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency" text DEFAULT 'BRL' NOT NULL,
	"due_date" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"paid_at" timestamp with time zone,
	"paid_amount_cents" integer,
	"payment_method" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "erp_payables" ADD CONSTRAINT "erp_payables_supplier_id_erp_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."erp_suppliers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp_payables" ADD CONSTRAINT "erp_payables_fiscal_document_id_fiscal_documents_id_fk" FOREIGN KEY ("fiscal_document_id") REFERENCES "public"."fiscal_documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp_payables" ADD CONSTRAINT "erp_payables_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp_receivables" ADD CONSTRAINT "erp_receivables_customer_id_erp_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."erp_customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp_receivables" ADD CONSTRAINT "erp_receivables_fiscal_document_id_fiscal_documents_id_fk" FOREIGN KEY ("fiscal_document_id") REFERENCES "public"."fiscal_documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp_receivables" ADD CONSTRAINT "erp_receivables_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "erp_payables_company_status_idx" ON "erp_payables" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "erp_payables_company_due_idx" ON "erp_payables" USING btree ("company_id","due_date");--> statement-breakpoint
CREATE INDEX "erp_payables_supplier_idx" ON "erp_payables" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "erp_receivables_company_status_idx" ON "erp_receivables" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "erp_receivables_company_due_idx" ON "erp_receivables" USING btree ("company_id","due_date");--> statement-breakpoint
CREATE INDEX "erp_receivables_customer_idx" ON "erp_receivables" USING btree ("customer_id");