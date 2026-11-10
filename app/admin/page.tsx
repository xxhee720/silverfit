import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { supabase } from "@/lib/supabase/server";
import { products, statuses, date, type Application } from "@/lib/domain";
export default async function Admin({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireAdmin();
  const q = await searchParams;
  const c = await supabase();
  let query = c
    .from("applications")
    .select("*")
    .order("created_at", { ascending: false });
  if (q.status && q.status in statuses) query = query.eq("status", q.status);
  const [{ data, error }, { data: all }, { data: incidents }] =
    await Promise.all([
      query.limit(200),
      c.from("applications").select("status"),
      c.from("feedback").select("id").eq("incident", true),
    ]);
  const deletionRequests = await c
    .from("account_deletion_requests")
    .select("user_id,requested_at")
    .order("requested_at")
    .limit(200);
  return (
    <div className="container">
      <span className="eyebrow">운영 담당자</span>
      <h1>제작 관리 대시보드</h1>
      <p className="muted">
        측정·설계·시험 제작·안전성 검토를 순서대로 관리합니다.
      </p>
      <div className="stats">
        <div>
          <span>전체 신청</span>
          <strong>{all?.length || 0}</strong>
        </div>
        <div>
          <span>신규 접수</span>
          <strong>
            {all?.filter((a) => a.status === "submitted").length || 0}
          </strong>
        </div>
        <div>
          <span>안전성 검토 대기</span>
          <strong>
            {all?.filter((a) => a.status === "safety_review").length || 0}
          </strong>
        </div>
        <div>
          <span>사용 문제 신고 누적</span>
          <strong>{incidents?.length || 0}</strong>
        </div>
      </div>
      <section className="card">
        <h2>계정 삭제 요청</h2>
        {deletionRequests.error ? (
          <p className="notice">
            삭제 요청 목록을 불러오지 못했습니다. 새 마이그레이션 적용 여부를
            확인해 주세요.
          </p>
        ) : deletionRequests.data?.length ? (
          <ul>
            {deletionRequests.data.map((r) => (
              <li key={r.user_id}>
                계정 {r.user_id} · 요청일 {date(r.requested_at)}
              </li>
            ))}
          </ul>
        ) : (
          <p>대기 중인 요청이 없습니다.</p>
        )}
        <p>
          담당자는 본인 확인·보존 사유 검토 후 비공개 파일·관련 데이터·인증
          계정을 삭제하고 결과를 안내해 주세요.
        </p>
      </section>
      <form className="filter" method="get">
        <label>
          진행 상태
          <select name="status" defaultValue={q.status || ""}>
            <option value="">전체</option>
            {Object.entries(statuses).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <button className="outline">조회</button>
      </form>
      {error ? (
        <p className="notice error">목록을 불러오지 못했습니다.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <caption>신청 목록 · 최근 200건 (상태별 조회 가능)</caption>
            <thead>
              <tr>
                <th>신청 번호</th>
                <th>제품 / 사용자</th>
                <th>접수일</th>
                <th>상태</th>
                <th>관리</th>
              </tr>
            </thead>
            <tbody>
              {((data as Application[]) || []).map((a) => (
                <tr key={a.id}>
                  <td>{a.id.slice(0, 8)}</td>
                  <td>
                    <strong>{products[a.product].name}</strong>
                    <br />
                    {a.beneficiary_name}
                  </td>
                  <td>{date(a.created_at)}</td>
                  <td>
                    <span className="badge">{statuses[a.status]}</span>
                  </td>
                  <td>
                    <Link
                      href={`/applications/${a.id}`}
                      className="outline small"
                    >
                      상세 관리
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!data?.length && <p className="empty">해당하는 신청이 없습니다.</p>}
        </div>
      )}
    </div>
  );
}
