import { expect, test } from "@playwright/test";

const routes = ["/", "/es"] as const;

for (const path of routes) {
  test(`CA-7 ${path}: every element with text computes tabular-nums`, async ({
    page,
  }) => {
    await page.goto(path);
    const named = ["logo", "h1", "main p", "footer a"] as const;
    for (const selector of named) {
      const locator =
        selector === "logo" ? page.getByTestId("logo") : page.locator(selector);
      await expect(locator, selector).toHaveCSS(
        "font-variant-numeric",
        "tabular-nums",
      );
    }
    const offenders = await page.evaluate(() =>
      [...document.body.querySelectorAll("*")]
        .filter(
          (el) =>
            !["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE"].includes(el.tagName) &&
            [...el.childNodes].some(
              (node) =>
                node.nodeType === Node.TEXT_NODE &&
                (node.textContent ?? "").trim() !== "",
            ) &&
            getComputedStyle(el).fontVariantNumeric !== "tabular-nums",
        )
        .map((el) => `${el.tagName.toLowerCase()}.${el.className}`),
    );
    expect(offenders).toEqual([]);
  });
}
