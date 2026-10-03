CREATE TABLE "permission" (
	"id" serial PRIMARY KEY,
	"action" text NOT NULL UNIQUE
);
--> statement-breakpoint
CREATE TABLE "role" (
	"id" serial PRIMARY KEY,
	"role" text NOT NULL UNIQUE
);
--> statement-breakpoint
CREATE TABLE "role_permission" (
	"role_id" integer,
	"permission_id" integer,
	CONSTRAINT "role_permission_pkey" PRIMARY KEY("role_id","permission_id")
);
--> statement-breakpoint
DROP TABLE "task";--> statement-breakpoint
ALTER TABLE "user" RENAME COLUMN "role" TO "role_id";--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "role_id" SET DATA TYPE integer USING "role_id"::integer;--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "role_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "role_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "role_permission" ADD CONSTRAINT "role_permission_role_id_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "role"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "role_permission" ADD CONSTRAINT "role_permission_permission_id_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permission"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_role_id_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "role"("id") ON DELETE SET NULL;