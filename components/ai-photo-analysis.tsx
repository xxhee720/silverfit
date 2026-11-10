"use client";
import { useEffect, useRef, useState } from "react";
import { aiNotice, aiResultSchema, type AiResult } from "@/lib/ai-measurement";
import type { Product } from "@/lib/domain";
export function AiPhotoAnalysis({
  photo,
  kind,
  enabled,
}: {
  photo: File;
  kind: Product;
  enabled: boolean;
}) {
  const [consent, setConsent] = useState(false),
    [busy, setBusy] = useState(false);
  const [error, setError] = useState(""),
    [result, setResult] = useState<AiResult | null>(null);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function analyze() {
    if (!consent || busy || !enabled) return;
    const current = new AbortController();
    controller.current = current;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const data = new FormData();
      data.set("photo", photo);
      data.set("product", kind);
      data.set("consent", "true");
      const response = await fetch("/api/measurements/analyze", {
        method: "POST",
        body: data,
        signal: current.signal,
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "분석에 실패했습니다.");
      setResult(aiResultSchema.parse(body.result));
    } catch (e) {
      if (!current.signal.aborted)
        setError(e instanceof Error ? e.message : "분석 실패");
    } finally {
      if (!current.signal.aborted) setBusy(false);
    }
  }
  return (
    <section className="ai-photo-panel" aria-label="AI 사진 분석">
      <h3>
        기준물 없이 AI로 분석 <small>실험 기능</small>
      </h3>
      <p>{aiNotice} 결과는 입력한 제작 치수를 변경하지 않습니다.</p>
      {!enabled && (
        <p role="status">
          AI 분석 서버 연결 전입니다. 지금은 기준물 측정과 직접 입력을 이용해
          주세요.
        </p>
      )}
      <label className="checkbox">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          disabled={!enabled || busy}
        />
        <span>
          이 사진을 운영자가 연결한 AI 서버에 전송해 분석하는 데 동의합니다.
          얼굴·주소를 제외해 주세요. AI 서버는 사진을 저장하지 않습니다.
        </span>
      </label>
      <button
        type="button"
        className="button secondary"
        disabled={!enabled || !consent || busy}
        onClick={analyze}
      >
        {busy ? "AI가 사진을 분석하고 있어요…" : "사진만으로 AI 분석"}
      </button>
      {error && <p role="alert">{error}</p>}
      {result && (
        <div role="status">
          <h4>
            {result.status === "estimated"
              ? "감지된 영역의 예상 크기"
              : "실측이 필요해요"}
          </h4>
          {result.status === "estimated" && (
            <p>
              화면상 가로 약 {result.visible_width_mm}mm · 세로 약{" "}
              {result.visible_height_mm}mm
            </p>
          )}
          <ul>
            {result.warnings.map((warning, i) => (
              <li key={i}>{warning}</li>
            ))}
          </ul>
          <small>
            모델: {result.model}. 물체 감지 점수는 치수의 정확도를 뜻하지
            않습니다.
          </small>
        </div>
      )}
    </section>
  );
}
