import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/server";
import { aiResultSchema } from "@/lib/ai-measurement";
export const runtime = "nodejs";
export const maxDuration = 60;
const reply = (body: object, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
export async function POST(request: NextRequest) {
  // Cookie callers must be same-origin; native callers authenticate with an access token.
  const bearer = request.headers.get("authorization");
  const origin = request.headers.get("origin");
  if (!bearer && origin !== request.nextUrl.origin)
    return reply({ error: "허용되지 않은 요청입니다." }, 403);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key)
    return reply({ error: "로그인 연결 설정이 필요합니다." }, 503);
  const client = bearer
    ? createClient(url, key, {
        global: { headers: { Authorization: bearer } },
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : await supabase();
  const {
    data: { user },
    error,
  } = await client.auth.getUser(
    bearer ? bearer.replace(/^Bearer /i, "") : undefined,
  );
  if (error || !user) return reply({ error: "로그인 후 분석해 주세요." }, 401);
  const endpoint = process.env.MEASUREMENT_AI_URL,
    token = process.env.MEASUREMENT_AI_TOKEN;
  if (!endpoint || !token)
    return reply(
      {
        error:
          "AI 분석 서버가 아직 연결되지 않았습니다. 직접 입력 또는 기준물 측정을 이용해 주세요.",
      },
      503,
    );
  if (Number(request.headers.get("content-length") || 0) > 3 * 1024 * 1024)
    return reply({ error: "사진은 2MB 이하로 올려 주세요." }, 413);
  let f: FormData;
  try {
    f = await request.formData();
  } catch {
    return reply({ error: "사진 요청을 확인해 주세요." }, 400);
  }
  const file = f.get("photo"),
    kind = f.get("product");
  if (
    !(file instanceof File) ||
    file.size === 0 ||
    file.size > 2 * 1024 * 1024 ||
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    !["ramp", "tip", "holder"].includes(String(kind)) ||
    f.get("consent") !== "true"
  )
    return reply(
      { error: "사진·품목·AI 사진 전송 동의를 확인해 주세요." },
      400,
    );
  const { error: quota } = await client.rpc("reserve_ai_analysis");
  if (quota)
    return reply(
      {
        error:
          "분석을 시작할 수 없습니다. 설정을 확인하거나 잠시 후 다시 시도해 주세요.",
      },
      429,
    );
  try {
    const body = new FormData();
    body.set("photo", file);
    body.set("product", String(kind));
    const result = await fetch(new URL("/analyze", endpoint), {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body,
      signal: AbortSignal.timeout(50000),
      cache: "no-store",
      redirect: "error",
    });
    if (!result.ok) throw new Error("inference failed");
    const parsed = aiResultSchema.parse(await result.json());
    return reply({ result: parsed });
  } catch {
    return reply(
      {
        error:
          "AI 분석을 완료하지 못했습니다. 사진을 다시 촬영하거나 직접 측정해 주세요.",
      },
      502,
    );
  }
}
