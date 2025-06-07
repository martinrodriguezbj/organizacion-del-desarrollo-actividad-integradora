-- Modify "users" table
ALTER TABLE "public"."users" ADD COLUMN "updated_at" timestamptz NOT NULL DEFAULT now(), ADD COLUMN "first_name" character varying(50) NOT NULL, ADD COLUMN "last_name" character varying(50) NOT NULL, ADD COLUMN "password" character varying(255) NOT NULL, ADD COLUMN "enabled" boolean NOT NULL DEFAULT true, ADD COLUMN "last_access_time" timestamptz NULL;
