import { test, expect } from "@playwright/test";
import { addMovement, clickAndWaitForServerFn, createAccount, startWorkout } from "./helpers";

const weightField = 'input[placeholder="Weight (lbs)"]';
const setWeightField = 'input[placeholder="Weight"]';

/** Log a weight entry from the Weight page (assumes we're on /weight). */
async function logWeight(page: import("@playwright/test").Page, value: string) {
  await page.fill(weightField, value);
  await expect(page.getByRole("button", { name: /^Log$/i })).toBeEnabled();
  await clickAndWaitForServerFn(page, page.getByRole("button", { name: /^Log$/i }));
}

test.describe("Weight", () => {
  test.beforeEach(async ({ page }) => {
    await createAccount(page);
    await page.goto("/weight");
    await page.waitForLoadState("networkidle");
  });

  test.describe("create", () => {
    test("should show an empty state before any weight is logged", async ({ page }) => {
      await expect(page.getByText(/No weight logged yet/i)).toBeVisible();
    });

    test("should log a weight entry and show it as the latest", async ({ page }) => {
      await logWeight(page, "180");
      await expect(page.getByText(/Latest:/i)).toContainText("180");
    });

    test("should keep decimal precision", async ({ page }) => {
      // body weight is a Float, unlike Set.weight which is an Int for plate loads
      await logWeight(page, "180.5");
      await expect(page.getByText(/Latest:/i)).toContainText("180.5");
    });

    test("should replace the empty state with a history chart", async ({ page }) => {
      await logWeight(page, "180");
      await expect(page.getByText(/No weight logged yet/i)).toBeHidden();
      await expect(page.locator(".recharts-wrapper")).toBeVisible();
    });
  });

  test.describe("body-weight movement default", () => {
    test.beforeEach(async ({ page }) => {
      await logWeight(page, "175.5");
      await expect(page.getByText(/Latest:/i)).toContainText("175.5");

      await page.goto("/movements");
      await page.waitForLoadState("networkidle");
      await addMovement(page, "Pull Up", true);
      await addMovement(page, "Bench Press", false);

      await page.goto("/current-workout");
      await page.waitForLoadState("networkidle");
      await startWorkout(page);
    });

    test("should default the weight to the latest weigh-in for a body-weight movement", async ({ page }) => {
      await page.getByRole("combobox").selectOption({ label: "Pull Up" });
      await expect(page.locator(setWeightField)).toHaveValue("175.5");
    });

    test("should clear the weight for a movement that is not body-weight", async ({ page }) => {
      await page.getByRole("combobox").selectOption({ label: "Pull Up" });
      await expect(page.locator(setWeightField)).toHaveValue("175.5");

      await page.getByRole("combobox").selectOption({ label: "Bench Press" });
      await expect(page.locator(setWeightField)).toHaveValue("");
    });

    test("should leave the defaulted weight editable", async ({ page }) => {
      // weighted body-weight variations (weighted pull-ups) need this
      await page.getByRole("combobox").selectOption({ label: "Pull Up" });
      await expect(page.locator(setWeightField)).toHaveValue("175.5");

      await page.fill(setWeightField, "200");
      await expect(page.locator(setWeightField)).toHaveValue("200");
    });
  });
});
