// lib/prisma.ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// Named export (ifall något i koden använder { prisma })
export const prisma: PrismaClient =
  globalForPrisma.prisma ?? new PrismaClient({
    // log: ["query"], // slå på vid behov
  });

// Default export (så import prisma from "..." funkar)
export default prisma;

// Cache klienten i dev för att undvika många instanser vid HMR
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
