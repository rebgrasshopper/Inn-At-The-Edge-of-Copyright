ALTER TABLE `containers` ADD `discovery_scope` text;--> statement-breakpoint
ALTER TABLE `features` ADD `discovery_scope` text;--> statement-breakpoint
ALTER TABLE `players` ADD `discovered_feature_ids` text;--> statement-breakpoint
ALTER TABLE `players` ADD `discovered_container_ids` text;