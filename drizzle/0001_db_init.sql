CREATE TABLE `category` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`icon` text,
	`color` text,
	`is_default` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_category_user_id` ON `category` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_category_type` ON `category` (`user_id`,`type`);--> statement-breakpoint
CREATE TABLE `transaction` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`wallet_id` text NOT NULL,
	`category_id` text,
	`type` text NOT NULL,
	`amount` real NOT NULL,
	`description` text,
	`notes` text,
	`transaction_date` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`wallet_id`) REFERENCES `wallet`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`) REFERENCES `category`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_transaction_user_id` ON `transaction` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_transaction_wallet_id` ON `transaction` (`wallet_id`);--> statement-breakpoint
CREATE INDEX `idx_transaction_date` ON `transaction` (`user_id`,`transaction_date`);--> statement-breakpoint
CREATE INDEX `idx_transaction_type` ON `transaction` (`user_id`,`type`);--> statement-breakpoint
CREATE INDEX `idx_transaction_category` ON `transaction` (`category_id`);--> statement-breakpoint
CREATE TABLE `transfer` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`from_wallet_id` text NOT NULL,
	`to_wallet_id` text NOT NULL,
	`amount` real NOT NULL,
	`fee` real DEFAULT 0 NOT NULL,
	`description` text,
	`transfer_date` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`from_wallet_id`) REFERENCES `wallet`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`to_wallet_id`) REFERENCES `wallet`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_transfer_user_id` ON `transfer` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_transfer_from_wallet` ON `transfer` (`from_wallet_id`);--> statement-breakpoint
CREATE INDEX `idx_transfer_to_wallet` ON `transfer` (`to_wallet_id`);--> statement-breakpoint
CREATE INDEX `idx_transfer_date` ON `transfer` (`user_id`,`transfer_date`);--> statement-breakpoint
CREATE TABLE `wallet` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`icon` text,
	`color` text,
	`initial_balance` real DEFAULT 0 NOT NULL,
	`current_balance` real DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`display_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_wallet_user_id` ON `wallet` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_wallet_active` ON `wallet` (`user_id`,`is_active`);