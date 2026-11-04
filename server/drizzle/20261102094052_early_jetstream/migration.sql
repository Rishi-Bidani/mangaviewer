CREATE TABLE `app_settings` (
	`key` text PRIMARY KEY,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `extension_data` (
	`extension_id` text NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL,
	CONSTRAINT `extension_data_pk` PRIMARY KEY(`extension_id`, `key`)
);
--> statement-breakpoint
CREATE TABLE `extension_settings` (
	`extension_id` text NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL,
	CONSTRAINT `extension_settings_pk` PRIMARY KEY(`extension_id`, `key`)
);
--> statement-breakpoint
CREATE TABLE `manga_metadata` (
	`manga` text PRIMARY KEY,
	`version` integer NOT NULL,
	`fetched_at` text NOT NULL,
	`lookup_key` text NOT NULL,
	`found` integer NOT NULL,
	`details` text,
	`cover` text
);
--> statement-breakpoint
CREATE TABLE `manga_preferences` (
	`manga` text PRIMARY KEY,
	`show_cover` integer,
	`match_source` text,
	`match_id` text
);
--> statement-breakpoint
CREATE TABLE `sync_progress` (
	`target_id` text NOT NULL,
	`manga` text NOT NULL,
	`synced_chapter` text,
	`synced_chapter_number` real,
	`synced_at` text,
	`pending_chapter` text,
	`pending_chapter_number` real,
	`pending_at` text,
	`problem_kind` text,
	`problem_message` text,
	CONSTRAINT `sync_progress_pk` PRIMARY KEY(`target_id`, `manga`)
);
--> statement-breakpoint
CREATE TABLE `sync_targets` (
	`id` text PRIMARY KEY
);
