import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { PrismaClient } from "./generated/client/client";
import { DEMO_ACCOUNTS } from "../src/lib/demo-accounts";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required to seed");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const BCRYPT_ROUNDS = 10;
const DAY = 24 * 60 * 60 * 1000;

type SeedSet = { movement: string; weight: number; reps: number };
// `active: true` -> an in-progress workout (completedAt: null); otherwise it is
// completed `daysAgo` days ago and appears in history.
type SeedWorkout = { daysAgo?: number; active?: boolean; sets: SeedSet[] };
type SeedContent = {
  movements: { name: string; isBodyweight: boolean }[];
  workouts: SeedWorkout[];
};

// Per-user content, keyed by email. John Doe is intentionally absent (empty account).
const CONTENT: Record<string, SeedContent> = {
  "arnold@example.com": {
    movements: [
      { name: "Bench Press", isBodyweight: false },
      { name: "Squat", isBodyweight: false },
      { name: "Deadlift", isBodyweight: false },
      { name: "Pull-ups", isBodyweight: true },
    ],
    workouts: [
      {
        daysAgo: 21,
        sets: [
          { movement: "Bench Press", weight: 60, reps: 8 },
          { movement: "Bench Press", weight: 60, reps: 8 },
          { movement: "Squat", weight: 100, reps: 5 },
          { movement: "Squat", weight: 100, reps: 5 },
        ],
      },
      {
        daysAgo: 14,
        sets: [
          { movement: "Bench Press", weight: 65, reps: 8 },
          { movement: "Bench Press", weight: 65, reps: 6 },
          { movement: "Squat", weight: 105, reps: 5 },
          { movement: "Deadlift", weight: 120, reps: 5 },
        ],
      },
      {
        daysAgo: 7,
        sets: [
          { movement: "Bench Press", weight: 70, reps: 6 },
          { movement: "Squat", weight: 110, reps: 5 },
          { movement: "Deadlift", weight: 130, reps: 5 },
          { movement: "Pull-ups", weight: 0, reps: 12 },
        ],
      },
      {
        // In-progress workout so Arnold has a "current workout" as well as history.
        active: true,
        sets: [
          { movement: "Bench Press", weight: 72, reps: 5 },
          { movement: "Squat", weight: 115, reps: 5 },
        ],
      },
    ],
  },
  "ronnie@example.com": {
    movements: [
      { name: "Bench Press", isBodyweight: false },
      { name: "Squat", isBodyweight: false },
      { name: "Deadlift", isBodyweight: false },
      { name: "Barbell Row", isBodyweight: false },
    ],
    workouts: [
      {
        daysAgo: 20,
        sets: [
          { movement: "Bench Press", weight: 100, reps: 5 },
          { movement: "Squat", weight: 180, reps: 5 },
          { movement: "Deadlift", weight: 200, reps: 5 },
        ],
      },
      {
        daysAgo: 12,
        sets: [
          { movement: "Bench Press", weight: 110, reps: 5 },
          { movement: "Squat", weight: 190, reps: 5 },
          { movement: "Deadlift", weight: 220, reps: 3 },
          { movement: "Barbell Row", weight: 80, reps: 8 },
        ],
      },
      {
        daysAgo: 4,
        sets: [
          { movement: "Bench Press", weight: 120, reps: 3 },
          { movement: "Squat", weight: 200, reps: 5 },
          { movement: "Deadlift", weight: 240, reps: 3 },
          { movement: "Barbell Row", weight: 85, reps: 8 },
        ],
      },
    ],
  },
  "john@example.com": { movements: [], workouts: [] },
};

async function seedAccount(account: (typeof DEMO_ACCOUNTS)[number]) {
  // Idempotent: remove any existing demo user (and its data) first.
  const existing = await prisma.user.findUnique({ where: { email: account.email } });
  if (existing) {
    await prisma.set.deleteMany({ where: { workout: { userId: existing.id } } });
    await prisma.workout.deleteMany({ where: { userId: existing.id } });
    await prisma.movement.deleteMany({ where: { userId: existing.id } });
    await prisma.user.delete({ where: { id: existing.id } });
  }

  const password = await bcrypt.hash(account.password, BCRYPT_ROUNDS);
  const user = await prisma.user.create({
    data: { email: account.email, name: account.name, password },
  });

  const content = CONTENT[account.email] ?? { movements: [], workouts: [] };

  const movementIdByName: Record<string, string> = {};
  for (const m of content.movements) {
    const created = await prisma.movement.create({
      data: { name: m.name, isBodyweight: m.isBodyweight, userId: user.id },
    });
    movementIdByName[m.name] = created.id;
  }

  for (const w of content.workouts) {
    const workout = await prisma.workout.create({
      data: {
        userId: user.id,
        completedAt: w.active ? null : new Date(Date.now() - (w.daysAgo ?? 0) * DAY),
      },
    });
    for (const s of w.sets) {
      await prisma.set.create({
        data: {
          workoutId: workout.id,
          movementId: movementIdByName[s.movement],
          reps: s.reps,
          weight: s.weight,
        },
      });
    }
  }

  console.log(
    `Seeded ${account.email} — ${content.movements.length} movements, ${content.workouts.length} workouts`,
  );
}

async function main() {
  for (const account of DEMO_ACCOUNTS) {
    await seedAccount(account);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
