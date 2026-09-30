import { eq } from 'drizzle-orm';

import { settings, WEIGHT_UNITS, type WeightUnit } from '@/db/schema';
import type { DB } from '@/db/types';

const DEFAULT_UNIT_KEY = 'default_unit';

export function getDefaultUnit(db: DB): WeightUnit {
  const row = db.select().from(settings).where(eq(settings.key, DEFAULT_UNIT_KEY)).get();
  return WEIGHT_UNITS.find((u) => u === row?.value) ?? 'lb';
}

export function setDefaultUnit(db: DB, unit: WeightUnit): void {
  db.insert(settings)
    .values({ key: DEFAULT_UNIT_KEY, value: unit })
    .onConflictDoUpdate({ target: settings.key, set: { value: unit } })
    .run();
}
