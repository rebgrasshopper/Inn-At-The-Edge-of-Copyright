ALTER TABLE `monster_instances` ADD `killed_at` integer;--> statement-breakpoint
ALTER TABLE `monsters` ADD `respawn_seconds` integer DEFAULT 120 NOT NULL;