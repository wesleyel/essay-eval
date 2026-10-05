CREATE TABLE `ai_config` (
	`id` integer PRIMARY KEY NOT NULL,
	`base_url` text NOT NULL,
	`api_key` text NOT NULL,
	`model` text NOT NULL,
	`reasoning_effort` text NOT NULL,
	CONSTRAINT "ai_config_singleton" CHECK("ai_config"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE `essays` (
	`id` text PRIMARY KEY NOT NULL,
	`subject` text NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`category` text DEFAULT '' NOT NULL,
	`tags` text DEFAULT '[]' NOT NULL,
	`prompt` text DEFAULT '' NOT NULL,
	`prompt_image` text,
	`content` text DEFAULT '' NOT NULL,
	`word_count` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "essays_subject_type" CHECK((subject = 'english' AND type IN ('part-a', 'part-b')) OR (subject = 'politics' AND type IN ('mayuan', 'maozhongte', 'shigang', 'defa', 'dangdai')))
);
--> statement-breakpoint
CREATE INDEX `essays_subject_updated` ON `essays` (`subject`,`updated_at`);--> statement-breakpoint
CREATE TABLE `evaluations` (
	`id` text PRIMARY KEY NOT NULL,
	`essay_id` text NOT NULL,
	`version_id` text NOT NULL,
	`score` real NOT NULL,
	`max_score` real NOT NULL,
	`band` text NOT NULL,
	`dimensions` text NOT NULL,
	`overall_comment` text NOT NULL,
	`strengths` text NOT NULL,
	`weaknesses` text NOT NULL,
	`corrections` text NOT NULL,
	`polished` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`essay_id`) REFERENCES `essays`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`version_id`) REFERENCES `versions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `evaluations_version` ON `evaluations` (`version_id`);--> statement-breakpoint
CREATE INDEX `evaluations_essay_created` ON `evaluations` (`essay_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `inspirations` (
	`essay_id` text PRIMARY KEY NOT NULL,
	`id` text NOT NULL,
	`source_type` text NOT NULL,
	`source_prompt` text NOT NULL,
	`source_content` text NOT NULL,
	`sentences` text NOT NULL,
	`upgrades` text NOT NULL,
	`structure_tips` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`essay_id`) REFERENCES `essays`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `templates` (
	`id` text PRIMARY KEY NOT NULL,
	`subject` text NOT NULL,
	`category` text NOT NULL,
	`pattern` text NOT NULL,
	`usage` text NOT NULL,
	`example` text NOT NULL,
	`source_essay_id` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`source_essay_id`) REFERENCES `essays`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `templates_subject_pattern` ON `templates` (`subject`,`pattern`);--> statement-breakpoint
CREATE INDEX `templates_subject_created` ON `templates` (`subject`,`created_at`);--> statement-breakpoint
CREATE TABLE `versions` (
	`id` text PRIMARY KEY NOT NULL,
	`essay_id` text NOT NULL,
	`note` text NOT NULL,
	`title` text NOT NULL,
	`type` text NOT NULL,
	`prompt` text NOT NULL,
	`content` text NOT NULL,
	`word_count` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`essay_id`) REFERENCES `essays`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `versions_essay_created` ON `versions` (`essay_id`,`created_at`);