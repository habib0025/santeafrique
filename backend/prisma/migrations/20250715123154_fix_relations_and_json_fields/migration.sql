-- CreateIndex
CREATE INDEX `Donation_date_idx` ON `Donation`(`date`);

-- RenameIndex
ALTER TABLE `donation` RENAME INDEX `Donation_centerId_fkey` TO `Donation_centerId_idx`;

-- RenameIndex
ALTER TABLE `donation` RENAME INDEX `Donation_donorId_fkey` TO `Donation_donorId_idx`;
