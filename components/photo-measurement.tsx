"use client";
import { useEffect, useRef, useState } from "react";
import {
  estimateLength,
  type Evidence,
  type Point,
} from "@/lib/photo-measurement";
import { products, validatePhoto, type Product } from "@/lib/domain";
export function PhotoMeasurement({
  kind,
  onMeasure,
  onReset,
}: {
  kind: Product;
  onMeasure: (value: Evidence) => void;
  onReset: () => void;
}) {
  const input = useRef<HTMLInputElement>(null),
    sequence = useRef(0);
  const [url, setUrl] = useState(""),
    [size, setSize] = useState({ width: 0, height: 0 });
  const [points, setPoints] = useState<Point[]>([]),
    [reference, setReference] = useState("100"),
    [error, setError] = useState("");
  const [field, setField] = useState(Object.keys(products[kind].fields)[0]),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    setField(Object.keys(products[kind].fields)[0]);
    setPoints([]);
  }, [kind]);
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );
  async function load(file: File) {
    const ticket = ++sequence.current;
    setBusy(true);
    setError("");
    setUrl("");
    setPoints([]);
    onReset();
    if (input.current) input.current.value = "";
    try {
      validatePhoto(file);
      const bitmap = await createImageBitmap(file, {
        imageOrientation: "from-image",
      });
      const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      canvas
        .getContext("2d")!
        .drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (b) =>
            b ? resolve(b) : reject(new Error("사진을 처리할 수 없습니다.")),
          "image/jpeg",
          0.8,
        ),
      );
      if (blob.size > 2 * 1024 * 1024)
        throw new Error("사진이 너무 큽니다. 더 작은 사진을 선택해 주세요.");
      if (ticket !== sequence.current) return;
      const transfer = new DataTransfer();
      transfer.items.add(
        new File([blob], "measurement.jpg", { type: "image/jpeg" }),
      );
      if (input.current) input.current.files = transfer.files;
      setSize({ width: canvas.width, height: canvas.height });
      setUrl(URL.createObjectURL(blob));
    } catch (e) {
      if (ticket === sequence.current) {
        if (input.current) input.current.value = "";
        setError(e instanceof Error ? e.message : "사진 처리 실패");
      }
    } finally {
      if (ticket === sequence.current) setBusy(false);
    }
  }
  const labels = [
    "기준물 시작점",
    "기준물 끝점",
    "측정 대상 시작점",
    "측정 대상 끝점",
  ];
  return (
    <div className="photo-measurement">
      <h3>사진 촬영과 치수 계산</h3>
      <p>
        자로 잰 기준 길이를 대상과 같은 평면에 놓고 정면에서 촬영해 주세요.
        얼굴·주소는 제외하고, 카드 대신 자 또는 개인정보가 없는 기준물을 사용해
        주세요.
      </p>
      <div className="measurement-buttons">
        <label className="button secondary">
          사진 촬영
          <input
            className="visually-hidden"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void load(f);
              e.target.value = "";
            }}
          />
        </label>
        <label className="button secondary">
          사진 선택
          <input
            className="visually-hidden"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void load(f);
              e.target.value = "";
            }}
          />
        </label>
        <button
          type="button"
          className="button secondary"
          onClick={() => {
            sequence.current++;
            setBusy(false);
            setUrl("");
            setPoints([]);
            onReset();
            if (input.current) input.current.value = "";
            if (input.current) input.current.value = "";
          }}
        >
          사진 삭제
        </button>
      </div>
      <input
        ref={input}
        className="visually-hidden"
        type="file"
        name="photo"
        tabIndex={-1}
        aria-label="신청에 첨부할 사진"
      />
      {busy && <p role="status">사진을 준비하고 있습니다…</p>}
      {url && (
        <>
          <div className="field-grid">
            <label>
              기준물의 실제 길이 (mm)
              <input
                type="number"
                min="0.1"
                max="10000"
                step="0.1"
                value={reference}
                onChange={(e) => {
                  setReference(e.target.value);
                  setPoints([]);
                }}
              />
            </label>
            <label>
              측정할 치수
              <select
                value={field}
                onChange={(e) => {
                  setField(e.target.value);
                  setPoints((p) => p.slice(0, 2));
                }}
              >
                {Object.entries(products[kind].fields).map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p aria-live="polite">
            {points.length < 4
              ? `${points.length + 1}/4: 사진에서 ${labels[points.length]}을 눌러 주세요.`
              : "네 지점을 지정했습니다. 계산 결과를 치수에 적용할 수 있습니다."}
          </p>
          <div className="measurement-image">
            <button
              type="button"
              className="measurement-surface"
              aria-label={
                points.length < 4
                  ? `사진에서 ${labels[points.length]} 지정`
                  : "측정 지점 지정 완료"
              }
              onClick={(e) => {
                if (points.length >= 4) return;
                const r = e.currentTarget.getBoundingClientRect();
                setPoints((p) => [
                  ...p,
                  {
                    x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)),
                    y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)),
                  },
                ]);
              }}
            >
              <img src={url} alt="치수를 측정할 사진" />
            </button>
            {points.map((p, i) => (
              <span
                className="measurement-point"
                key={i}
                style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
              >
                {i + 1}
              </span>
            ))}
          </div>
          <div className="measurement-buttons">
            <button
              className="button secondary"
              type="button"
              onClick={() => setPoints((p) => p.slice(0, -1))}
              disabled={!points.length}
            >
              마지막 지점 취소
            </button>
            <button
              className="button"
              type="button"
              disabled={points.length !== 4}
              onClick={() => {
                try {
                  const mm = estimateLength(
                    points,
                    size.width,
                    size.height,
                    Number(reference),
                  );
                  onMeasure({
                    method: "photo-reference-v1",
                    field,
                    reference_mm: Number(reference),
                    image_width: size.width,
                    image_height: size.height,
                    points,
                    estimated_mm: mm,
                  });
                  setError("");
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              치수 계산·입력
            </button>
          </div>
        </>
      )}
      {error && (
        <p role="alert" className="notice error">
          {error}
        </p>
      )}
      <p className="notice">
        기준 길이와 네 지점을 지정하면 비율로 자동 계산합니다. AI 물체 인식이나
        깊이 측정은 지원하지 않습니다. 원근·곡면·촬영 각도에 따른 오차가
        있으므로 제작 전 실측이 필요합니다. 삽입 깊이·희망 크기처럼 사진에서
        보이지 않는 치수는 직접 입력해 주세요.
      </p>
    </div>
  );
}
