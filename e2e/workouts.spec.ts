import { test, expect, type Page } from "@playwright/test";
import { clickAndWaitForServerFn, completeWorkout, createAccount, startWorkout } from "./helpers";

// Start and complete a workout, returning to the no-active-workout state.
async function createCompletedWorkout(page: Page) {
  await page.goto("/current-workout");
  await page.waitForLoadState("networkidle");
  await startWorkout(page);
  await completeWorkout(page);
  await expect(page.getByText(/No active workout/i)).toBeVisible();
}

test.describe("Workouts", () => {
  test.beforeEach(async ({ page }) => {
    // createAccount lands on /current-workout with no active workout.
    await createAccount(page);
  });

  test.describe("create", () => {
    test("should start a new workout from the current workout page", async ({ page }) => {
      await startWorkout(page);
      await expect(page.getByRole("button", { name: /Complete Workout/i })).toBeVisible();
    });

    test("should show the workout date after starting", async ({ page }) => {
      await startWorkout(page);
      const today = new Date().toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      await expect(page.getByText(today)).toBeVisible();
    });
  });

  test.describe("read", () => {
    test("should display the current active workout", async ({ page }) => {
      await startWorkout(page);
      await page.reload();
      await page.waitForLoadState("networkidle");
      await expect(page.getByRole("combobox")).toBeVisible();
      await expect(page.getByRole("button", { name: /Complete Workout/i })).toBeVisible();
    });

    test("should show 'No active workout' when none exists", async ({ page }) => {
      await expect(page.getByText(/No active workout/i)).toBeVisible();
    });

    test("should display completed workouts in workout history", async ({ page }) => {
      await createCompletedWorkout(page);
      await page.goto("/workout-history");
      await page.waitForLoadState("networkidle");
      await expect(page.locator("tbody tr")).toHaveCount(1);
    });
  });

  test.describe("complete", () => {
    test("should mark the current workout as completed", async ({ page }) => {
      await startWorkout(page);
      await completeWorkout(page);
      await expect(page.getByText(/No active workout/i)).toBeVisible();
    });

    test("should move completed workout to history", async ({ page }) => {
      await createCompletedWorkout(page);
      await page.goto("/workout-history");
      await page.waitForLoadState("networkidle");
      await expect(page.locator("tbody tr")).toHaveCount(1);
    });
  });

  test.describe("delete", () => {
    test("should delete selected workouts from history", async ({ page }) => {
      await createCompletedWorkout(page);
      await page.goto("/workout-history");
      await page.waitForLoadState("networkidle");
      await page.locator("tbody tr").first().locator('input[type="checkbox"]').check();
      await clickAndWaitForServerFn(page, page.getByRole("button", { name: /Delete Selected/i }));
      await expect(page.getByText(/No completed workouts/i)).toBeVisible();
    });

    test("should allow selecting multiple workouts for deletion", async ({ page }) => {
      await createCompletedWorkout(page);
      await createCompletedWorkout(page);
      await page.goto("/workout-history");
      await page.waitForLoadState("networkidle");
      await expect(page.locator("tbody tr")).toHaveCount(2);
      await page.locator("thead input[type='checkbox']").check();
      await expect(page.getByRole("button", { name: /Delete Selected \(2\)/ })).toBeVisible();
    });
  });
});
