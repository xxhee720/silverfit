"use client";
import { useState } from "react";
import { ActionForm } from "./action-form";
import { createApplication } from "@/app/actions";
import { products, type Product } from "@/lib/domain";
import { PhotoMeasurement } from "./photo-measurement";
import type { Evidence } from "@/lib/photo-measurement";
export function ApplicationForm({
  initial = "ramp",
  preview = false,
}: {
  initial?: Product;
  preview?: boolean;
}) {
  const [kind, setKind] = useState<Product>(initial);
  const [values, setValues] = useState<Record<string, string>>({});
  const [evidence, setEvidence] = useState<Record<string, Evidence>>({});
  return (
    <ActionForm
      disabled={preview}
      action={createApplication}
      label="신청 접수하기"
    >
      <section className="card">
        <div className="step-heading">
          <span>01</span>
          <h2>필요한 보조장치</h2>
        </div>
        <div className="product-options">
          {Object.entries(products).map(([key, p]) => (
            <label key={key} className={kind === key ? "selected" : ""}>
              <input
                type="radio"
                name="product"
                value={key}
                checked={kind === key}
                onChange={() => {
                  setKind(key as Product);
                  setValues({});
                  setEvidence({});
                }}
              />
              <strong>{p.name}</strong>
              <small>{p.important ? "안전 검증 필수" : "선택 품목"}</small>
            </label>
          ))}
        </div>
      </section>
      <section className="card">
        <div className="step-heading">
          <span>02</span>
          <h2>신청자와 사용 환경</h2>
        </div>
        <div className="field-grid">
          <label>
            신청하는 분
            <select name="applicant_role">
              <option value="self">본인</option>
              <option value="guardian">보호자</option>
              <option value="social_worker">복지사</option>
            </select>
          </label>
          <label>
            사용하실 분의 이름
            <input
              name="beneficiary_name"
              required
              maxLength={60}
              autoComplete="name"
            />
          </label>
          <label>
            연락 가능한 전화번호
            <input
              name="contact"
              type="tel"
              autoComplete="tel"
              required
              minLength={8}
              maxLength={30}
              placeholder="010-0000-0000"
            />
          </label>
        </div>
        <label>
          어떤 상황에서 불편하신가요?
          <textarea
            name="problem"
            required
            minLength={5}
            maxLength={2000}
            placeholder="예: 지팡이를 짚고 현관 문턱을 넘기 어려워요."
          />
        </label>
        <label>
          사용 장소와 바닥·설치 환경
          <textarea
            name="environment"
            required
            minLength={2}
            maxLength={1000}
            placeholder="실내/실외, 바닥 재질, 물기 여부, 이동보조기 사용 여부 등을 알려주세요. 거치대는 고정 방식도 적어주세요."
          />
        </label>
      </section>
      <section className="card">
        <div className="step-heading">
          <span>03</span>
          <h2>치수와 사진</h2>
        </div>
        <p className="muted">
          모든 치수의 단위는 mm입니다. 정확한 값을 모르면 담당자와 측정한 뒤
          신청해 주세요.
        </p>
        <PhotoMeasurement
          kind={kind}
          onReset={() => setEvidence({})}
          onMeasure={(e) => {
            setValues((v) => ({ ...v, [e.field]: String(e.estimated_mm) }));
            setEvidence((v) => ({ ...v, [e.field]: e }));
          }}
        />
        <input
          type="hidden"
          name="measurement_evidence"
          value={JSON.stringify(Object.values(evidence))}
        />
        <div className="field-grid" key={kind}>
          {Object.entries(products[kind].fields).map(([key, label]) => (
            <label key={key}>
              {label}
              <div className="unit-field">
                <input
                  type="number"
                  inputMode="decimal"
                  name={key}
                  value={values[key] || ""}
                  onChange={(e) => {
                    setValues((v) => ({ ...v, [key]: e.target.value }));
                    setEvidence((v) => {
                      const next = { ...v };
                      delete next[key];
                      return next;
                    });
                  }}
                  step="0.1"
                  min="0.1"
                  max="10000"
                  required
                />
                <span>mm</span>
              </div>
              {evidence[key] && <small>사진 추정값 · 실측 확인 필요</small>}
            </label>
          ))}
        </div>
      </section>
      <section className="card">
        <h2>신청 전 확인</h2>
        <p>
          문턱 경사로와 지팡이 팁은 낙상에 영향을 줄 수 있습니다. 신청은 제작
          요청이며, 담당자가 치수와 시험 결과를 검토한 뒤 사용을 승인합니다.
        </p>
        <details>
          <summary>참여 및 개인정보 처리 동의 내용</summary>
          <p>
            이름, 연락처, 생활환경, 치수, 사진을 맞춤 제작·연락·사용 평가
            목적으로 수집합니다. 신청자와 권한을 부여받은 운영 담당자만
            조회합니다. 보호자·복지사는 사용하실 분에게 내용을 설명하고 동의를
            확인해 주세요. 참여 종료 후 1년 이내 삭제하며, 동의 철회·삭제는 담당
            기관에 요청할 수 있습니다. 동의하지 않으면 신청할 수 없습니다.
            (동의서 v1, 2026.10.09)
          </p>
        </details>
        <label className="checkbox">
          <input type="checkbox" name="consent" required />
          <span>
            참여와 개인정보 처리에 동의하며, 대리 신청 시 본인의 동의를
            확인했습니다.
          </span>
        </label>
      </section>
    </ActionForm>
  );
}
