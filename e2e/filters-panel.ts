import { expect, type Page } from "@playwright/test";

// SPEC-082 CA-4, CA-9: on mobile the pills and «Ligas» are folded behind
// the filters button; a test that uses them opens the panel first. On
// desktop, and without JavaScript, the button is not painted and the panel
// is always shown, so this does nothing.
export async function openFilters(page: Page): Promise<void> {
  const toggle = page.getByTestId("filters-toggle");
  if (!(await toggle.isVisible())) return;
  // Until hydration the button has no handler: try again until it opens.
  await expect(async () => {
    if ((await toggle.getAttribute("aria-expanded")) !== "true")
      await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true", {
      timeout: 1_000,
    });
  }).toPass({ timeout: 15_000 });
}
