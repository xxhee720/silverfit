import { ActionForm } from "./action-form";
import { changeStatus, addDesign, addPrint, addReview } from "@/app/actions";
import { allowedNext, statuses, type Application } from "@/lib/domain";
export type Design = {
  id: string;
  version: number;
  path: string;
  notes: string;
  created_at: string;
};
export type PrintJob = {
  id: string;
  design_id: string;
  result: string;
  material: string;
  printer: string;
  duration_minutes: number;
  notes: string;
  created_at: string;
};
export function AdminControls({
  app,
  designs,
  prints,
}: {
  app: Application;
  designs: Design[];
  prints: PrintJob[];
}) {
  const next = allowedNext(app.status);
  const current = designs[0];
  const complete = prints.filter(
    (p) => p.result === "completed" && p.design_id === current?.id,
  );
  return (
    <section className="section">
      <span className="eyebrow">관리자 전용</span>
      <h2>제작·안전성 관리</h2>
      <div className="admin-grid">
        <div className="card">
          <h3>진행 상태 변경</h3>
          {next.length ? (
            <ActionForm action={changeStatus} label="상태 변경">
              <input type="hidden" name="id" value={app.id} />
              <label>
                다음 단계
                <select name="status">
                  {next.map((s) => (
                    <option key={s} value={s}>
                      {statuses[s]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                변경 사유
                <textarea
                  name="reason"
                  minLength={3}
                  maxLength={2000}
                  required
                />
              </label>
              <small>
                안전성 통과 기록이 없으면 사용 승인과 전달이 차단됩니다.
              </small>
            </ActionForm>
          ) : (
            <p className="muted">종료된 신청입니다.</p>
          )}
        </div>
        <div className="card">
          <h3>설계 파일 새 버전</h3>
          <ActionForm action={addDesign} label="설계 버전 등록">
            <input type="hidden" name="id" value={app.id} />
            <label>
              설계 파일
              <input
                type="file"
                name="file"
                accept=".stl,.step,.stp,.3mf,.scad"
                required
              />
            </label>
            <label>
              설계·변경 내용
              <textarea name="notes" minLength={5} maxLength={2000} required />
            </label>
            <small>
              20MB 이하. 원본을 보존하며 새 버전은 다시 시험 제작·검토합니다.
              전달 후 개선은 새 신청으로 진행합니다.
            </small>
          </ActionForm>
        </div>
        <div className="card">
          <h3>출력물 기록</h3>
          {current ? (
            <ActionForm action={addPrint} label="출력물 등록">
              <input type="hidden" name="id" value={app.id} />
              <input type="hidden" name="design_id" value={current.id} />
              <p className="badge">현재 설계 v{current.version}</p>
              <label>
                소재·등급
                <input
                  name="material"
                  required
                  minLength={2}
                  maxLength={100}
                  placeholder="예: TPU, 제조사·경도·로트"
                />
              </label>
              <label>
                프린터·출력 조건
                <input
                  name="printer"
                  required
                  minLength={2}
                  maxLength={100}
                  placeholder="장비, 적층 높이, 인필"
                />
              </label>
              <label>
                출력 시간 (분)
                <input
                  type="number"
                  name="duration_minutes"
                  min={1}
                  max={100000}
                  required
                />
              </label>
              <label>
                결과
                <select name="result">
                  <option value="completed">출력 완료</option>
                  <option value="failed">출력 실패</option>
                </select>
              </label>
              <label>
                품질·출력 결과
                <textarea
                  name="notes"
                  minLength={5}
                  maxLength={2000}
                  required
                />
              </label>
            </ActionForm>
          ) : (
            <p>먼저 설계 버전을 등록해 주세요.</p>
          )}
        </div>
        <div className="card">
          <h3>안전성 검토 기록</h3>
          {complete.length ? (
            <ActionForm action={addReview} label="검토 결과 등록">
              <input type="hidden" name="id" value={app.id} />
              <label>
                검토할 실제 출력물
                <select name="print_job_id">
                  {complete.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.id.slice(0, 8)} · {p.material}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                시험 방법·판정 기준
                <textarea
                  name="protocol"
                  minLength={5}
                  maxLength={2000}
                  required
                  placeholder="하중·마찰·내구성 등 적용 시험 및 합격 기준"
                />
              </label>
              <label>
                시험 결과·근거
                <textarea
                  name="evidence"
                  minLength={10}
                  maxLength={4000}
                  required
                  placeholder="측정 결과, 시험 보고서 번호·보관 위치, 제한 조건, 사용 안내"
                />
              </label>
              <label>
                검토 전문가 이름·소속
                <input
                  name="expert_name"
                  required
                  minLength={2}
                  maxLength={100}
                />
              </label>
              <label>
                판정
                <select name="decision">
                  <option value="failed">부적합 / 보완 필요</option>
                  <option value="passed">시험 통과·전문가 검토 완료</option>
                </select>
              </label>
              <small>
                시험 통과 기록 후 별도로 사용 승인을 진행합니다. 부적합 기록은
                기존 승인을 철회합니다.
              </small>
            </ActionForm>
          ) : (
            <p>현재 설계의 완료된 출력물 기록이 필요합니다.</p>
          )}
        </div>
      </div>
    </section>
  );
}
