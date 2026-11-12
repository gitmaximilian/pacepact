DROP TABLE `api_tokens`;--> statement-breakpoint
DROP TABLE `connections`;--> statement-breakpoint
-- The Strava sync is gone: remove the runs it imported (Strava data may not be kept without the connection).
DELETE FROM `runs` WHERE `source` = 'strava';
