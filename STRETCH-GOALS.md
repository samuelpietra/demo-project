# Stretch Goal Notes

Answers to the two design questions in the README's stretch goals. The security
stretch goal is covered separately in [SECURITY-AUDIT.md](./SECURITY-AUDIT.md).

---

## Nutrition tracking

**Model:** one row per food entry, plus a target to compare against.

```prisma
model FoodEntry {
  id       String   @id @default(uuid())
  userId   String
  name     String // free text at MVP
  loggedAt DateTime @default(now())
  calories Int
  protein  Float // grams
  carbs    Float
  fat      Float

  @@index([userId, loggedAt])
}

model NutritionTarget {
  id       String @id @default(uuid())
  userId   String @unique
  calories Int
  protein  Float
  carbs    Float
  fat      Float
}
```

Daily totals are a `groupBy` over the entry date, not a stored rollup — rollups need
invalidating on every edit, and the raw rows are what users want to correct.

**Surplus / deficit** needs both intake and expenditure. Intake is a sum; expenditure
is the real question, and there are three honest options:

1. **A user-set daily target.** Surplus = `sum(calories) − target`. Transparent, no
   junk science. I'd ship this first.
2. **Estimate TDEE from profile** (Mifflin-St Jeor). Needs height, age, sex — new
   fields — and presents a model with real error bars as a number.
3. **Infer from the observed weight trend** (~7700 kcal per kg). Self-correcting, and
   uniquely possible here because weight tracking already exists, but it needs weeks
   of data before it says anything.

Ship 1, layer 3 as an "estimated actual" once there's history, keep 2 for new users.

Everything else reuses what's already here: per-user scoping, `authMiddleware`, Zod
validators, and the same Recharts time-series setup. The hard part isn't the schema —
it's food data entry, which in a real product means a food database and barcode
lookup. That's an integration problem, not a modelling one.

---

## What the current schema gets wrong

- **`Workout` has no index**, though both hot queries filter on `userId` +
  `completedAt` (history: `not: null`, current: `null`). Sequential scan plus a sort.
- **Foreign keys are unindexed.** Postgres doesn't create them automatically the way
  MySQL does, so `Set.workoutId` and `Set.movementId` scan.
- **`Set` has no ordering column.** Sets are shown "in the order they were added", but
  nothing records that order — the query has no `ORDER BY` and relies on Postgres
  returning heap order, which is not guaranteed.
- **`Workout` has no start time**, and `getCurrentWorkoutServerFn` compensates with
  `orderBy: { id: "desc" }` under a comment reading "most recent". The ids are random
  UUIDs, so that sort means nothing; it's harmless only because a user has at most one
  active workout.
- **The history query is unbounded** — every completed workout with every set, loaded
  so the browser can aggregate a chart. Right at demo scale, linear growth forever.

In order: add the indexes, add `Set.createdAt` and `Workout.startedAt` and sort
explicitly, paginate history on a `completedAt` cursor, then move the progression
aggregation into SQL (`date_trunc` + `MAX`/`SUM`, three numbers per day instead of
every set).

---

## Admin boards

- **Authorization first.** A `role` on `User` and an `adminMiddleware` beside
  `authMiddleware`. Admin queries are the one place the per-user scoping rule is
  deliberately lifted, so the guard must be explicit and tested.
- **Aggregate in the database**, never in JavaScript — `groupBy` for per-user counts,
  window functions for trends, `COUNT(*) OVER ()` for totals alongside a page.
- **Precompute what's expensive.** "Total volume lifted per user" across every set is a
  materialized view on a schedule, not a live query per page load. Minutes-stale is
  fine for a dashboard; a five-second query is not.
- **Keyset pagination, not `OFFSET`.** `OFFSET 10000` walks 10,000 rows to discard
  them; seeking past the last `(created_at, id)` stays flat.
