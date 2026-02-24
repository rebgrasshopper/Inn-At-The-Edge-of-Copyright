CREATE TABLE `corpse_inventory` (
	`id` text PRIMARY KEY NOT NULL,
	`corpse_id` text NOT NULL,
	`item_id` text NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`corpse_id`) REFERENCES `corpses`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `corpses` (
	`id` text PRIMARY KEY NOT NULL,
	`player_id` text NOT NULL,
	`room_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`unlocks_at` integer NOT NULL,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `monsters` ADD `aggro_score` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `monsters` ADD `weapon_damage` text DEFAULT '1d4';--> statement-breakpoint
ALTER TABLE `monsters` ADD `level` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `players` ADD `respawn_room_id` text;