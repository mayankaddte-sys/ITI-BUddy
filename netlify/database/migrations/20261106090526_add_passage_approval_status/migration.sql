ALTER TABLE "passages" ADD COLUMN "status" varchar(10) DEFAULT 'approved' NOT NULL;--> statement-breakpoint
ALTER TABLE "passages" ADD COLUMN "created_by" varchar(200) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "passages" ADD COLUMN "approved_by" varchar(200) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "passages" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;