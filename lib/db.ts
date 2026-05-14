import { PrismaClient } from '@/app/generated/prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'

function createClient() {
  const url = process.env.DATABASE_URL ?? 'file:./prisma/dev.db'
  const adapter = new PrismaBetterSqlite3({ url })
  return new PrismaClient({ adapter })
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const db = globalForPrisma.prisma ?? createClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db

export async function ensureSingletons() {
  await db.playbackState.upsert({
    where: { id: 1 },
    create: { id: 1 },
    update: {},
  })
  await db.settings.upsert({
    where: { id: 1 },
    create: { id: 1 },
    update: {},
  })
}
