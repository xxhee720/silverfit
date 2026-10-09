import Link from "next/link";
import {
  Plus,
  Ruler,
  Box,
  ShieldCheck,
  ClipboardList,
  Check,
} from "lucide-react";
import { ProductCard } from "@/components/product-card";
import { viewer } from "@/lib/auth";
import { supabase } from "@/lib/supabase/server";
import { date, products, statuses, type Application } from "@/lib/domain";
export default async function Home() {
  const v = await viewer();
  let apps: Application[] = [];
  if (v) {
    const c = await supabase();
    const { data } = await c
      .from("applications")
      .select("*")
      .eq("owner_id", v.user.id)
      .order("created_at", { ascending: false })
      .limit(2);
    apps = data || [];
  }
  return (
    <div className="container">
      <div className="home-heading">
        <div>
          <p className="eyebrow">SILVERFIT · 이동보조 리빙랩</p>
          <h1>
            {v?.profile?.name
              ? `${v.profile.name}님, 안녕하세요`
              : "일상에 맞추는, 더 편안한 이동"}
          </h1>
          <p className="muted">
            작은 불편부터 알려주세요. 함께 측정하고, 맞춰갑니다.
          </p>
        </div>
        <Link className="outline" href="/applications">
          <ClipboardList size={18} />내 신청 확인
        </Link>
      </div>
      <section className="request-panel">
        <div>
          <span className="pill light">맞춤 제작 신청</span>
          <h2>
            어디에서 이동이
            <br />
            불편하신가요?
          </h2>
          <p>
            본인, 보호자, 복지사 누구나 신청할 수 있어요.
            <br />
            불편한 상황과 치수를 알려주시면 담당자가 확인합니다.
          </p>
          <Link className="button white" href="/applications/new">
            <Plus size={20} />새 신청 시작하기
          </Link>
        </div>
        <ol className="process-preview">
          <li>
            <span>
              <Ruler />
            </span>
            <div>
              <strong>생활환경에 맞게 측정</strong>
              <p>문턱·지팡이·설치 공간을 확인해요.</p>
            </div>
          </li>
          <li>
            <span>
              <Box />
            </span>
            <div>
              <strong>개인에게 맞는 설계와 제작</strong>
              <p>측정값을 바탕으로 시험 제작해요.</p>
            </div>
          </li>
          <li>
            <span>
              <ShieldCheck />
            </span>
            <div>
              <strong>검증을 마친 뒤 전달</strong>
              <p>담당자가 출력물의 안전성을 검토해요.</p>
            </div>
          </li>
        </ol>
      </section>
      <section className="section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">맞춤형 보조장치</span>
            <h2>필요한 도움을 선택하세요</h2>
          </div>
          <span className="muted">3가지 이동보조 품목</span>
        </div>
        <div className="product-grid">
          <ProductCard kind="ramp" />
          <ProductCard kind="tip" />
          <ProductCard kind="holder" />
        </div>
      </section>
      <section className="section">
        <div className="section-heading">
          <h2>내 신청 현황</h2>
          <Link href="/applications">전체 보기</Link>
        </div>
        {apps.length ? (
          <div className="list">
            {apps.map((a) => (
              <Link
                className="application-row"
                key={a.id}
                href={`/applications/${a.id}`}
              >
                <span className="row-icon">
                  <ClipboardList />
                </span>
                <div>
                  <h3>{products[a.product].name}</h3>
                  <p>
                    {a.beneficiary_name} · {date(a.created_at)}
                  </p>
                </div>
                <span className="badge">{statuses[a.status]}</span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="empty">
            <span className="empty-icon">
              <ClipboardList size={28} />
            </span>
            <div>
              <strong>
                {v
                  ? "아직 신청한 보조장치가 없어요"
                  : "로그인하면 신청 현황을 확인할 수 있어요"}
              </strong>
              <p>접수부터 전달까지 진행 상황을 한곳에서 확인하세요.</p>
            </div>
            <Link className="outline" href={v ? "/applications/new" : "/auth"}>
              {v ? "첫 신청하기" : "로그인하기"}
            </Link>
          </div>
        )}
      </section>
      <div className="help-strip">
        <Check size={22} />
        <p>
          사진에는 얼굴·주소가 보이지 않게 촬영해 주세요. 보조장치와 설치 공간만
          있으면 충분해요.
        </p>
      </div>
    </div>
  );
}
