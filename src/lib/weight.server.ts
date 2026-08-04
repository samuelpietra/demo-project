import { createServerFn } from "@tanstack/react-start";
import { getServerSidePrismaClient } from "@/lib/db.server";
import { authMiddleware } from "@/lib/auth.server";
import { z } from "zod";

export const addWeightEntryServerFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(z.object({ weight: z.number().positive() }))
  .handler(async ({ context, data }) => {
    const prisma = await getServerSidePrismaClient();
    const entry = await prisma.weightEntry.create({
      data: { userId: context.user.id, weight: data.weight },
    });
    return { success: true as const, entry };
  });

export const getWeightEntriesServerFn = createServerFn()
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const prisma = await getServerSidePrismaClient();
    return prisma.weightEntry.findMany({
      where: { userId: context.user.id },
      orderBy: { recordedAt: "asc" },
    });
  });
