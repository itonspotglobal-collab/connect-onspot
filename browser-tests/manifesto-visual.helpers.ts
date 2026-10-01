import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import type { Page } from "playwright";

// Only small channel-level rasterization noise is tolerated. No geometry,
// content, backgrounds, or regions are masked out.
export async function compareScreenshots(
  page: Page,
  expected: Buffer,
  actual: Buffer,
  label: string,
): Promise<void> {
  const result = await page.evaluate(async ({ expected, actual }) => {
    async function decode(base64: string) {
      const image = new Image();
      image.src = `data:image/png;base64,${base64}`;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(image, 0, 0);
      return { canvas, ctx, pixels: ctx.getImageData(0, 0, image.width, image.height) };
    }
    const a = await decode(expected);
    const b = await decode(actual);
    if (a.canvas.width !== b.canvas.width || a.canvas.height !== b.canvas.height) {
      return {
        error: `Screenshot dimensions differ: reference ${a.canvas.width}x${a.canvas.height}, app ${b.canvas.width}x${b.canvas.height}`,
        changed: 0, total: 0, diff: "",
      };
    }
    let changed = 0;
    for (let i = 0; i < a.pixels.data.length; i += 4) {
      const different = [0, 1, 2, 3].some(
        (channel) => Math.abs(a.pixels.data[i + channel] - b.pixels.data[i + channel]) > 16,
      );
      if (different) changed++;
      a.pixels.data.set(different ? [255, 0, 80, 255] : [0, 0, 0, 255], i);
    }
    a.ctx.putImageData(a.pixels, 0, 0);
    return {
      error: "", changed, total: a.canvas.width * a.canvas.height,
      diff: a.canvas.toDataURL("image/png").split(",")[1],
    };
  }, { expected: expected.toString("base64"), actual: actual.toString("base64") });

  // At most 0.005% (roughly 140 pixels per desktop full-page image).
  const passed = !result.error && result.changed / result.total <= 0.00005;
  if (!passed) {
    const dir = "browser-tests/results/manifesto";
    await mkdir(dir, { recursive: true });
    await Promise.all([
      writeFile(`${dir}/${label}-reference.png`, expected),
      writeFile(`${dir}/${label}-actual.png`, actual),
      ...(result.diff ? [writeFile(`${dir}/${label}-diff.png`, Buffer.from(result.diff, "base64"))] : []),
    ]);
  }
  assert.ok(passed, `${label}: ${result.error || `${result.changed}/${result.total} pixels differ beyond the antialias tolerance`}; see browser-tests/results/manifesto`);
}

// Compare the full reading rhythm independently of pixels so even tiny shifts
// cannot be hidden by a large full-page screenshot's mismatch budget.
export async function layout(page: Page, reference = false) {
  return page.evaluate((reference) => {
    const selectors = reference
      ? [".wrap", ".headline", ".row", ".back-link", ".lead", ".wrap > p:not(.lead)", ".emphasis", "ul", "li", ".divider", ".signature", ".signature .line", ".signature .role", ".closing", ".closing p", ".closing a"]
      : [".manifesto-wrap", ".manifesto-headline", ".manifesto-headline-row", ".manifesto-about-link", ".manifesto-lead", ".manifesto-copy", ".manifesto-emphasis", ".manifesto-freedoms", ".manifesto-freedoms li", ".manifesto-divider", ".manifesto-signature", ".manifesto-signature-line", ".manifesto-signature-role", ".manifesto-closing", ".manifesto-closing-copy", ".manifesto-closing-link"];
    return selectors.map((selector) => [...document.querySelectorAll(selector)].map((el) => {
      const rect = el.getBoundingClientRect();
      const css = getComputedStyle(el);
      return {
        // React omits the HTML reference's indentation between children.
        // Assert copy at each leaf; containers are geometry/style checks.
        text: el.children.length ? null : el.textContent?.trim().replace(/\s+/g, " "),
        rect: [rect.x, rect.y, rect.width, rect.height],
        style: [css.fontSize, css.fontWeight, css.lineHeight, css.letterSpacing,
          css.color, css.opacity, css.marginTop, css.marginBottom, css.paddingTop,
          css.paddingRight, css.paddingBottom, css.paddingLeft, css.backgroundColor,
          css.borderRadius],
      };
    }));
  }, reference);
}

export async function assertDesktopLayout(app: Page, reference: Page) {
  const expected = await layout(reference, true);
  const actual = await layout(app);
  assert.equal(actual.length, expected.length);
  actual.forEach((group, i) => {
    assert.equal(group.length, expected[i].length, `section ${i}: element count`);
    group.forEach((el, j) => {
      const target = expected[i][j];
      assert.equal(el.text, target.text, `section ${i}/${j}: approved copy`);
      assert.deepEqual(el.style, target.style, `section ${i}/${j}: typography/spacing/color`);
      el.rect.forEach((value, axis) => assert.ok(
        Math.abs(value - target.rect[axis]) <= 0.1,
        `section ${i}/${j}, axis ${axis}: ${value} != ${target.rect[axis]}`,
      ));
    });
  });
}