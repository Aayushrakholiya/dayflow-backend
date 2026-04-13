-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "completed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "completedAt" TIMESTAMP(3);
