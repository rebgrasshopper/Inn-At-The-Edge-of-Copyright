ALTER TABLE `containers` ADD `is_open` integer DEFAULT false;--> statement-breakpoint
ALTER TABLE `items` ADD `plural_name` text;--> statement-breakpoint
ALTER TABLE `items` ADD `is_bulk` integer DEFAULT false;--> statement-breakpoint
ALTER TABLE `items` ADD `equip_slot` text;--> statement-breakpoint
ALTER TABLE `items` ADD `weapon_damage` text;--> statement-breakpoint
ALTER TABLE `items` ADD `weapon_type` text;--> statement-breakpoint
ALTER TABLE `items` ADD `magic_properties` text;--> statement-breakpoint
ALTER TABLE `players` ADD `worn_head` text;--> statement-breakpoint
ALTER TABLE `players` ADD `worn_torso` text;--> statement-breakpoint
ALTER TABLE `players` ADD `worn_body` text;--> statement-breakpoint
ALTER TABLE `players` ADD `worn_legs` text;--> statement-breakpoint
ALTER TABLE `players` ADD `worn_hands` text;--> statement-breakpoint
ALTER TABLE `players` ADD `worn_feet` text;--> statement-breakpoint
ALTER TABLE `players` ADD `worn_main_hand` text;--> statement-breakpoint
ALTER TABLE `players` ADD `worn_off_hand` text;--> statement-breakpoint
ALTER TABLE `players` ADD `worn_neck` text;--> statement-breakpoint
ALTER TABLE `players` ADD `worn_ring1` text;--> statement-breakpoint
ALTER TABLE `players` ADD `worn_ring2` text;