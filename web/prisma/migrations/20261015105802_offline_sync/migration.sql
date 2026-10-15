-- Offline sync (docs/OFFLINE-PLAN.md): version/seq/deletedAt on the four
-- user-data tables, userId on child tables, set duration, nullable reps,
-- and the sync_mutation idempotency log. Existing rows are backfilled.

-- Names are now unique among live exercises only; enforced in the sync layer.
DROP INDEX "exercise_userId_name_key";
DROP INDEX "exercise_userId_archived_idx";

-- exercise
ALTER TABLE "exercise"
  ADD COLUMN "deletedAt" TIMESTAMP(3),
  ADD COLUMN "seq" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

-- workout
ALTER TABLE "workout"
  ADD COLUMN "deletedAt" TIMESTAMP(3),
  ADD COLUMN "seq" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

-- workout_exercise
ALTER TABLE "workout_exercise"
  ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "deletedAt" TIMESTAMP(3),
  ADD COLUMN "seq" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "userId" TEXT;
UPDATE "workout_exercise" we SET "userId" = w."userId" FROM "workout" w WHERE w."id" = we."workoutId";
ALTER TABLE "workout_exercise" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "workout_exercise" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- exercise_set
ALTER TABLE "exercise_set"
  ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "deletedAt" TIMESTAMP(3),
  ADD COLUMN "seq" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "durationSec" INTEGER,
  ADD COLUMN "userId" TEXT,
  ALTER COLUMN "reps" DROP NOT NULL;
UPDATE "exercise_set" s SET "userId" = we."userId" FROM "workout_exercise" we WHERE we."id" = s."workoutExerciseId";
ALTER TABLE "exercise_set" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "exercise_set" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- sync_mutation
CREATE TABLE "sync_mutation" (
    "userId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_mutation_pkey" PRIMARY KEY ("userId","id")
);
CREATE INDEX "sync_mutation_appliedAt_idx" ON "sync_mutation"("appliedAt");

ALTER TABLE "workout_exercise" ADD CONSTRAINT "workout_exercise_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "exercise_set" ADD CONSTRAINT "exercise_set_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sync_mutation" ADD CONSTRAINT "sync_mutation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Change counter. Every insert/update of a synced row takes the next value, and
-- every update bumps the row's version, so no write path can forget either.
-- Writers for one user hold a per-user advisory lock, so a user's seq values
-- become visible in order and a pull never skips a row.
CREATE SEQUENCE "sync_seq";

-- Give existing rows a seq (before the triggers exist, so versions stay at 1).
UPDATE "exercise" SET "seq" = nextval('sync_seq');
UPDATE "workout" SET "seq" = nextval('sync_seq');
UPDATE "workout_exercise" SET "seq" = nextval('sync_seq');
UPDATE "exercise_set" SET "seq" = nextval('sync_seq');

CREATE FUNCTION "sync_bump"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW."seq" := nextval('sync_seq');
  IF TG_OP = 'UPDATE' THEN
    NEW."version" := OLD."version" + 1;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "exercise_sync_bump" BEFORE INSERT OR UPDATE ON "exercise"
  FOR EACH ROW EXECUTE FUNCTION "sync_bump"();
CREATE TRIGGER "workout_sync_bump" BEFORE INSERT OR UPDATE ON "workout"
  FOR EACH ROW EXECUTE FUNCTION "sync_bump"();
CREATE TRIGGER "workout_exercise_sync_bump" BEFORE INSERT OR UPDATE ON "workout_exercise"
  FOR EACH ROW EXECUTE FUNCTION "sync_bump"();
CREATE TRIGGER "exercise_set_sync_bump" BEFORE INSERT OR UPDATE ON "exercise_set"
  FOR EACH ROW EXECUTE FUNCTION "sync_bump"();

CREATE INDEX "exercise_userId_seq_idx" ON "exercise"("userId", "seq");
CREATE INDEX "workout_userId_seq_idx" ON "workout"("userId", "seq");
CREATE INDEX "workout_exercise_userId_seq_idx" ON "workout_exercise"("userId", "seq");
CREATE INDEX "exercise_set_userId_seq_idx" ON "exercise_set"("userId", "seq");
