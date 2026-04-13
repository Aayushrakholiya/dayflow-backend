-- AlterTable
ALTER TABLE "User" ADD COLUMN     "deviceTokens" TEXT[] DEFAULT ARRAY[]::TEXT[];
