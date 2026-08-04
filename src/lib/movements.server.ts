import { createServerFn } from "@tanstack/react-start";
import { getServerSidePrismaClient } from "@/lib/db.server";
import { authMiddleware } from "@/lib/auth.server";
import { Prisma } from "../../prisma/generated/client/client";
import { z } from "zod";

export const createMovementServerFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(z.object({ name: z.string().min(1), isBodyweight: z.boolean().default(false) }))
  .handler(async ({ context, data }) => {
    const prisma = await getServerSidePrismaClient();
    try {
      const movement = await prisma.movement.create({
        data: { name: data.name, userId: context.user.id, isBodyweight: data.isBodyweight },
      });
      return { success: true as const, movement };
    } catch (error) {
      // Unique violation on [userId, name] -> the user already has this movement.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return { success: false as const, error: "A movement with this name already exists" };
      }
      throw error;
    }
  });

export const getMovementsServerFn = createServerFn()
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const prisma = await getServerSidePrismaClient();
    return prisma.movement.findMany({
      where: { userId: context.user.id },
      orderBy: { name: "asc" },
    });
  });
