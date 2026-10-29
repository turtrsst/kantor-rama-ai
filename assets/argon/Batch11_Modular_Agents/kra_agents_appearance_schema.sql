-- Migration KRA Agents Modular Appearance
ALTER TABLE `kra_agents`
ADD COLUMN IF NOT EXISTS `appearance` JSON NULL AFTER `palette`;
