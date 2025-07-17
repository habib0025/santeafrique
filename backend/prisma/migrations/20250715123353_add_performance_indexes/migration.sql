-- CreateIndex
CREATE INDEX `Appointment_date_idx` ON `Appointment`(`date`);

-- CreateIndex
CREATE INDEX `Appointment_status_idx` ON `Appointment`(`status`);

-- CreateIndex
CREATE INDEX `Campaign_status_idx` ON `Campaign`(`status`);

-- CreateIndex
CREATE INDEX `Campaign_startDate_endDate_idx` ON `Campaign`(`startDate`, `endDate`);

-- CreateIndex
CREATE INDEX `User_role_idx` ON `User`(`role`);

-- RenameIndex
ALTER TABLE `appointment` RENAME INDEX `Appointment_centerId_fkey` TO `Appointment_centerId_idx`;

-- RenameIndex
ALTER TABLE `appointment` RENAME INDEX `Appointment_donorId_fkey` TO `Appointment_donorId_idx`;
