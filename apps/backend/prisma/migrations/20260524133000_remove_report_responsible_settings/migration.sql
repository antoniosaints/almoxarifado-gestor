-- Report responsible data now comes from the authenticated exporting user.
ALTER TABLE "SystemSettings" DROP COLUMN "reportResponsibleName";
ALTER TABLE "SystemSettings" DROP COLUMN "reportResponsibleRole";
