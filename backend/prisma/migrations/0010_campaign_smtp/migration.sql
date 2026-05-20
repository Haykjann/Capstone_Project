ALTER TABLE "PhishingCampaign" ADD COLUMN IF NOT EXISTS "smtpUser" TEXT;
ALTER TABLE "PhishingCampaign" ADD COLUMN IF NOT EXISTS "smtpPassword" TEXT;
