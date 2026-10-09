import type { Metadata } from "next";
import Link from "next/link";
import { Footprints, ClipboardList, Plus, LayoutDashboard } from "lucide-react";
import { viewer } from "@/lib/auth";
import { configured } from "@/lib/supabase/server";
import { signout } from "./actions";
import "./globals.css";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: { default: "SilverFit · 실버핏", template: "%s | SilverFit" },
  description: "이동의 불편을 함께 해결하는 맞춤형 이동보조 서비스",
};
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const v = await viewer();
  return (
    <html lang="ko">
      <body>
        <a href="#main" className="skip">
          본문 바로가기
        </a>
        <header className="header">
          <Link href="/" className="brand">
            <span className="brand-icon">
              <Footprints size={24} />
            </span>
            Silver<span>Fit</span>
            <small>실버핏</small>
          </Link>
          <nav aria-label="주 메뉴">
            <Link href="/applications">내 신청</Link>
            {v?.admin && <Link href="/admin">관리자</Link>}
            {v ? (
              <form action={signout}>
                <button className="text-button">로그아웃</button>
              </form>
            ) : (
              <Link className="outline small" href="/auth">
                로그인
              </Link>
            )}
          </nav>
        </header>
        {!configured() && (
          <div className="config-banner">
            현재 서비스 연결 전입니다. 화면을 살펴볼 수 있으며, 신청·로그인은
            Supabase 설정 후 사용할 수 있습니다.
          </div>
        )}
        <main id="main">{children}</main>
        <footer>
          <span className="brand">
            Silver<span>Fit</span>
          </span>
          <p>리빙랩 · 맞춤형 이동보조 서비스</p>
          <small>치수 확인과 안전성 검토를 거쳐 제작합니다.</small>
        </footer>
        <nav className="mobile-nav" aria-label="모바일 메뉴">
          <Link href="/">
            <Footprints size={20} />홈
          </Link>
          <Link href="/applications/new">
            <Plus size={20} />
            신청하기
          </Link>
          <Link href="/applications">
            <ClipboardList size={20} />내 신청
          </Link>
          {v?.admin && (
            <Link href="/admin">
              <LayoutDashboard size={20} />
              관리
            </Link>
          )}
        </nav>
      </body>
    </html>
  );
}
