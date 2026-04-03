import { PrismaClient } from '@prisma/client'

// The Neon connection string - use env var with hardcoded fallback
const DATABASE_URL = process.env.DATABASE_URL || "postgresql://neondb_owner:npg_Wn34KQVkSahN@ep-purple-poetry-a1c4s16x.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"

const prismaClientSingleton = () => {
  if (process.env.NODE_ENV !== 'production') {
    // Local dev: standard PrismaClient reads DATABASE_URL from .env automatically
    return new PrismaClient()
  }

  // Vercel production: use Neon HTTP driver (simpler and more reliable than WebSockets)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { neon } = require('@neondatabase/serverless')
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PrismaNeonHTTP } = require('@prisma/adapter-neon')
  const sql = neon(DATABASE_URL)
  const adapter = new PrismaNeonHTTP(sql)
  return new PrismaClient({ adapter } as any)
}

declare global {
  var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>
}

export const db = globalThis.prismaGlobal ?? prismaClientSingleton()

if (process.env.NODE_ENV !== 'production') globalThis.prismaGlobal = db
