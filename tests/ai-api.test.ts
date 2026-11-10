import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mock = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  supabase: async () => ({ auth: { getUser: mock.getUser }, rpc: mock.rpc }),
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ auth: { getUser: mock.getUser }, rpc: mock.rpc }),
}));
import { POST } from "../app/api/measurements/analyze/route";
function request(consent = "true", bearer = true) {
  const form = new FormData();
  form.set(
    "photo",
    new File([new Uint8Array([255, 216, 255])], "test.jpeg", {
      type: "image/jpeg",
    }),
  );
  form.set("product", "ramp");
  form.set("consent", consent);
  return new NextRequest("https://silverfit.test/api/measurements/analyze", {
    method: "POST",
    headers: bearer
      ? { authorization: "Bearer test-access-token" }
      : { origin: "https://other.test" },
    body: form,
  });
}
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "public-key");
  vi.stubEnv("MEASUREMENT_AI_URL", "https://inference.test");
  vi.stubEnv("MEASUREMENT_AI_TOKEN", "server-only-token");
  mock.getUser.mockResolvedValue({
    data: { user: { id: "user" } },
    error: null,
  });
  mock.rpc.mockResolvedValue({ data: "reservation", error: null });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
describe("사진 AI API", () => {
  it("다른 출처의 쿠키 요청을 거부한다", async () => {
    expect((await POST(request("true", false))).status).toBe(403);
    expect(mock.getUser).not.toHaveBeenCalled();
  });
  it("비로그인 요청을 거부한다", async () => {
    mock.getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect((await POST(request())).status).toBe(401);
  });
  it("모델 연결 전에는 가짜 결과를 제공하지 않는다", async () => {
    vi.stubEnv("MEASUREMENT_AI_URL", "");
    expect((await POST(request())).status).toBe(503);
    expect(mock.rpc).not.toHaveBeenCalled();
  });
  it("동의 없이 사진을 외부로 보내지 않는다", async () => {
    const network = vi.fn();
    vi.stubGlobal("fetch", network);
    expect((await POST(request("false"))).status).toBe(400);
    expect(network).not.toHaveBeenCalled();
  });
  it("할당량 초과 시 추론을 시작하지 않는다", async () => {
    mock.rpc.mockResolvedValue({ error: { message: "quota" } });
    const network = vi.fn();
    vi.stubGlobal("fetch", network);
    expect((await POST(request())).status).toBe(429);
    expect(network).not.toHaveBeenCalled();
  });
  it("검증한 결과만 반환하며 로그인 토큰을 추론 서버에 보내지 않는다", async () => {
    const network = vi
      .fn()
      .mockResolvedValue(
        Response.json({
          status: "needs_measurement",
          model: "test",
          box: null,
          visible_width_mm: null,
          visible_height_mm: null,
          detection_score: null,
          warnings: ["실측 필요"],
        }),
      );
    vi.stubGlobal("fetch", network);
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(network.mock.calls[0][1].headers.Authorization).toBe(
      "Bearer server-only-token",
    );
    expect(response.headers.get("Cache-Control")).toContain("no-store");
  });
  it("잘못된 모델 응답을 전달하지 않는다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({ width_mm: 123 })),
    );
    expect((await POST(request())).status).toBe(502);
  });
});
