import Link from "next/link";
import { configured } from "@/lib/supabase/server";
import { ActionForm } from "@/components/action-form";
import { login, signup, requestReset } from "../actions";
export default async function Auth({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; next?: string; error?: string }>;
}) {
  const q = await searchParams;
  const mode = q.mode || "login";
  const sign = mode === "signup";
  const reset = mode === "forgot";
  return (
    <div className="container narrow">
      <span className="eyebrow">SILVERFIT 계정</span>
      <h1>
        {sign
          ? "함께 시작해요"
          : reset
            ? "비밀번호 재설정"
            : "다시 만나 반가워요"}
      </h1>
      <p className="muted">
        {sign
          ? "사용하실 이메일과 이름을 입력해 주세요."
          : "이메일로 로그인하고 신청 현황을 확인하세요."}
      </p>
      {q.error && (
        <p className="notice error">
          이메일 확인 링크가 만료되었거나 유효하지 않습니다.
        </p>
      )}
      {configured() ? (
        <div className="card">
          <ActionForm
            action={sign ? signup : reset ? requestReset : login}
            label={sign ? "회원가입" : reset ? "재설정 이메일 받기" : "로그인"}
          >
            <input
              type="hidden"
              name="next"
              value={q.next || "/applications"}
            />
            {sign && (
              <>
                <label>
                  이름
                  <input
                    name="name"
                    autoComplete="name"
                    required
                    maxLength={60}
                  />
                </label>
                <label>
                  주로 누구를 위해 신청하시나요?
                  <select name="role">
                    <option value="self">본인</option>
                    <option value="guardian">보호자</option>
                    <option value="social_worker">복지사</option>
                  </select>
                </label>
              </>
            )}
            <label>
              이메일
              <input name="email" type="email" autoComplete="email" required />
            </label>
            {!reset && (
              <label>
                비밀번호
                <input
                  name="password"
                  type="password"
                  minLength={sign ? 12 : undefined}
                  autoComplete={sign ? "new-password" : "current-password"}
                  required
                />
                {sign && <small>12자 이상으로 입력해 주세요.</small>}
              </label>
            )}
          </ActionForm>
          <div className="auth-links">
            <Link href={sign ? "/auth" : "/auth?mode=signup"}>
              {sign ? "이미 계정이 있어요" : "처음 방문하셨나요? 회원가입"}
            </Link>
            {!reset && <Link href="/auth?mode=forgot">비밀번호 찾기</Link>}
          </div>
        </div>
      ) : (
        <div className="notice">
          서비스 연결을 준비 중입니다. 운영자가 Supabase 설정을 완료하면
          로그인할 수 있습니다.
        </div>
      )}
    </div>
  );
}
