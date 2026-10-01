CREATE TABLE `muscle_group` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`position` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `muscle_group_name_unique` ON `muscle_group` (lower("name"));