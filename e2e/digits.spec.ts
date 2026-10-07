import { expect, test } from "@playwright/test";

// SPEC-003 CA-7 on the home of SPEC-020: every element with text computes
// tabular-nums.
const routes = ["/", "/es"] as const;

for (const path of routes) {
  test(`CA-7 ${path}: every element with text computes tabular-nums`, async ({
    page,
  }) => {
    await page.goto(path);
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
    const texts = await page.evaluate(
      () =>
        [...document.body.querySelectorAll("*")].filter((el) =>
          [...el.childNodes].some(
            (n) =>
              n.nodeType === Node.TEXT_NODE && (n.textContent ?? "").trim(),
          ),
        ).length,
    );
    expect(texts).toBeGreaterThan(0);
  });
}
