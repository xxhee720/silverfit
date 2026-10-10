import { expect, it } from "vitest";
import { estimateLength } from "../lib/photo-measurement";
it("가로·세로 이미지 실제 픽셀 비율로 mm 계산", () => {
  expect(
    estimateLength(
      [
        { x: 0, y: 0 },
        { x: 0.5, y: 0 },
        { x: 0, y: 0 },
        { x: 0, y: 0.5 },
      ],
      1000,
      2000,
      100,
    ),
  ).toBe(200);
});
it("가까운 지점·누락된 지점·잘못된 기준 길이 차단", () => {
  expect(() =>
    estimateLength(
      [
        { x: 0, y: 0 },
        { x: 0.001, y: 0 },
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ],
      1000,
      1000,
      100,
    ),
  ).toThrow();
  expect(() => estimateLength([], 1000, 1000, 100)).toThrow();
  expect(() =>
    estimateLength(
      [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ],
      1000,
      1000,
      NaN,
    ),
  ).toThrow();
});
