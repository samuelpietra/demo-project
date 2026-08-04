import { test, expect } from "@playwright/test";
import { addMovement, clickAndWaitForServerFn, createAccount } from "./helpers";

test.describe("Movements", () => {
  test.beforeEach(async ({ page }) => {
    await createAccount(page);
    await page.goto("/movements");
    await page.waitForLoadState("networkidle");
  });

  test.describe("create", () => {
    test("should create a new movement with a valid name", async ({ page }) => {
      await addMovement(page, "Bench Press");
      await expect(page.getByRole("listitem").filter({ hasText: "Bench Press" })).toBeVisible();
    });

    test("should show the new movement in the movements list", async ({ page }) => {
      await addMovement(page, "Squat");
      await expect(page.getByRole("listitem")).toHaveCount(1);
      await expect(page.getByRole("listitem").filter({ hasText: "Squat" })).toBeVisible();
    });

    test("should clear the input after creating a movement", async ({ page }) => {
      await addMovement(page, "Deadlift");
      await expect(page.locator('input[placeholder*="Movement name"]')).toHaveValue("");
    });
  });

  test.describe("read", () => {
    test("should display all movements on the movements page", async ({ page }) => {
      await addMovement(page, "Bench Press");
      await addMovement(page, "Squat");
      await expect(page.getByRole("listitem")).toHaveCount(2);
      await expect(page.getByRole("listitem").filter({ hasText: "Bench Press" })).toBeVisible();
      await expect(page.getByRole("listitem").filter({ hasText: "Squat" })).toBeVisible();
    });

    test("should show movements sorted alphabetically", async ({ page }) => {
      await addMovement(page, "Zercher Squat");
      await addMovement(page, "Ab Wheel");
      const items = page.getByRole("listitem");
      await expect(items.first()).toContainText("Ab Wheel");
      await expect(items.last()).toContainText("Zercher Squat");
    });
  });

  test.describe("delete", () => {
    test("should delete an existing movement", async ({ page }) => {
      await addMovement(page, "Overhead Press");
      const row = page.getByRole("listitem").filter({ hasText: "Overhead Press" });
      await clickAndWaitForServerFn(page, row.getByRole("button"));
      await expect(row).toHaveCount(0);
    });

    test("should remove the movement from the list after deletion", async ({ page }) => {
      await addMovement(page, "Lunge");
      await addMovement(page, "Plank");
      const lunge = page.getByRole("listitem").filter({ hasText: "Lunge" });
      await clickAndWaitForServerFn(page, lunge.getByRole("button"));
      await expect(lunge).toHaveCount(0);
      await expect(page.getByRole("listitem").filter({ hasText: "Plank" })).toBeVisible();
    });
  });
});
