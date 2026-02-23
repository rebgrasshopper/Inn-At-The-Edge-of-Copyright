ALTER TABLE `items` RENAME COLUMN "equip_slot" TO "equip_slots";--> statement-breakpoint
ALTER TABLE `containers` ADD `aliases` text;