import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/server";
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id))
    return new NextResponse("잘못된 요청", { status: 400 });
  const c = await supabase();
  const {
    data: { user },
  } = await c.auth.getUser();
  if (!user) return new NextResponse("로그인이 필요합니다.", { status: 401 });
  const kind = request.nextUrl.searchParams.get("kind");
  if (!["photo", "design"].includes(kind || ""))
    return new NextResponse("잘못된 요청", { status: 400 });
  const { data: record } = await c
    .from(kind === "photo" ? "attachments" : "designs")
    .select("path")
    .eq("id", id)
    .single();
  if (!record)
    return new NextResponse("파일을 찾을 수 없습니다.", { status: 404 });
  const { data, error } = await c.storage
    .from(kind === "photo" ? "application-photos" : "design-files")
    .createSignedUrl(
      record.path,
      60,
      kind === "design" ? { download: true } : undefined,
    );
  if (error || !data)
    return new NextResponse("파일을 열지 못했습니다.", { status: 500 });
  return NextResponse.redirect(data.signedUrl, {
    status: 302,
    headers: { "Cache-Control": "private, no-store" },
  });
}
