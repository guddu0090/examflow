import { PrismaClient } from '@prisma/client'

// Force-set DATABASE_URL so PrismaClient always has it,
// even if Vercel's serverless runtime doesn't pass it from env vars.
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "postgresql://neondb_owner:npg_Wn34KQVkSahN@ep-purple-poetry-a1c4s16x.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"
}

const prismaClientSingleton = () => new PrismaClient()

declare global {
  var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>
}

export const db = globalThis.prismaGlobal ?? prismaClientSingleton()

if (process.env.NODE_ENV !== 'production') globalThis.prismaGlobal = db
