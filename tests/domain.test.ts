import { describe, it, expect } from "vitest";
import { applicationSchema, allowedNext, safeNext } from "../lib/domain";
const base = {
  product: "tip",
  applicant_role: "guardian",
  beneficiary_name: "김참여",
  contact: "010-1234-5678",
  environment: "실내 타일 바닥",
  problem: "지팡이 끝이 자주 미끄러져요",
  consent: true,
  measurements: {
    shaft_diameter_mm: 19,
    contact_diameter_mm: 40,
    insertion_depth_mm: 30,
  },
};
describe("신청 검증", () => {
  it("제품별 치수·대리 신청을 허용한다", () =>
    expect(applicationSchema.safeParse(base).success).toBe(true));
  it.each([0, -1, NaN, 10001])("잘못된 치수 %s를 거부한다", (v) =>
    expect(
      applicationSchema.safeParse({
        ...base,
        measurements: { ...base.measurements, shaft_diameter_mm: v },
      }).success,
    ).toBe(false),
  );
  it("동의와 필수 치수를 요구한다", () => {
    expect(
      applicationSchema.safeParse({ ...base, consent: false }).success,
    ).toBe(false);
    expect(
      applicationSchema.safeParse({
        ...base,
        measurements: { shaft_diameter_mm: 19 },
      }).success,
    ).toBe(false);
  });
  it("관리자 가입 역할을 거부한다", () =>
    expect(
      applicationSchema.safeParse({ ...base, applicant_role: "admin" }).success,
    ).toBe(false));
});
describe("흐름", () => {
  it("단계를 건너뛰는 선택지를 제공하지 않는다", () =>
    expect(allowedNext("submitted")).toEqual(["measuring", "rejected"]));
  it("종료 상태는 변경 불가", () => expect(allowedNext("closed")).toEqual([]));
  it.each(["https://evil.test", "//evil.test", "/\\evil.test"])(
    "외부 리다이렉트 %s 차단",
    (v) => expect(safeNext(v)).toBe("/applications"),
  );
});
