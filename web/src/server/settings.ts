import 'server-only';

import { isWeightUnit, type WeightUnit } from '@/lib/units';

import { prisma } from './db';

export async function getDefaultUnit(userId: string): Promise<WeightUnit> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { defaultUnit: true } });
  return isWeightUnit(user?.defaultUnit) ? user.defaultUnit : 'lb';
}

export async function setDefaultUnit(userId: string, unit: WeightUnit): Promise<void> {
  await prisma.user.update({ where: { id: userId }, data: { defaultUnit: unit } });
}
