ALTER TABLE "discussions" ADD COLUMN "study_id" varchar;--> statement-breakpoint
ALTER TABLE "studies" ADD COLUMN "is_featured" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "prayer_permissions_granted" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "discussions" ADD CONSTRAINT "discussions_study_id_studies_id_fk" FOREIGN KEY ("study_id") REFERENCES "public"."studies"("id") ON DELETE cascade ON UPDATE no action;