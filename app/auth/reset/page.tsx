import { requireUser } from "@/lib/auth";
import { ActionForm } from "@/components/action-form";
import { resetPassword } from "@/app/actions";
export default async function Reset() {
  await requireUser();
  return (
    <div className="container narrow">
      <h1>새 비밀번호 설정</h1>
      <div className="card">
        <ActionForm action={resetPassword} label="비밀번호 변경">
          <label>
            새 비밀번호
            <input
              type="password"
              name="password"
              minLength={12}
              autoComplete="new-password"
              required
            />
          </label>
        </ActionForm>
      </div>
    </div>
  );
}
