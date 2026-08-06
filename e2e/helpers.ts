import { type Page, type Locator, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";

/**
 * Click a control and confirm its server-function request was dispatched.
 *
 * A hydrated handler fires the request immediately, so a short window is enough.
 * If none fires, the click landed before React hydrated — retry once. We wait on
 * the request (not the response) so a slow-but-working call is never double-clicked.
 */
export async function clickAndWaitForServerFn(page: Page, locator: Locator) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const requested = page.waitForRequest((r) => r.url().includes("/_serverFn/"), { timeout: 3_000 }).catch(() => null);
    await locator.click();
    if (await requested) return;
    await page.waitForTimeout(300);
  }
}

/**
 * Click a control that opens a confirmation dialog, then confirm it.
 *
 * The trigger only sets state, so it fires no request to wait on — retry it
 * until the dialog appears, then treat the confirm button as a normal
 * server-function click.
 */
export async function clickAndConfirm(page: Page, trigger: Locator, confirmName: RegExp = /^Delete$/) {
  const dialog = page.getByRole("dialog");
  for (let attempt = 0; attempt < 2; attempt++) {
    await trigger.click();
    const appeared = await dialog
      .waitFor({ state: "visible", timeout: 2_000 })
      .then(() => true)
      .catch(() => false);
    if (appeared) break;
  }
  await expect(dialog).toBeVisible();
  await clickAndWaitForServerFn(page, dialog.getByRole("button", { name: confirmName }));
}

/** Create a fresh, unique account and land authenticated on the app. */
export async function createAccount(page: Page): Promise<string> {
  const email = `e2e-${randomUUID()}@example.com`;
  await page.goto("/create-account");
  await page.waitForLoadState("networkidle");
  await page.fill("#name", "E2E User");
  await page.fill("#email", email);
  await page.fill("#password", "password123");
  await clickAndWaitForServerFn(page, page.locator('button[type="submit"]'));
  await expect(page).toHaveURL(/\/current-workout/);
  return email;
}

/** Create a movement from the Movements page (assumes we're on /movements). */
export async function addMovement(page: Page, name: string, bodyweight = false) {
  await page.fill('input[placeholder*="Movement name"]', name);
  if (bodyweight) await page.check('input[type="checkbox"]');
  await clickAndWaitForServerFn(page, page.locator('button[type="submit"]'));
  await expect(page.getByRole("listitem").filter({ hasText: name })).toBeVisible();
}

/** Start a workout from the Current Workout page. */
export async function startWorkout(page: Page) {
  await clickAndWaitForServerFn(page, page.getByRole("button", { name: /Start Workout/i }));
  await expect(page.getByRole("combobox")).toBeVisible();
}

/** Add a set to the active workout (assumes a workout is in progress). */
export async function addSet(page: Page, movementName: string, weight: number, reps: number) {
  await page.getByRole("combobox").selectOption({ label: movementName });
  await page.fill('input[placeholder="Weight"]', String(weight));
  await page.fill('input[placeholder="Reps"]', String(reps));
  await clickAndWaitForServerFn(page, page.locator('button[type="submit"]'));
}

/** Complete the active workout. */
export async function completeWorkout(page: Page) {
  await clickAndConfirm(page, page.getByRole("button", { name: /Complete Workout/i }), /^Complete$/);
}
