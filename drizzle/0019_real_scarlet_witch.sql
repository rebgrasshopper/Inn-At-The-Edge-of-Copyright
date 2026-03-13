CREATE TABLE `player_spells` (
	`id` text PRIMARY KEY NOT NULL,
	`player_id` text NOT NULL,
	`spell_id` text NOT NULL,
	`successful_casts` integer DEFAULT 0 NOT NULL,
	`learned_at` integer NOT NULL,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`spell_id`) REFERENCES `spells`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `player_spells_player_id_spell_id_unique` ON `player_spells` (`player_id`,`spell_id`);--> statement-breakpoint
CREATE TABLE `spells` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`mana_cost` integer NOT NULL,
	`min_int` integer NOT NULL,
	`scaling_level` integer,
	`effect` text,
	`target_type` text DEFAULT 'self' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `spells_name_unique` ON `spells` (`name`);--> statement-breakpoint
ALTER TABLE `players` ADD `mana` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `players` ADD `max_mana` integer DEFAULT 0 NOT NULL;