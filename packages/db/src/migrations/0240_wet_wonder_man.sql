CREATE TABLE "erp_journal_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"entry_number" integer NOT NULL,
	"entry_date" timestamp with time zone NOT NULL,
	"description" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"source_type" text,
	"source_id" text,
	"posted_at" timestamp with time zone,
	"reversed_at" timestamp with time zone,
	"reverse_reason" text,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "erp_journal_entry_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"journal_entry_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"debit_cents" integer DEFAULT 0 NOT NULL,
	"credit_cents" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "erp_journal_entry_lines_single_side_check" CHECK (("erp_journal_entry_lines"."debit_cents" > 0 and "erp_journal_entry_lines"."credit_cents" = 0) or ("erp_journal_entry_lines"."credit_cents" > 0 and "erp_journal_entry_lines"."debit_cents" = 0))
);
--> statement-breakpoint
ALTER TABLE "erp_journal_entries" ADD CONSTRAINT "erp_journal_entries_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp_journal_entry_lines" ADD CONSTRAINT "erp_journal_entry_lines_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp_journal_entry_lines" ADD CONSTRAINT "erp_journal_entry_lines_journal_entry_id_erp_journal_entries_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."erp_journal_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp_journal_entry_lines" ADD CONSTRAINT "erp_journal_entry_lines_account_id_erp_chart_of_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."erp_chart_of_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "erp_journal_entries_company_number_uq" ON "erp_journal_entries" USING btree ("company_id","entry_number");--> statement-breakpoint
CREATE INDEX "erp_journal_entries_company_status_idx" ON "erp_journal_entries" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "erp_journal_entries_company_date_idx" ON "erp_journal_entries" USING btree ("company_id","entry_date");--> statement-breakpoint
CREATE INDEX "erp_journal_entry_lines_company_entry_idx" ON "erp_journal_entry_lines" USING btree ("company_id","journal_entry_id");--> statement-breakpoint
CREATE UNIQUE INDEX "erp_journal_entry_lines_entry_position_uq" ON "erp_journal_entry_lines" USING btree ("journal_entry_id","position");