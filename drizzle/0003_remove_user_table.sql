DROP TABLE `user`;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_category` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`icon` text,
	`color` text,
	`is_default` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_category`("id", "user_id", "name", "type", "icon", "color", "is_default", "created_at") SELECT "id", "user_id", "name", "type", "icon", "color", "is_default", "created_at" FROM `category`;--> statement-breakpoint
DROP TABLE `category`;--> statement-breakpoint
ALTER TABLE `__new_category` RENAME TO `category`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_category_user_id` ON `category` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_category_type` ON `category` (`user_id`,`type`);--> statement-breakpoint
CREATE TABLE `__new_transaction` (
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
	FOREIGN KEY (`wallet_id`) REFERENCES `wallet`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`) REFERENCES `category`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_transaction`("id", "user_id", "wallet_id", "category_id", "type", "amount", "description", "notes", "transaction_date", "created_at", "updated_at") SELECT "id", "user_id", "wallet_id", "category_id", "type", "amount", "description", "notes", "transaction_date", "created_at", "updated_at" FROM `transaction`;--> statement-breakpoint
DROP TABLE `transaction`;--> statement-breakpoint
ALTER TABLE `__new_transaction` RENAME TO `transaction`;--> statement-breakpoint
CREATE INDEX `idx_transaction_user_id` ON `transaction` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_transaction_wallet_id` ON `transaction` (`wallet_id`);--> statement-breakpoint
CREATE INDEX `idx_transaction_date` ON `transaction` (`user_id`,`transaction_date`);--> statement-breakpoint
CREATE INDEX `idx_transaction_type` ON `transaction` (`user_id`,`type`);--> statement-breakpoint
CREATE INDEX `idx_transaction_category` ON `transaction` (`category_id`);--> statement-breakpoint
CREATE TABLE `__new_transfer` (
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
	FOREIGN KEY (`from_wallet_id`) REFERENCES `wallet`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`to_wallet_id`) REFERENCES `wallet`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_transfer`("id", "user_id", "from_wallet_id", "to_wallet_id", "amount", "fee", "description", "transfer_date", "created_at", "updated_at") SELECT "id", "user_id", "from_wallet_id", "to_wallet_id", "amount", "fee", "description", "transfer_date", "created_at", "updated_at" FROM `transfer`;--> statement-breakpoint
DROP TABLE `transfer`;--> statement-breakpoint
ALTER TABLE `__new_transfer` RENAME TO `transfer`;--> statement-breakpoint
CREATE INDEX `idx_transfer_user_id` ON `transfer` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_transfer_from_wallet` ON `transfer` (`from_wallet_id`);--> statement-breakpoint
CREATE INDEX `idx_transfer_to_wallet` ON `transfer` (`to_wallet_id`);--> statement-breakpoint
CREATE INDEX `idx_transfer_date` ON `transfer` (`user_id`,`transfer_date`);--> statement-breakpoint
CREATE TABLE `__new_wallet` (
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
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_wallet`("id", "user_id", "name", "icon", "color", "initial_balance", "current_balance", "is_active", "display_order", "created_at", "updated_at") SELECT "id", "user_id", "name", "icon", "color", "initial_balance", "current_balance", "is_active", "display_order", "created_at", "updated_at" FROM `wallet`;--> statement-breakpoint
DROP TABLE `wallet`;--> statement-breakpoint
ALTER TABLE `__new_wallet` RENAME TO `wallet`;--> statement-breakpoint
CREATE INDEX `idx_wallet_user_id` ON `wallet` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_wallet_active` ON `wallet` (`user_id`,`is_active`);