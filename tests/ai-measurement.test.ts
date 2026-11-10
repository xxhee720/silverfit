import { describe, expect, it } from "vitest";
import { aiResultSchema } from "../lib/ai-measurement";
const good = {
  status: "estimated",
  model: "test-model",
  box: [0.1, 0.1, 0.5, 0.6],
  visible_width_mm: 100,
  visible_height_mm: 200,
  detection_score: 0.8,
  warnings: ["실측 필요"],
};
describe("AI 추정 결과 계약", () => {
  it("대상 감지 점수와 추정값을 별도로 보관한다", () =>
    expect(aiResultSchema.parse(good).detection_score).toBe(0.8));
  it.each([
    { ...good, box: [0.8, 0, 0.2, 1] },
    { ...good, visible_width_mm: -1 },
    { ...good, visible_height_mm: Infinity },
    { ...good, status: "needs_measurement" },
    { ...good, box: null },
  ])("부적절한 크기·영역·불확실 결과를 거부한다", (r) =>
    expect(aiResultSchema.safeParse(r).success).toBe(false),
  );
  it("추정할 수 없으면 치수 없는 응답만 허용한다", () =>
    expect(
      aiResultSchema.safeParse({
        ...good,
        status: "needs_measurement",
        box: null,
        visible_width_mm: null,
        visible_height_mm: null,
        detection_score: null,
      }).success,
    ).toBe(true));
});
