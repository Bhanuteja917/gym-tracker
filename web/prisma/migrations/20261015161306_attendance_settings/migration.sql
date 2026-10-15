-- AlterTable
ALTER TABLE "user" ADD COLUMN     "attendanceRange" TEXT NOT NULL DEFAULT '3m',
ADD COLUMN     "attendanceStart" TEXT;
