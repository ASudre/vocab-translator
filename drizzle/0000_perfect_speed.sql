CREATE TABLE "attempts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"vocabulary_id" integer NOT NULL,
	"level" text NOT NULL,
	"is_correct" boolean NOT NULL,
	"user_answer" text,
	"answered_at" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_word_baseline" (
	"user_id" uuid NOT NULL,
	"vocabulary_id" integer NOT NULL,
	"success_count" integer NOT NULL,
	"fail_count" integer NOT NULL,
	"current_streak" integer NOT NULL,
	"best_streak" integer NOT NULL,
	"attempt_history" boolean[] NOT NULL,
	"mastery_level" integer NOT NULL,
	"last_practiced" timestamp with time zone NOT NULL,
	CONSTRAINT "user_word_baseline_user_id_vocabulary_id_pk" PRIMARY KEY("user_id","vocabulary_id")
);
--> statement-breakpoint
CREATE TABLE "user_word_progress" (
	"user_id" uuid NOT NULL,
	"vocabulary_id" integer NOT NULL,
	"success_count" integer NOT NULL,
	"fail_count" integer NOT NULL,
	"current_streak" integer NOT NULL,
	"best_streak" integer NOT NULL,
	"attempt_history" boolean[] NOT NULL,
	"mastery_level" integer NOT NULL,
	"last_practiced" timestamp with time zone NOT NULL,
	CONSTRAINT "user_word_progress_user_id_vocabulary_id_pk" PRIMARY KEY("user_id","vocabulary_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"display_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_word_baseline" ADD CONSTRAINT "user_word_baseline_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_word_progress" ADD CONSTRAINT "user_word_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attempts_user_answered_idx" ON "attempts" USING btree ("user_id","answered_at");--> statement-breakpoint
CREATE INDEX "attempts_user_vocabulary_idx" ON "attempts" USING btree ("user_id","vocabulary_id");