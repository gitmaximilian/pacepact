CREATE TABLE `comments` (
	`id` text PRIMARY KEY NOT NULL,
	`group_id` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`user_id` text NOT NULL,
	`body` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `comments_group_target_idx` ON `comments` (`group_id`,`target_id`);--> statement-breakpoint
CREATE INDEX `comments_target_idx` ON `comments` (`target_id`);--> statement-breakpoint
CREATE TABLE `contest_entries` (
	`contest_id` text NOT NULL,
	`user_id` text NOT NULL,
	`status` text NOT NULL,
	`score` real,
	`rank` integer,
	`badge` text,
	PRIMARY KEY(`contest_id`, `user_id`),
	FOREIGN KEY (`contest_id`) REFERENCES `contests`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `contest_entries_user_idx` ON `contest_entries` (`user_id`);--> statement-breakpoint
CREATE TABLE `contests` (
	`id` text PRIMARY KEY NOT NULL,
	`group_id` text,
	`created_by` text,
	`kind` text NOT NULL,
	`metric` text NOT NULL,
	`target` real NOT NULL,
	`start_week` text NOT NULL,
	`weeks` integer NOT NULL,
	`template` text,
	`title` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `contests_group_idx` ON `contests` (`group_id`,`status`);--> statement-breakpoint
CREATE INDEX `contests_creator_idx` ON `contests` (`created_by`);--> statement-breakpoint
CREATE TABLE `milestones` (
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`value` integer NOT NULL,
	`achieved_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `kind`, `value`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `milestones_user_time_idx` ON `milestones` (`user_id`,`achieved_at`);--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`window_start` integer NOT NULL,
	`count` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `reactions` (
	`group_id` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`user_id` text NOT NULL,
	`emoji` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`group_id`, `target_type`, `target_id`, `user_id`, `emoji`),
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `reactions_target_idx` ON `reactions` (`target_id`);--> statement-breakpoint
CREATE TABLE `reports` (
	`comment_id` text NOT NULL,
	`reporter_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`comment_id`, `reporter_id`),
	FOREIGN KEY (`comment_id`) REFERENCES `comments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`reporter_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `run_weeks` (
	`user_id` text NOT NULL,
	`week` text NOT NULL,
	`variant` text NOT NULL,
	`runs` integer DEFAULT 0 NOT NULL,
	`sec` integer DEFAULT 0 NOT NULL,
	`km` real DEFAULT 0 NOT NULL,
	`longest_sec` integer DEFAULT 0 NOT NULL,
	`longest_km` real DEFAULT 0 NOT NULL,
	`continuous_sec` integer DEFAULT 0 NOT NULL,
	`walk_runs` integer DEFAULT 0 NOT NULL,
	`easy_sec` integer DEFAULT 0 NOT NULL,
	`easy_km` real DEFAULT 0 NOT NULL,
	`test_km` real DEFAULT 0 NOT NULL,
	PRIMARY KEY(`user_id`, `week`, `variant`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `group_members` ADD `share_distance` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `group_members` ADD `share_pace` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `group_members` ADD `race_registered` integer;--> statement-breakpoint
ALTER TABLE `group_members` ADD `last_seen_at` integer;--> statement-breakpoint
ALTER TABLE `groups` ADD `only_imported` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `groups` ADD `race_name` text;--> statement-breakpoint
ALTER TABLE `groups` ADD `race_date` text;--> statement-breakpoint
ALTER TABLE `runs` ADD `walk_known` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `stats_version` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
-- Watch and API imports cannot tell walk breaks apart: mark them as unknown so they no longer unlock tempo work.
UPDATE `runs` SET `walk_known` = 0 WHERE `source` NOT IN ('manual', 'csv') AND `walk_breaks` = 0;
