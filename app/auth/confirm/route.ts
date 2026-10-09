import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { supabase } from "@/lib/supabase/server";
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const token_hash = params.get("token_hash");
  const type = params.get("type");
  if (
    token_hash &&
    ["signup", "recovery", "email", "email_change"].includes(type || "")
  ) {
    const c = await supabase();
    const { error } = await c.auth.verifyOtp({
      token_hash,
      type: type as EmailOtpType,
    });
    if (!error)
      return NextResponse.redirect(
        new URL(
          type === "recovery" ? "/auth/reset" : "/applications",
          request.url,
        ),
      );
  }
  return NextResponse.redirect(
    new URL("/auth?error=confirmation", request.url),
  );
}
