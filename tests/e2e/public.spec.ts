import { test, expect } from "@playwright/test";
test("홈과 제품별 신청 흐름, 모바일 가로 넘침 없음", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "일상에 맞추는, 더 편안한 이동" }),
  ).toBeVisible();
  await page.screenshot({
    path: `docs/screenshots/home-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.getByRole("link", { name: /미끄럼 방지 지팡이 팁/ }).click();
  await expect(
    page.getByRole("heading", { name: "새 보조장치 신청" }),
  ).toBeVisible();
  await expect(page.getByLabel("지팡이 외경")).toBeVisible();
  await page.screenshot({
    path: `docs/screenshots/application-${test.info().project.name}.png`,
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("인증 전 개인·관리자 화면 접근은 로그인으로 이동", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/auth/);
  await page.goto("/applications");
  await expect(page).toHaveURL(/\/auth/);
});
