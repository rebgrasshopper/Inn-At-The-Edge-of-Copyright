CREATE TABLE `feat_prerequisites` (
	`id` text PRIMARY KEY NOT NULL,
	`feat_id` text NOT NULL,
	`prerequisite_type` text NOT NULL,
	`prerequisite_key` text,
	`prerequisite_value` integer,
	FOREIGN KEY (`feat_id`) REFERENCES `feats`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `feats` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`prerequisites_text` text,
	`short_description` text NOT NULL,
	`long_description` text,
	`source_book` text,
	`category` text DEFAULT 'Untyped' NOT NULL,
	`effect_type` text,
	`supportability_status` text DEFAULT 'unsupported' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `feats_name_unique` ON `feats` (`name`);--> statement-breakpoint
CREATE TABLE `player_feats` (
	`id` text PRIMARY KEY NOT NULL,
	`player_id` text NOT NULL,
	`feat_id` text NOT NULL,
	`acquired_at` integer NOT NULL,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`feat_id`) REFERENCES `feats`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `player_feats_player_id_feat_id_unique` ON `player_feats` (`player_id`,`feat_id`);--> statement-breakpoint
ALTER TABLE `items` ADD `weapon_range` text;--> statement-breakpoint
ALTER TABLE `players` ADD `unspent_feat_slots` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `players` ADD `active_stance` text;