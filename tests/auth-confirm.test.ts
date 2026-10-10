import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const auth = vi.hoisted(() => ({ exchangeCodeForSession: vi.fn(), verifyOtp: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ supabase: async () => ({ auth }) }));
import { GET } from "../app/auth/confirm/route";
beforeEach(() => { vi.resetAllMocks(); auth.exchangeCodeForSession.mockResolvedValue({ error: null }); auth.verifyOtp.mockResolvedValue({ error: null }); });
describe("메일 확인 콜백", () => {
  it("기본 템플릿 PKCE 코드를 세션으로 교환한다", async () => {
    const response = await GET(new NextRequest("https://silverfit.test/auth/confirm?code=valid&next=https://evil.test"));
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith("valid");
    expect(response.headers.get("location")).toBe("https://silverfit.test/applications");
  });
  it("복구 코드는 재설정 화면으로 보낸다", async () => {
    const response = await GET(new NextRequest("https://silverfit.test/auth/confirm?code=valid&type=recovery"));
    expect(response.headers.get("location")).toBe("https://silverfit.test/auth/reset");
  });
  it("실패한 코드를 로그인 성공으로 처리하지 않는다", async () => {
    auth.exchangeCodeForSession.mockResolvedValue({ error: { message: "expired" } });
    const response = await GET(new NextRequest("https://silverfit.test/auth/confirm?code=expired"));
    expect(response.headers.get("location")).toBe("https://silverfit.test/auth?error=confirmation");
  });
  it("사용자 지정 token_hash 템플릿을 지원한다", async () => {
    const response = await GET(new NextRequest("https://silverfit.test/auth/confirm?token_hash=valid&type=signup"));
    expect(auth.verifyOtp).toHaveBeenCalledWith({ token_hash: "valid", type: "signup" });
    expect(response.headers.get("location")).toBe("https://silverfit.test/applications");
  });
});
