import { requireUser } from "@/lib/auth";
import { ApplicationForm } from "@/components/application-form";
import { products, type Product } from "@/lib/domain";
import { configured } from "@/lib/supabase/server";
export default async function New({
  searchParams,
}: {
  searchParams: Promise<{ product?: string }>;
}) {
  const q = await searchParams;
  if (configured()) await requireUser();
  const initial =
    q.product && q.product in products ? (q.product as Product) : "ramp";
  return (
    <div className="container form-width">
      <span className="eyebrow">맞춤형 이동보조</span>
      <h1>새 보조장치 신청</h1>
      <p className="muted">사용하실 분의 생활환경에 맞춰 함께 준비합니다.</p>
      {configured() ? (
        <ApplicationForm initial={initial} />
      ) : (
        <>
          <p className="notice">
            연결 전 미리보기입니다. 실제 신청은 Supabase 설정과 로그인 후
            가능합니다.
          </p>
          <fieldset disabled className="preview-fieldset">
            <ApplicationForm initial={initial} />
          </fieldset>
        </>
      )}
    </div>
  );
}
