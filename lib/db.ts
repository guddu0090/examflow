import { PrismaClient } from '@prisma/client'
import { Pool, neonConfig } from '@neondatabase/serverless'
import { PrismaNeon } from '@prisma/adapter-neon'
import ws from 'ws'

neonConfig.webSocketConstructor = ws

const prismaClientSingleton = () => {
  if (process.env.NODE_ENV !== 'production') {
    // During local 'npm run dev', use the simple Prisma client without the Vercel-specific web sockets
    return new PrismaClient()
  }

  // Use Vercel's env variable if it exists, otherwise use the proven Neon DB string as a hard fallback
  const connectionString = process.env.DATABASE_URL || "postgresql://neondb_owner:npg_Wn34KQVkSahN@ep-purple-poetry-a1c4s16x.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";
  const pool = new Pool({ connectionString })
  // Using 'as any' bypasses a known strict TypeScript definition mismatch
  // between @neondatabase/serverless and @prisma/adapter-neon.
  const adapter = new PrismaNeon(pool as any)
  return new PrismaClient({ adapter })
}

declare global {
  var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>
}

export const db = globalThis.prismaGlobal ?? prismaClientSingleton()

if (process.env.NODE_ENV !== 'production') globalThis.prismaGlobal = db
