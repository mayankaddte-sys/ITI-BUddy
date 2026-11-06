CREATE TABLE "chat_logs" (
	"id" serial PRIMARY KEY,
	"question" varchar(500) NOT NULL,
	"lang" varchar(2) DEFAULT 'en' NOT NULL,
	"answered" boolean DEFAULT false NOT NULL,
	"matched" varchar(200) DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "passages" (
	"id" serial PRIMARY KEY,
	"category" varchar(40) DEFAULT 'Other' NOT NULL,
	"title" varchar(200) NOT NULL,
	"title_hi" varchar(200) DEFAULT '' NOT NULL,
	"text" text NOT NULL,
	"text_hi" text DEFAULT '' NOT NULL,
	"source" varchar(250) DEFAULT '' NOT NULL,
	"seed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
