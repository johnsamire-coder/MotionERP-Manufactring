CREATE TABLE "quality"."inspection_reading" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parameter_id" uuid NOT NULL,
	"reading_no" integer NOT NULL,
	"value" text NOT NULL,
	"within_spec" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inspection_reading_unique" UNIQUE("parameter_id","reading_no")
);
--> statement-breakpoint
CREATE TABLE "quality"."inspection_template" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"item_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inspection_template_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "quality"."inspection_template_parameter" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" uuid NOT NULL,
	"parameter_name" text NOT NULL,
	"is_numeric" boolean DEFAULT true NOT NULL,
	"min_value" numeric(24, 6),
	"max_value" numeric(24, 6),
	"accepted_value" text,
	"readings_required" integer DEFAULT 1 NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "inspection_template_parameter_name_unique" UNIQUE("template_id","parameter_name"),
	CONSTRAINT "template_parameter_readings_required_range" CHECK ("quality"."inspection_template_parameter"."readings_required" between 1 and 10),
	CONSTRAINT "template_parameter_criteria" CHECK (("quality"."inspection_template_parameter"."is_numeric" and ("quality"."inspection_template_parameter"."min_value" is not null or "quality"."inspection_template_parameter"."max_value" is not null)) or (not "quality"."inspection_template_parameter"."is_numeric" and "quality"."inspection_template_parameter"."accepted_value" is not null)),
	CONSTRAINT "template_parameter_min_le_max" CHECK ("quality"."inspection_template_parameter"."min_value" is null or "quality"."inspection_template_parameter"."max_value" is null or "quality"."inspection_template_parameter"."min_value" <= "quality"."inspection_template_parameter"."max_value")
);
--> statement-breakpoint
ALTER TABLE "quality"."inspection_parameter" ADD COLUMN "is_numeric" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "quality"."inspection_parameter" ADD COLUMN "min_value" numeric(24, 6);--> statement-breakpoint
ALTER TABLE "quality"."inspection_parameter" ADD COLUMN "max_value" numeric(24, 6);--> statement-breakpoint
ALTER TABLE "quality"."inspection_parameter" ADD COLUMN "accepted_value" text;--> statement-breakpoint
ALTER TABLE "quality"."inspection_parameter" ADD COLUMN "readings_required" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "quality"."inspection_reading" ADD CONSTRAINT "inspection_reading_parameter_id_inspection_parameter_id_fk" FOREIGN KEY ("parameter_id") REFERENCES "quality"."inspection_parameter"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quality"."inspection_template_parameter" ADD CONSTRAINT "inspection_template_parameter_template_id_inspection_template_id_fk" FOREIGN KEY ("template_id") REFERENCES "quality"."inspection_template"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_inspection_reading_parameter" ON "quality"."inspection_reading" USING btree ("parameter_id");--> statement-breakpoint
CREATE INDEX "idx_inspection_template_item" ON "quality"."inspection_template" USING btree ("item_id");--> statement-breakpoint
ALTER TABLE "quality"."inspection_parameter" ADD CONSTRAINT "inspection_parameter_readings_required_positive" CHECK ("quality"."inspection_parameter"."readings_required" >= 1);