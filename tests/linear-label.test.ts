import { expect, it } from "vitest";
import { barcodeSvg } from "../src/features/linear-label";

it("encodes A between Code 39 start and stop symbols with quiet zones", () => {
  const svg = barcodeSvg("A")!;
  const bars = Array.from(
    svg.matchAll(/<rect x="(\d+)" y="2" width="(\d+)"/g),
    (match) => [Number(match[1]), Number(match[2])],
  );
  const widths = bars.flatMap(([x, width], index) =>
    index + 1 < bars.length ? [width, bars[index + 1][0] - x - width] : [width],
  );
  expect(widths.join("")).toBe(
    ["131131311", "1", "311113113", "1", "131131311"].join(""),
  );
  expect(bars[0][0]).toBe(10);
  expect(svg).toContain('viewBox="0 0 67 56"');
});

it("rejects reserved symbols, overlong values and unsupported characters", () => {
  for (const value of ["", "*", "lot", "<", "1".repeat(65)])
    expect(barcodeSvg(value)).toBeNull();
  expect(barcodeSvg("2531/A3")).toBeTruthy();
});
