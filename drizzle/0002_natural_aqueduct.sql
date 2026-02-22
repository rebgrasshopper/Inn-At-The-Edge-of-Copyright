PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_containers` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`is_hidden` integer,
	`revealed_at` integer,
	`is_open` integer DEFAULT false,
	`reveal_command` text,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_containers`("id", "room_id", "name", "description", "is_hidden", "is_open", "reveal_command") SELECT "id", "room_id", "name", "description", "is_hidden", "is_open", "reveal_command" FROM `containers`;--> statement-breakpoint
DROP TABLE `containers`;--> statement-breakpoint
ALTER TABLE `__new_containers` RENAME TO `containers`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_features` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`trigger_verbs` text,
	`trigger_target` text,
	`condition` text,
	`success_message` text,
	`failure_message` text,
	`success_effects` text,
	`failure_effects` text,
	`reveals_feature_id` text,
	`reveals_container_id` text,
	`is_hidden` integer,
	`revealed_at` integer,
	`is_discovered` integer DEFAULT false,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_features`("id", "room_id", "name", "description", "trigger_verbs", "trigger_target", "condition", "success_message", "failure_message", "success_effects", "failure_effects", "reveals_feature_id", "reveals_container_id", "is_hidden", "is_discovered") SELECT "id", "room_id", "name", "description", "trigger_verbs", "trigger_target", "condition", "success_message", "failure_message", "success_effects", "failure_effects", "reveals_feature_id", "reveals_container_id", "is_hidden", "is_discovered" FROM `features`;--> statement-breakpoint
DROP TABLE `features`;--> statement-breakpoint
ALTER TABLE `__new_features` RENAME TO `features`;