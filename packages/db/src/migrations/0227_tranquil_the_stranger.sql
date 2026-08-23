CREATE TABLE "fiscal_document_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"fiscal_document_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"ncm" text,
	"cest" text,
	"cfop" text,
	"description" text NOT NULL,
	"quantity" numeric(12, 4) NOT NULL,
	"unit" text NOT NULL,
	"unit_price_cents" integer NOT NULL,
	"total_cents" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fiscal_document_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"fiscal_document_id" uuid NOT NULL,
	"case_id" uuid,
	"issue_id" uuid,
	"role" text NOT NULL,
	"run_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fiscal_document_links_role_check" CHECK ("fiscal_document_links"."role" in ('origin', 'work', 'reference'))
);
--> statement-breakpoint
CREATE TABLE "fiscal_document_taxes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"fiscal_document_id" uuid NOT NULL,
	"fiscal_document_item_id" uuid,
	"tax_type" text NOT NULL,
	"base_cents" integer DEFAULT 0 NOT NULL,
	"rate_bps" integer DEFAULT 0 NOT NULL,
	"amount_cents" integer DEFAULT 0 NOT NULL,
	"creditable" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fiscal_document_taxes_tax_type_check" CHECK ("fiscal_document_taxes"."tax_type" in ('ibs', 'cbs', 'is', 'icms', 'ipi', 'pis', 'cofins'))
);
--> statement-breakpoint
CREATE TABLE "fiscal_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"case_id" uuid,
	"issue_id" uuid,
	"model" text NOT NULL,
	"operation_direction" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"access_key" text NOT NULL,
	"number" integer NOT NULL,
	"series" integer DEFAULT 1 NOT NULL,
	"environment" text DEFAULT 'homologation' NOT NULL,
	"emitter" jsonb NOT NULL,
	"receiver" jsonb,
	"emitter_tax_id" text NOT NULL,
	"receiver_tax_id" text,
	"totals_cents" integer DEFAULT 0 NOT NULL,
	"split_payment" jsonb,
	"provider_extras" jsonb,
	"provider_key" text,
	"provider_document_id" text,
	"protocol" text,
	"error_message" text,
	"xml_asset_id" uuid,
	"danfe_asset_id" uuid,
	"provider_raw" jsonb,
	"authorized_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"created_by_user_id" text,
	"created_by_agent_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fiscal_documents_status_check" CHECK ("fiscal_documents"."status" in (
        'draft', 'validated', 'transmitted', 'authorized', 'rejected', 'denied',
        'cancelled', 'invalidated', 'error'
      )),
	CONSTRAINT "fiscal_documents_model_check" CHECK ("fiscal_documents"."model" in ('nfe', 'nfce', 'nfse', 'cte', 'mdfe', 'dfe')),
	CONSTRAINT "fiscal_documents_direction_check" CHECK ("fiscal_documents"."operation_direction" in ('inbound', 'outbound'))
);
--> statement-breakpoint
CREATE TABLE "fiscal_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"fiscal_document_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"actor_type" text NOT NULL,
	"actor_user_id" text,
	"actor_agent_id" uuid,
	"run_id" uuid,
	"provider_event_kind" text,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fiscal_events_kind_check" CHECK ("fiscal_events"."kind" in (
        'created', 'validated', 'transmitted', 'authorized', 'rejected', 'denied',
        'cancelled', 'invalidated', 'cc-e', 'manifestation', 'provider_callback', 'error'
      )),
	CONSTRAINT "fiscal_events_actor_type_check" CHECK ("fiscal_events"."actor_type" in ('user', 'agent', 'system'))
);
--> statement-breakpoint
CREATE TABLE "fiscal_provider_bindings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"provider_key" text NOT NULL,
	"document_models" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_by_user_id" text,
	"created_by_agent_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fiscal_document_items" ADD CONSTRAINT "fiscal_document_items_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fiscal_document_items" ADD CONSTRAINT "fiscal_document_items_fiscal_document_id_fiscal_documents_id_fk" FOREIGN KEY ("fiscal_document_id") REFERENCES "public"."fiscal_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fiscal_document_links" ADD CONSTRAINT "fiscal_document_links_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fiscal_document_links" ADD CONSTRAINT "fiscal_document_links_fiscal_document_id_fiscal_documents_id_fk" FOREIGN KEY ("fiscal_document_id") REFERENCES "public"."fiscal_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fiscal_document_links" ADD CONSTRAINT "fiscal_document_links_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fiscal_document_links" ADD CONSTRAINT "fiscal_document_links_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fiscal_document_taxes" ADD CONSTRAINT "fiscal_document_taxes_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fiscal_document_taxes" ADD CONSTRAINT "fiscal_document_taxes_fiscal_document_id_fiscal_documents_id_fk" FOREIGN KEY ("fiscal_document_id") REFERENCES "public"."fiscal_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fiscal_document_taxes" ADD CONSTRAINT "fiscal_document_taxes_fiscal_document_item_id_fiscal_document_items_id_fk" FOREIGN KEY ("fiscal_document_item_id") REFERENCES "public"."fiscal_document_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fiscal_documents" ADD CONSTRAINT "fiscal_documents_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fiscal_documents" ADD CONSTRAINT "fiscal_documents_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fiscal_documents" ADD CONSTRAINT "fiscal_documents_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fiscal_documents" ADD CONSTRAINT "fiscal_documents_xml_asset_id_assets_id_fk" FOREIGN KEY ("xml_asset_id") REFERENCES "public"."assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fiscal_documents" ADD CONSTRAINT "fiscal_documents_danfe_asset_id_assets_id_fk" FOREIGN KEY ("danfe_asset_id") REFERENCES "public"."assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fiscal_documents" ADD CONSTRAINT "fiscal_documents_created_by_agent_id_agents_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fiscal_events" ADD CONSTRAINT "fiscal_events_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fiscal_events" ADD CONSTRAINT "fiscal_events_fiscal_document_id_fiscal_documents_id_fk" FOREIGN KEY ("fiscal_document_id") REFERENCES "public"."fiscal_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fiscal_events" ADD CONSTRAINT "fiscal_events_actor_agent_id_agents_id_fk" FOREIGN KEY ("actor_agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fiscal_provider_bindings" ADD CONSTRAINT "fiscal_provider_bindings_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fiscal_provider_bindings" ADD CONSTRAINT "fiscal_provider_bindings_created_by_agent_id_agents_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "fiscal_document_items_company_doc_idx" ON "fiscal_document_items" USING btree ("company_id","fiscal_document_id");--> statement-breakpoint
CREATE UNIQUE INDEX "fiscal_document_items_doc_position_uq" ON "fiscal_document_items" USING btree ("fiscal_document_id","position");--> statement-breakpoint
CREATE INDEX "fiscal_document_links_company_doc_idx" ON "fiscal_document_links" USING btree ("company_id","fiscal_document_id");--> statement-breakpoint
CREATE INDEX "fiscal_document_links_case_idx" ON "fiscal_document_links" USING btree ("case_id");--> statement-breakpoint
CREATE INDEX "fiscal_document_links_issue_idx" ON "fiscal_document_links" USING btree ("issue_id");--> statement-breakpoint
CREATE INDEX "fiscal_document_taxes_company_doc_idx" ON "fiscal_document_taxes" USING btree ("company_id","fiscal_document_id");--> statement-breakpoint
CREATE INDEX "fiscal_document_taxes_doc_tax_type_idx" ON "fiscal_document_taxes" USING btree ("fiscal_document_id","tax_type");--> statement-breakpoint
CREATE UNIQUE INDEX "fiscal_documents_company_access_key_uq" ON "fiscal_documents" USING btree ("company_id","access_key");--> statement-breakpoint
CREATE INDEX "fiscal_documents_company_status_idx" ON "fiscal_documents" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "fiscal_documents_company_model_created_idx" ON "fiscal_documents" USING btree ("company_id","model","created_at");--> statement-breakpoint
CREATE INDEX "fiscal_documents_company_case_idx" ON "fiscal_documents" USING btree ("company_id","case_id");--> statement-breakpoint
CREATE INDEX "fiscal_documents_company_issue_idx" ON "fiscal_documents" USING btree ("company_id","issue_id");--> statement-breakpoint
CREATE INDEX "fiscal_events_company_doc_created_idx" ON "fiscal_events" USING btree ("company_id","fiscal_document_id","created_at");--> statement-breakpoint
CREATE INDEX "fiscal_events_doc_idx" ON "fiscal_events" USING btree ("fiscal_document_id");--> statement-breakpoint
CREATE INDEX "fiscal_events_kind_idx" ON "fiscal_events" USING btree ("kind");--> statement-breakpoint
CREATE UNIQUE INDEX "fiscal_provider_bindings_company_provider_uq" ON "fiscal_provider_bindings" USING btree ("company_id","provider_key");--> statement-breakpoint
CREATE INDEX "fiscal_provider_bindings_company_idx" ON "fiscal_provider_bindings" USING btree ("company_id");