CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`location` text,
	`notes` text,
	`owner` text DEFAULT 'shared' NOT NULL,
	`all_day` integer DEFAULT false NOT NULL,
	`start_date` text NOT NULL,
	`start_time` text,
	`end_date` text NOT NULL,
	`end_time` text,
	`time_zone` text NOT NULL,
	`repeat` text DEFAULT 'none' NOT NULL,
	`repeat_days` text DEFAULT '' NOT NULL,
	`repeat_until` text,
	`sequence` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `events_owner_start_idx` ON `events` (`owner`,`start_date`);--> statement-breakpoint
CREATE TABLE `import_status` (
	`source` text PRIMARY KEY NOT NULL,
	`last_attempt_at` text,
	`last_success_at` text,
	`last_error` text,
	`count` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `imported` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source` text NOT NULL,
	`uid` text NOT NULL,
	`title` text NOT NULL,
	`location` text,
	`notes` text,
	`all_day` integer NOT NULL,
	`start` text NOT NULL,
	`end` text NOT NULL,
	`first_day` text NOT NULL,
	`last_day` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `imported_source_day_idx` ON `imported` (`source`,`first_day`);