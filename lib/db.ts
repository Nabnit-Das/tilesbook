import {PrismaClient} from '@prisma/client';
const cache = globalThis as typeof globalThis & {tilebookDb?: PrismaClient};
export const db = cache.tilebookDb ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') cache.tilebookDb = db;