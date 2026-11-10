import Link from "next/link";
import { viewer } from "@/lib/auth";
import { ActionForm } from "@/components/action-form";
import { requestDeletion } from "@/app/actions";
export default async function Deletion() {
  const v = await viewer();
  return (
    <div className="container narrow">
      <h1>계정·개인정보 삭제 요청</h1>
      <section className="card">
        <p>
          계정, 신청 내용과 사진의 삭제를 요청할 수 있습니다. 담당자가 본인
          확인과 안전성 기록 등의 보존 필요 여부를 검토해 처리합니다. 요청 즉시
          삭제되지는 않습니다.
        </p>
        {v ? (
          <ActionForm action={requestDeletion} label="삭제 요청 접수">
            <label className="checkbox">
              <input type="checkbox" name="confirm" required />
              <span>본인 계정 및 관련 개인정보의 삭제를 요청합니다.</span>
            </label>
          </ActionForm>
        ) : (
          <Link className="button" href="/auth?next=/account-deletion">
            본인 계정으로 로그인
          </Link>
        )}
      </section>
    </div>
  );
}
