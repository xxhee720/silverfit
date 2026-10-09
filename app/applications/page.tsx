import Link from "next/link";
import { ClipboardList, Plus } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase/server";
import { products, statuses, date, type Application } from "@/lib/domain";
export default async function Applications() {
  const v = await requireUser();
  const c = await supabase();
  const { data, error } = await c
    .from("applications")
    .select("*")
    .eq("owner_id", v.user.id)
    .order("created_at", { ascending: false });
  return (
    <div className="container">
      <div className="section-heading">
        <div>
          <span className="eyebrow">나의 실버핏</span>
          <h1>내 신청 현황</h1>
        </div>
        <Link className="button" href="/applications/new">
          <Plus size={18} />새 신청
        </Link>
      </div>
      {error ? (
        <p className="notice error">
          신청 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
        </p>
      ) : data?.length ? (
        <div className="list">
          {(data as Application[]).map((a) => (
            <Link
              href={`/applications/${a.id}`}
              key={a.id}
              className="application-row"
            >
              <span className="row-icon">
                <ClipboardList />
              </span>
              <div>
                <h3>{products[a.product].name}</h3>
                <p>
                  {a.beneficiary_name} · {date(a.created_at)} ·{" "}
                  {a.id.slice(0, 8)}
                </p>
              </div>
              <span
                className={`badge ${a.status === "rejected" ? "danger" : ""}`}
              >
                {statuses[a.status]}
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="empty">
          <ClipboardList size={32} />
          <div>
            <h2>아직 신청한 보조장치가 없어요</h2>
            <p>불편한 상황을 알려주시면 담당자가 확인합니다.</p>
          </div>
          <Link href="/applications/new" className="outline">
            첫 신청하기
          </Link>
        </div>
      )}
    </div>
  );
}
