import { test, expect } from "@playwright/test";
import { addMovement, addSet, clickAndWaitForServerFn, createAccount, startWorkout, clickAndConfirm } from "./helpers";

test.describe("Sets", () => {
  test.beforeEach(async ({ page }) => {
    await createAccount(page);
    await page.goto("/movements");
    await page.waitForLoadState("networkidle");
    await addMovement(page, "Bench Press");
    await addMovement(page, "Squat");
    await page.goto("/current-workout");
    await page.waitForLoadState("networkidle");
    await startWorkout(page);
  });

  test.describe("create", () => {
    test("should add a set to the current workout", async ({ page }) => {
      await addSet(page, "Bench Press", 100, 5);
      await expect(page.getByRole("listitem").filter({ hasText: "Bench Press" })).toBeVisible();
    });

    test("should require movement, weight, and reps to add a set", async ({ page }) => {
      const addButton = page.locator('button[type="submit"]');
      await expect(addButton).toBeDisabled();
      await page.getByRole("combobox").selectOption({ label: "Bench Press" });
      await expect(addButton).toBeDisabled();
      await page.fill('input[placeholder="Weight"]', "100");
      await expect(addButton).toBeDisabled();
      await page.fill('input[placeholder="Reps"]', "5");
      await expect(addButton).toBeEnabled();
    });

    test("should display the new set in the workout", async ({ page }) => {
      await addSet(page, "Bench Press", 135, 8);
      const row = page.getByRole("listitem").filter({ hasText: "Bench Press" });
      await expect(row).toContainText("8 reps");
      await expect(row).toContainText("135 lbs");
    });
  });

  test.describe("read", () => {
    test("should display sets with movement name, weight, and reps", async ({ page }) => {
      await addSet(page, "Squat", 225, 3);
      const row = page.getByRole("listitem").filter({ hasText: "Squat" });
      await expect(row).toContainText("Squat");
      await expect(row).toContainText("3 reps");
      await expect(row).toContainText("225 lbs");
    });

    test("should show sets in the order they were added", async ({ page }) => {
      await addSet(page, "Bench Press", 100, 5);
      await expect(page.getByRole("listitem").filter({ hasText: "Bench Press" })).toBeVisible();
      await addSet(page, "Squat", 80, 8);
      await expect(page.getByRole("listitem").filter({ hasText: "Squat" })).toBeVisible();
      const items = page.getByRole("listitem");
      await expect(items.first()).toContainText("Bench Press");
      await expect(items.last()).toContainText("Squat");
    });
  });

  test.describe("delete", () => {
    test("should remove a set from the current workout", async ({ page }) => {
      await addSet(page, "Bench Press", 100, 5);
      const row = page.getByRole("listitem").filter({ hasText: "Bench Press" });
      await expect(row).toBeVisible();
      await clickAndConfirm(page, row.getByRole("button"));
      await expect(row).toHaveCount(0);
    });

    test("should update the sets list after deletion", async ({ page }) => {
      await addSet(page, "Bench Press", 100, 5);
      await expect(page.getByRole("listitem").filter({ hasText: "Bench Press" })).toBeVisible();
      await addSet(page, "Squat", 80, 8);
      await expect(page.getByRole("listitem").filter({ hasText: "Squat" })).toBeVisible();
      const bench = page.getByRole("listitem").filter({ hasText: "Bench Press" });
      await clickAndConfirm(page, bench.getByRole("button"));
      await expect(bench).toHaveCount(0);
      await expect(page.getByRole("listitem").filter({ hasText: "Squat" })).toBeVisible();
    });
  });
});
