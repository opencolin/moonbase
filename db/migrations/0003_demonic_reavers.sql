ALTER TABLE `events` ADD `hackathon_mode` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `events` ADD `min_team_size` integer;--> statement-breakpoint
ALTER TABLE `events` ADD `max_team_size` integer;--> statement-breakpoint
ALTER TABLE `events` ADD `submission_deadline` integer;