import Link from "next/link";
import { TriangleRight, Footprints, Armchair, ShieldCheck } from "lucide-react";
import { products, type Product } from "@/lib/domain";
export function ProductCard({ kind }: { kind: Product }) {
  const p = products[kind];
  const Icon =
    kind === "ramp" ? TriangleRight : kind === "tip" ? Footprints : Armchair;
  return (
    <Link href={`/applications/new?product=${kind}`} className="product-card">
      <div className={`product-icon ${kind}`}>
        <Icon size={42} strokeWidth={1.4} />
      </div>
      <div className="product-content">
        <span className="eyebrow">
          {kind === "holder" ? "선택 품목" : "이동보조"}
        </span>
        <h3>{p.name}</h3>
        <p>{p.description}</p>
        <div className="product-bottom">
          <span>
            <ShieldCheck size={16} />
            {p.important ? "안전 검증 필수" : "고정 상태 검토"}
          </span>
          <strong>신청하기</strong>
        </div>
      </div>
    </Link>
  );
}
