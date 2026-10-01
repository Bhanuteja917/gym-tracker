-- Default muscle groups, plus any other group names exercises already use.
INSERT INTO `muscle_group` (`name`, `position`) VALUES
	('Chest', 0),
	('Back', 1),
	('Shoulders', 2),
	('Arms', 3),
	('Legs', 4),
	('Core', 5),
	('Cardio', 6),
	('Full body', 7);
--> statement-breakpoint
INSERT INTO `muscle_group` (`name`, `position`)
SELECT `name`, 7 + ROW_NUMBER() OVER (ORDER BY lower(`name`)) FROM (
	SELECT MIN(trim(`category`)) AS `name` FROM `exercise`
	WHERE `category` IS NOT NULL AND trim(`category`) <> ''
	GROUP BY lower(trim(`category`))
) WHERE lower(`name`) NOT IN (SELECT lower(`name`) FROM `muscle_group`);
