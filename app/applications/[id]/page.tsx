import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase/server";
import {
  products,
  statuses,
  flow,
  roles,
  date,
  type Application,
} from "@/lib/domain";
import { ActionForm } from "@/components/action-form";
import {
  AdminControls,
  type Design,
  type PrintJob,
} from "@/components/admin-controls";
import { addPhoto, addFeedback } from "@/app/actions";
export default async function Detail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string }>;
}) {
  const v = await requireUser();
  const { id } = await params;
  const q = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const c = await supabase();
  const { data, error } = await c
    .from("applications")
    .select("*")
    .eq("id", id)
    .single();
  if (error || !data) notFound();
  const a = data as Application;
  const results = await Promise.all([
    c.from("attachments").select("*").eq("application_id", id),
    c
      .from("designs")
      .select("*")
      .eq("application_id", id)
      .order("version", { ascending: false }),
    c
      .from("print_jobs")
      .select("*")
      .eq("application_id", id)
      .order("created_at", { ascending: false }),
    c
      .from("safety_reviews")
      .select("*")
      .eq("application_id", id)
      .order("sequence", { ascending: false }),
    c.from("status_events").select("*").eq("application_id", id).order("id"),
    c
      .from("feedback")
      .select("*")
      .eq("application_id", id)
      .order("created_at", { ascending: false }),
  ]);
  const [photos, designs, prints, reviews, events, feedback] = results.map(
    (r) => r.data || [],
  );
  return (
    <div className="container">
      <Link href={v.admin ? "/admin" : "/applications"} className="back-link">
        신청 목록으로
      </Link>
      <div className="section-heading">
        <div>
          <p className="eyebrow">신청 {id.slice(0, 8)}</p>
          <h1>{products[a.product].name}</h1>
          <p className="muted">
            {a.beneficiary_name} · {date(a.created_at)} 접수
          </p>
        </div>
        <span className="badge large">{statuses[a.status]}</span>
      </div>
      {q.notice === "photo_failed" && (
        <p className="notice error">
          신청은 접수되었지만 사진 업로드를 완료하지 못했습니다. 아래에서 사진을
          다시 추가해 주세요.
        </p>
      )}
      {results.some((r) => r.error) && (
        <p className="notice error">
          일부 이력을 불러오지 못했습니다. 새로고침해 주세요.
        </p>
      )}
      <section className="card">
        <h2>진행 상황</h2>
        <ol className="timeline">
          {flow.map((s, i) => (
            <li key={s} className={i <= flow.indexOf(a.status) ? "active" : ""}>
              <span>{i + 1}</span>
              <strong>{statuses[s]}</strong>
            </li>
          ))}
        </ol>
        {a.status === "safety_review" && (
          <p className="notice">
            아직 사용 승인 전입니다. 담당자의 검토가 끝날 때까지 사용하지
            마세요. 이미 전달받은 경우 사용을 중단하고 담당자에게 연락해 주세요.
          </p>
        )}
        {a.status === "rejected" && (
          <p className="notice error">
            제작 불가로 종료되었습니다. 아래 변경 사유를 확인해 주세요.
          </p>
        )}
      </section>
      <div className="detail-grid section">
        <section className="card">
          <h2>신청 정보</h2>
          <dl>
            <dt>신청 구분</dt>
            <dd>{roles[a.applicant_role]}</dd>
            <dt>연락처</dt>
            <dd>{a.contact}</dd>
            <dt>불편한 상황</dt>
            <dd>{a.problem}</dd>
            <dt>사용 환경</dt>
            <dd>{a.environment}</dd>
          </dl>
        </section>
        <section className="card">
          <h2>측정값</h2>
          <dl>
            {Object.entries(products[a.product].fields).map(([key, label]) => (
              <div className="measurement" key={key}>
                <dt>{label}</dt>
                <dd>
                  <strong>{a.measurements[key]}</strong> mm
                </dd>
              </div>
            ))}
          </dl>
          <p className="muted">담당자가 제작 전 측정값을 확인합니다.</p>
        </section>
      </div>
      <section className="card section">
        <h2>상황 사진</h2>
        <div className="file-list">
          {photos.map((p) => (
            <a
              key={p.id}
              className="outline"
              href={`/files/${p.id}?kind=photo`}
              target="_blank"
              rel="noreferrer"
            >
              {p.original_name} · 사진 보기
            </a>
          ))}
          {!photos.length && <p className="muted">첨부한 사진이 없습니다.</p>}
        </div>
        <ActionForm action={addPhoto} label="사진 추가">
          <input type="hidden" name="id" value={id} />
          <label>
            사진 선택
            <input
              type="file"
              name="photo"
              accept="image/jpeg,image/png,image/webp"
              required
            />
            <small>10MB 이하 · 얼굴·주소는 제외해 주세요.</small>
          </label>
        </ActionForm>
      </section>
      <section className="section">
        <h2>설계·제작 이력</h2>
        <div className="detail-grid">
          <div className="card">
            <h3>설계 파일 버전</h3>
            {designs.map((d) => (
              <div key={d.id} className="history-item">
                <strong>
                  v{d.version} · {date(d.created_at)}
                </strong>
                <p>{d.notes}</p>
                <a
                  className="outline small"
                  href={`/files/${d.id}?kind=design`}
                  target="_blank"
                  rel="noreferrer"
                >
                  설계 파일 받기
                </a>
              </div>
            ))}
            {!designs.length && <p className="muted">설계 준비 전입니다.</p>}
          </div>
          <div className="card">
            <h3>프린팅 작업</h3>
            {prints.map((p) => (
              <div key={p.id} className="history-item">
                <strong>
                  {p.result === "completed" ? "출력 완료" : "출력 실패"} ·{" "}
                  {p.id.slice(0, 8)}
                </strong>
                <p>
                  설계 v{designs.find((d) => d.id === p.design_id)?.version} ·{" "}
                  {p.material} · {p.duration_minutes}분
                </p>
                <p>{p.printer}</p>
                <p>{p.notes}</p>
              </div>
            ))}
            {!prints.length && <p className="muted">출력물 기록이 없습니다.</p>}
          </div>
        </div>
      </section>
      <section className="card section">
        <h2>안전성 검토</h2>
        {reviews.map((r) => (
          <div key={r.id} className="history-item">
            <span
              className={`badge ${r.decision === "failed" ? "danger" : ""}`}
            >
              {r.decision === "passed" ? "시험 통과" : "부적합"}
            </span>
            <p>
              <strong>{r.expert_name}</strong> · {date(r.created_at)} · 출력물{" "}
              {r.print_job_id.slice(0, 8)}
            </p>
            <p>시험: {r.protocol}</p>
            <p>근거: {r.evidence}</p>
          </div>
        ))}
        {!reviews.length && (
          <p className="muted">아직 검토 결과가 등록되지 않았습니다.</p>
        )}
        <small>
          통과 기록은 해당 설계와 출력물에만 적용됩니다. 상태가 ‘사용 승인’
          이후인지 확인해 주세요.
        </small>
      </section>
      {v.admin && (
        <AdminControls
          app={a}
          designs={designs as Design[]}
          prints={prints as PrintJob[]}
        />
      )}
      <section className="card section">
        <h2>사용 후기와 개선 요청</h2>
        {feedback.map((f) => (
          <div key={f.id} className="history-item">
            <strong>
              {f.rating} / 5점 {f.incident && "· 사용 중 문제 신고"}
            </strong>
            <p>{f.comment}</p>
            <small>{date(f.created_at)}</small>
          </div>
        ))}
        {!feedback.length && <p className="muted">등록된 의견이 없습니다.</p>}
        {a.owner_id === v.user.id &&
          ["delivered", "evaluating", "closed"].includes(a.status) && (
            <ActionForm action={addFeedback} label="의견 보내기">
              <input type="hidden" name="id" value={id} />
              <label>
                만족도
                <select name="rating">
                  {[5, 4, 3, 2, 1].map((n) => (
                    <option key={n} value={n}>
                      {n}점
                    </option>
                  ))}
                </select>
              </label>
              <label>
                사용 경험·개선 요청
                <textarea
                  name="comment"
                  minLength={5}
                  maxLength={2000}
                  required
                />
              </label>
              <label className="checkbox">
                <input type="checkbox" name="incident" />
                <span>
                  파손·미끄러짐 등 사용 중 문제가 있었습니다. (사용을 중단하고
                  담당자에게 알려주세요.)
                </span>
              </label>
            </ActionForm>
          )}
      </section>
      <section className="card section">
        <h2>진행 기록</h2>
        <ol className="event-list">
          {events.map((e) => (
            <li key={e.id}>
              <strong>{statuses[e.to_status as keyof typeof statuses]}</strong>
              <p>{e.reason}</p>
              <small>{date(e.created_at)}</small>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
