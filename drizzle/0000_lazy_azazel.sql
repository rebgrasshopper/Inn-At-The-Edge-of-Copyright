CREATE TABLE `container_inventory` (
	`id` text PRIMARY KEY NOT NULL,
	`container_id` text NOT NULL,
	`item_id` text NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`container_id`) REFERENCES `containers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `containers` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`is_hidden` integer DEFAULT false,
	`reveal_command` text,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `features` (
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
	`is_hidden` integer DEFAULT false,
	`is_discovered` integer DEFAULT false,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `items` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`category` text,
	`str_effect` integer DEFAULT 0,
	`dex_effect` integer DEFAULT 0,
	`con_effect` integer DEFAULT 0,
	`int_effect` integer DEFAULT 0,
	`wis_effect` integer DEFAULT 0,
	`cha_effect` integer DEFAULT 0,
	`hp_effect` integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE `monster_instances` (
	`id` text PRIMARY KEY NOT NULL,
	`monster_id` text NOT NULL,
	`room_id` text NOT NULL,
	`current_hp` integer NOT NULL,
	`spawned_at` integer NOT NULL,
	FOREIGN KEY (`monster_id`) REFERENCES `monsters`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `monster_spawns` (
	`id` text PRIMARY KEY NOT NULL,
	`monster_id` text NOT NULL,
	`room_id` text NOT NULL,
	`max_count` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`monster_id`) REFERENCES `monsters`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `monsters` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`str` integer DEFAULT 10 NOT NULL,
	`dex` integer DEFAULT 10 NOT NULL,
	`con` integer DEFAULT 10 NOT NULL,
	`int` integer DEFAULT 10 NOT NULL,
	`wis` integer DEFAULT 10 NOT NULL,
	`cha` integer DEFAULT 10 NOT NULL,
	`max_hp` integer DEFAULT 10 NOT NULL,
	`xp_reward` integer DEFAULT 10 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `npcs` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`room_id` text,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `player_inventory` (
	`id` text PRIMARY KEY NOT NULL,
	`player_id` text NOT NULL,
	`item_id` text NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `players` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`current_room_id` text,
	`str` integer DEFAULT 10 NOT NULL,
	`dex` integer DEFAULT 10 NOT NULL,
	`con` integer DEFAULT 10 NOT NULL,
	`int` integer DEFAULT 10 NOT NULL,
	`wis` integer DEFAULT 10 NOT NULL,
	`cha` integer DEFAULT 10 NOT NULL,
	`current_hp` integer DEFAULT 10 NOT NULL,
	`max_hp` integer DEFAULT 10 NOT NULL,
	`xp` integer DEFAULT 0 NOT NULL,
	`level` integer DEFAULT 1 NOT NULL,
	`is_online` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `players_name_unique` ON `players` (`name`);--> statement-breakpoint
CREATE TABLE `room_inventory` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`item_id` text NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`region` text NOT NULL,
	`exits` text
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`password_hash` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);