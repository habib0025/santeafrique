-- AlterTable
ALTER TABLE `appointment` ADD COLUMN `cancelledAt` DATETIME(3) NULL,
    ADD COLUMN `completedAt` DATETIME(3) NULL,
    ADD COLUMN `confirmedAt` DATETIME(3) NULL;
