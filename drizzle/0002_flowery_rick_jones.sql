CREATE TABLE `food_entry` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`day` text NOT NULL,
	`logged_at` integer NOT NULL,
	`name` text NOT NULL,
	`calories` integer NOT NULL,
	`protein` real,
	`carbs` real,
	`fat` real
);
--> statement-breakpoint
CREATE INDEX `food_entry_day_idx` ON `food_entry` (`day`);--> statement-breakpoint
CREATE TABLE `plan_day` (
	`weekday` integer PRIMARY KEY NOT NULL,
	`name` text
);
--> statement-breakpoint
CREATE TABLE `plan_exercise` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`weekday` integer NOT NULL,
	`exercise_id` integer NOT NULL,
	`position` integer NOT NULL,
	`target_sets` integer,
	`target_reps` integer,
	`target_weight` real,
	`target_unit` text NOT NULL,
	FOREIGN KEY (`weekday`) REFERENCES `plan_day`(`weekday`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`exercise_id`) REFERENCES `exercise`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `plan_exercise_weekday_idx` ON `plan_exercise` (`weekday`);--> statement-breakpoint
CREATE TABLE `saved_food` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`calories` integer NOT NULL,
	`protein` real,
	`carbs` real,
	`fat` real
);
--> statement-breakpoint
CREATE UNIQUE INDEX `saved_food_name_unique` ON `saved_food` (lower("name"));--> statement-breakpoint
ALTER TABLE `session_exercise` ADD `target_sets` integer;--> statement-breakpoint
ALTER TABLE `session_exercise` ADD `target_reps` integer;--> statement-breakpoint
ALTER TABLE `session_exercise` ADD `target_weight` real;--> statement-breakpoint
ALTER TABLE `session_exercise` ADD `target_unit` text;--> statement-breakpoint
ALTER TABLE `session` ADD `plan_weekday` integer;