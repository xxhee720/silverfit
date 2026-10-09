import Link from "next/link";
export default function NotFound() {
  return (
    <div className="container narrow">
      <h1>신청을 찾을 수 없어요</h1>
      <p>접근할 수 없는 신청이거나 주소가 올바르지 않습니다.</p>
      <Link className="button" href="/applications">
        내 신청으로
      </Link>
    </div>
  );
}
