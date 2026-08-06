# Security Audit — Workout Tracker

**Scope:** authentication, data ownership, and secret handling.
**Method:** every finding below was reproduced against the running app, not inferred from reading source.
**Result:** 8 issues fixed, 2 accepted with reasoning, 1 recommended.

---

## At a glance

| #   | Finding                                                      | Severity    | Status         |
| :-- | :----------------------------------------------------------- | :---------- | :------------- |
| 1   | Passwords stored in plaintext                                | 🔴 Critical | ✅ Fixed       |
| 2   | Movements had no auth check and no owner                     | 🔴 Critical | ✅ Fixed       |
| 3   | Session key fell back to a secret published in the source    | 🔴 Critical | ✅ Fixed       |
| 4   | Database credentials fetchable by any browser                | 🟠 High     | ✅ Fixed       |
| 5   | Debug endpoint returned every user, password column included | 🟠 High     | ✅ Fixed       |
| 6   | Password hash sent to the browser on every page load         | 🟡 Medium   | ✅ Fixed       |
| 7   | Plaintext password written to server logs                    | 🟡 Medium   | ✅ Fixed       |
| 8   | Sessions cannot expire or be revoked                         | 🟡 Medium   | ⚠️ Accepted    |
| 9   | No rate limiting on authentication                           | 🟡 Medium   | 📋 Recommended |
| 10  | Session signature compared in non-constant time              | ⚪ Low      | ⚠️ Accepted    |
| 11  | `Secure` cookie flag keys off the wrong variable             | ⚪ Low      | ✅ Fixed       |

> **The pattern worth noticing:** findings 4, 5, and 6 are the same mistake three times — returning a whole
> object from the server and trusting that nobody reads the extra fields. An explicit `select` at the
> boundary is the fix in all three.

---

# 🔴 Critical

## 1 · Passwords stored in plaintext ✅

**Before**

```ts
// sign-in
if (!user || user.password !== password) {
  return { success: false, error: "Invalid email or password" };
}

// sign-up
await prisma.user.create({ data: { email, name, password } });
```

**Risk** — anyone with database access held every user's real password: a backup, a support query, a
leaked dump. Most people reuse passwords, so the blast radius extends well past this app.

**After**

```ts
const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS); // sign-up

// sign-in — always compare, even when the user doesn't exist
const passwordValid = await bcrypt.compare(password, user?.password ?? DUMMY_PASSWORD_HASH);
```

The dummy-hash comparison keeps response time flat whether or not the email is registered, so sign-in
can't be used to enumerate accounts.

**Why `bcryptjs`** — the app runs on Bun in dev but builds a Node server for production. `Bun.password`
would crash under Node; native `bcrypt` needs a C++ toolchain the slim image lacks. Pure JS behaves
identically on both.

**Verified** — signed up through the UI, read the row back: a 60-character `$2b$10$` hash. Correct
password authenticates, wrong password rejected.

---

## 2 · Movements had no auth check and no owner ✅

**Before**

```ts
export const getMovementsServerFn = createServerFn().handler(async () => {
  const prisma = await getServerSidePrismaClient();
  return prisma.movement.findMany({ orderBy: { name: "asc" } });
});
```

```prisma
model Movement {
  id   String @id @default(uuid())
  name String
  sets Set[]
}
```

**Risk** — two failures stacked. No middleware meant _no session was required at all_: anyone who could
reach the server could list or create movements. And with no `userId` on the model, the list was
global — every user saw and modified everyone else's data.

**After**

```ts
export const getMovementsServerFn = createServerFn()
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    return prisma.movement.findMany({
      where: { userId: context.user.id },
      orderBy: { name: "asc" },
    });
  });
```

```prisma
model Movement {
  userId       String
  user         User    @relation(fields: [userId], references: [id])
  isBodyweight Boolean @default(false)

  @@unique([userId, name])
}
```

Every query filters on `context.user.id` — the server's own session-derived value, never a
client-supplied id.

**Considered and rejected** — a shared global catalog where users discover each other's movements. It
needs governance for who may rename or delete an entry others depend on, plus deduplication and an
audit trail. Real complexity for data that is personal.

---

## 3 · Session key fell back to a secret published in the source ✅

**Before**

```ts
const COOKIE_SECRET = process.env.COOKIE_SECRET || "dev-secret-change-in-production";
```

**Risk** — session tokens are `"{userId}.{HMAC-SHA256(userId)}"`. Any environment that didn't set the
variable signed them with a string sitting in the repository. Knowing it, an attacker computes a valid
token for _any_ user id and becomes that user. Full authentication bypass — and silent, since nothing
in the app's behaviour reveals which key is in use.

**After**

```ts
// env.server.ts — validated once at boot
COOKIE_SECRET: z.string().min(1),   // no default: a fallback in source is a public key

// auth.server.ts
const COOKIE_SECRET = serverEnv.COOKIE_SECRET;
```

**The trade** — a deployment missing the variable now fails to start instead of running insecurely.
That's the correct direction, and it's documented in the README setup steps.

**Verified** — cold-booted on a clean port: serves normally with the secret set, and unauthenticated
requests to `/movements` still redirect.

---

# 🟠 High

## 4 · Database credentials fetchable by any browser ✅

**Before**

```ts
// unauthenticated, client-callable — returns config including database.url
export const getServerConfigServerFn = createServerFn().handler(async () => {
  return configService.getAppConfig();
});

// __root.tsx — called on every page load, result thrown away
beforeLoad: async () => {
  await getServerConfigServerFn();
  const user = await getUserServerFn();
  return { user };
},
```

**Risk** — the Postgres connection string, credentials included, was one fetch away for anyone. The
root route shipped it on every page load and discarded it, so the exposure was constant and bought
nothing.

**After** — the function is deleted; `db.server.ts` reads `DATABASE_URL` from the validated server env
directly.

**Why deletion over patching** — adding auth, or stripping the `database` field, both leave a
client-callable config endpoint whose next added field reopens the hole. The secret should never cross
that boundary at all.

---

## 5 · Debug endpoint returned every user, password column included ✅

**Before**

```ts
const getAllUsersServerFn = createServerFn().handler(async () => {
  if (configService.getAppConfig().environment === "production") throw new Error("Forbidden!");
  return prisma.user.findMany({
    select: { id: true, email: true, name: true, createdAt: true, password: true },
  });
});
```

**Risk** — a `[DEV] Print all users` button behind a guard that fails **open**: it throws only on the
exact string `"production"`, so an unset, misspelled, or `staging` environment passed straight through
and dumped the whole user table.

**After** — fixed in two steps: the guard became a fail-closed allow-list (`development`, `test` — all
else denied) and `password` left the query; then the endpoint was removed entirely, replaced by a
quick-login panel reading a static constant with no database access at all.

Once passwords are hashed, a "print all users" button can't produce a usable login anyway — so the
panel is both more useful to a reviewer and has no data-exposure surface to get wrong later.

---

# 🟡 Medium

## 6 · Password hash sent to the browser on every page load ✅

**Before**

```ts
const user = await prisma.user.findUnique({ where: { id: userId } });
return user; // every column, including `password`
```

**Risk** — the root route loads the session user, so this record was serialized into the SSR HTML _and_
returned again on every client-side navigation. Each user's bcrypt hash sat in their own page source
and network log.

It's the user's own hash, not someone else's, and bcrypt at cost 10 isn't trivially reversible — hence
Medium, not Critical. But credential material has no reason to reach the client: any XSS, malicious
extension, shared machine, or logging proxy walks away with an offline-crackable hash.

**After**

```ts
const user = await prisma.user.findUnique({
  where: { id: userId },
  select: { id: true, email: true, name: true },
});
```

**Verified** — an instrumented browser session scanned every response body and the rendered DOM for a
bcrypt prefix. Before: the SSR payload plus all three session-user responses. After: zero hits.

---

## 7 · Plaintext password written to server logs ✅

**Before**

```ts
console.log("Creating account", { email, name, password });
```

**Risk** — real passwords in stdout, which outlives the request and lands in whatever aggregates logs.
Removed.

---

## 8 · Sessions cannot expire or be revoked ⚠️ Accepted

```ts
function signUserId(userId: string) {
  const signature = crypto.createHmac("sha256", COOKIE_SECRET).update(userId).digest("hex");
  return `${userId}.${signature}`; // no timestamp, no server-tracked id
}
```

**Risk** — the signature is valid forever. The cookie's 7-day `expires` is a client-side courtesy: a
copied cookie value keeps working past it, a compromised session can't be revoked, and even a password
change doesn't invalidate it — nothing in the token derives from the password.

**Two real fixes**

| Option                                                     | Gets you                                                           | Costs                                                          |
| :--------------------------------------------------------- | :----------------------------------------------------------------- | :------------------------------------------------------------- |
| Sign an expiry into the token                              | Bounded window                                                     | Still no revocation — half a fix                               |
| Server-side `Session` table, random id, lookup per request | Revocation, "sign out everywhere", invalidation on password change | New model + migration + a query on every authenticated request |

**Why documented instead of built** — the second option is the production answer, and it changes the
auth model substantively. Landing that shape of change days before a deadline is how you ship a subtler
bug than the one you set out to fix. The first would let me claim "session expiry" while leaving
revocation unsolved. Knowing where to stop is the decision here.

---

## 9 · No rate limiting on authentication 📋 Recommended

Sign-in accepts unlimited attempts. Nothing throttles by IP or by account, so credential stuffing and
brute forcing are bounded only by bcrypt's cost. The timing work in finding 1 stops enumeration by
_response time_, but not by _volume_.

A correct fix needs a shared store — Redis, or a table for a single instance — since an in-memory
limiter resets on deploy and doesn't hold across replicas. That's infrastructure this project doesn't
have, which is why it's named rather than half-built. **It's the highest-value security work
remaining.**

---

# ⚪ Low

## 10 · Session signature compared in non-constant time ⚠️ Accepted

```ts
if (signature !== expectedSignature) return null; // short-circuits on first differing byte
```

`crypto.timingSafeEqual` is the correct primitive. Left alone deliberately: a remote timing attack
against a SHA-256 HMAC needs an enormous number of samples to clear network jitter — and the same
endpoint has no rate limiting to slow anyone down, which means **finding 9 dominates this one**. I'd
fix both together, starting with 9.

---

## 11 · `Secure` cookie flag keyed off the wrong variable ✅

**Before**

```ts
secure: process.env.NODE_ENV === "production",   // everything else reads serverEnv.ENVIRONMENT
```

**Risk** — if a deployed container's `NODE_ENV` is anything but exactly `"production"`, session
cookies go out without `Secure` and can travel over plain HTTP. Same fail-open shape as finding 3,
lower impact.

**After**

```ts
secure: serverEnv.ENVIRONMENT === "production",
```

One validated source of truth for the environment, so this can't disagree with the checks around it.

---

# Also worth knowing

**CSRF** — server functions are POST and the session cookie is `SameSite=Lax`, which blocks the classic
cross-site form attack. Not complete protection: `Lax` still permits top-level GET navigations, so any
state-changing GET would be exposed. None exist today, since every mutation is a POST server function.
If that changes, or the app grows subdomains, this needs per-request tokens.

**Authorization isn't tested** — the 30-test suite covers feature behaviour, not access control. No test
asserts that one user can't read another's movements, or that an unauthenticated call is rejected.
That's the ownership scoping from finding 2 — exactly the kind of thing a future refactor breaks
silently.

**The suite doesn't run in CI** — `cicd.yml` runs commitlint, typecheck, and the Docker build, so
nothing executes these tests on a pull request.

That typecheck job had never passed on any commit, including upstream's: it installed dependencies and
ran `tsc` without generating the Prisma client or the router's route tree, both gitignored, so every
module importing them failed to resolve. Since `build-and-push` declares `needs: [typecheck]`, the
image build never ran either. Both are fixed — CI now generates before typechecking, and the published
image starts (its `CMD` pointed at an entrypoint script that had been deleted upstream). Type errors
now gate merges; the e2e suite still doesn't run there.

---

# If I had another week

1. **Rate limiting** on sign-in and sign-up (finding 9) — biggest real-world risk reduction.
2. **Server-side sessions** with revocation (finding 8), plus rotation on password change.
3. **Authorization tests** — cross-user access denied, unauthenticated calls rejected.
4. **Run the e2e suite in CI**, so the above can't silently regress.
5. The remaining one-liner: `timingSafeEqual` (10).
