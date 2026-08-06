import { PrismaPg } from "@prisma/adapter-pg";
import { serverEnv } from "./env.server";
import { PrismaClient } from "../../prisma/generated/client/client";

let _prismaClient: PrismaClient | null = null;

export const getServerSidePrismaClient = async () => {
  if (typeof window !== "undefined") {
    throw new Error("getServerSidePrismaClient should only be called on the server");
  }
  if (!_prismaClient) {
    const adapter = new PrismaPg({ connectionString: serverEnv.DATABASE_URL });
    _prismaClient = new PrismaClient({ adapter });
  }
  return _prismaClient;
};
