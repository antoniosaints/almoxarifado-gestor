ALTER TABLE "OfficeLetterTemplate" ADD COLUMN "headerImageUrl" TEXT;
ALTER TABLE "OfficeLetterTemplate" ADD COLUMN "headerText" TEXT;
ALTER TABLE "OfficeLetterTemplate" ADD COLUMN "headerAlignment" TEXT NOT NULL DEFAULT 'LEFT';
ALTER TABLE "OfficeLetterTemplate" ADD COLUMN "footerText" TEXT;
