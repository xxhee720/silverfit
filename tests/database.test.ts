import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
let db: PGlite;
const user = "11111111-1111-4111-8111-111111111111",
  other = "22222222-2222-4222-8222-222222222222",
  admin = "33333333-3333-4333-8333-333333333333";
let app: string, design: string, print: string;
async function as(id: string) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  await db.exec("set role authenticated");
}
async function rpc(sql: string, args: unknown[] = []) {
  return db.query<{ id: string; ok: boolean; status: string; role: string }>(
    sql,
    args,
  );
}
const input = {
  product: "tip",
  applicant_role: "guardian",
  beneficiary_name: "참여자",
  contact: "010-1234-5678",
  environment: "실내 타일",
  problem: "지팡이가 미끄러져요",
  consent: true,
  measurements: {
    shaft_diameter_mm: 19,
    contact_diameter_mm: 40,
    insertion_depth_mm: 30,
  },
};
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create schema auth;create schema storage;create table auth.users(id uuid primary key,raw_user_meta_data jsonb);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;create function storage.foldername(text) returns text[] language sql immutable as $$ select (string_to_array($1,'/'))[1:array_length(string_to_array($1,'/'),1)-1] $$;grant usage on schema public,auth,storage to authenticated;grant select,insert on storage.objects to authenticated;`,
  );
  await db.exec(
    readFileSync("supabase/migrations/202610090001_initial.sql", "utf8"),
  );
  await db.query("insert into auth.users values ($1,$2),($3,$2),($4,$2)", [
    user,
    JSON.stringify({ name: "테스트", role: "admin" }),
    other,
    admin,
  ]);
  await db.query("insert into public.admin_users values($1)", [admin]);
});
afterAll(async () => {
  await db.close();
});
describe.sequential("실제 PostgreSQL 마이그레이션·RLS·안전 승인", () => {
  it("관리자 자기 승격 차단 / DB 입력 검증", async () => {
    await as(user);
    expect((await rpc("select role from profiles")).rows).toEqual([
      { role: "self" },
    ]);
    await expect(
      rpc("insert into admin_users values($1)", [user]),
    ).rejects.toThrow();
    await expect(
      rpc("select create_application($1)", [{ ...input, consent: false }]),
    ).rejects.toThrow();
    await expect(
      rpc("select create_application($1)", [
        {
          ...input,
          measurements: { ...input.measurements, shaft_diameter_mm: -2 },
        },
      ]),
    ).rejects.toThrow();
    app = (await rpc("select create_application($1) as id", [input])).rows[0]
      .id as string;
  });
  it("다른 신청자의 조회·파일·후기 차단", async () => {
    await as(other);
    expect((await rpc("select id from applications")).rows).toHaveLength(0);
    expect((await rpc("select can_access($1) as ok", [app])).rows[0].ok).toBe(
      false,
    );
    await expect(
      rpc("select add_feedback($1,5,$2,false)", [app, "잘 사용하고 있어요"]),
    ).rejects.toThrow();
    await expect(
      rpc("insert into storage.objects(bucket_id,name) values($1,$2)", [
        "application-photos",
        `${app}/44444444-4444-4444-8444-444444444444.png`,
      ]),
    ).rejects.toThrow();
  });
  it("일반 사용자의 상태변경·설계 등록 차단", async () => {
    await as(user);
    await expect(
      rpc("update applications set status='approved'"),
    ).rejects.toThrow();
    await expect(
      rpc("select transition_application($1,$2,$3)", [
        app,
        "measuring",
        "치수 확인",
      ]),
    ).rejects.toThrow();
    await expect(
      rpc("select add_design($1,$2,$3)", [
        app,
        `${app}/test.stl`,
        "새로운 설계 파일",
      ]),
    ).rejects.toThrow();
  });
  it("순서·현재 설계 출력 완료·안전 근거 필수", async () => {
    await as(admin);
    await expect(
      rpc("select transition_application($1,$2,$3)", [
        app,
        "approved",
        "승인 시도",
      ]),
    ).rejects.toThrow();
    for (const s of ["measuring", "designing"])
      await rpc("select transition_application($1,$2,$3)", [
        app,
        s,
        "확인 완료",
      ]);
    const path = `${app}/44444444-4444-4444-8444-444444444444.stl`;
    await rpc("insert into storage.objects(bucket_id,name) values($1,$2)", [
      "design-files",
      path,
    ]);
    design = (
      await rpc("select add_design($1,$2,$3) as id", [
        app,
        path,
        "시험용 팁 설계",
      ])
    ).rows[0].id as string;
    await rpc("select transition_application($1,$2,$3)", [
      app,
      "printing",
      "시험 제작",
    ]);
    await expect(
      rpc("select transition_application($1,$2,$3)", [
        app,
        "safety_review",
        "검토 시작",
      ]),
    ).rejects.toThrow();
    print = (
      await rpc("select add_print_job($1,$2) as id", [
        app,
        {
          design_id: design,
          material: "TPU 95A",
          printer: "프린터 A",
          duration_minutes: 60,
          result: "completed",
          notes: "인필 100%, 출력 상태 정상",
        },
      ])
    ).rows[0].id as string;
    await rpc("select transition_application($1,$2,$3)", [
      app,
      "safety_review",
      "검토 시작",
    ]);
    await expect(
      rpc("select transition_application($1,$2,$3)", [
        app,
        "approved",
        "사용 승인",
      ]),
    ).rejects.toThrow();
    await rpc("select add_safety_review($1,$2)", [
      app,
      {
        print_job_id: print,
        decision: "passed",
        protocol: "시험 프로토콜 A",
        evidence: "마찰·하중·내구성 기준 통과, 보고서 TEST-001",
        expert_name: "검토 전문가 A",
      },
    ]);
    await rpc("select transition_application($1,$2,$3)", [
      app,
      "approved",
      "전문가 검토 완료",
    ]);
  });
  it("재설계 시 승인 무효화 / 기록 변경 불가", async () => {
    const path = `${app}/55555555-5555-4555-8555-555555555555.stl`;
    await rpc("insert into storage.objects(bucket_id,name) values($1,$2)", [
      "design-files",
      path,
    ]);
    design = (
      await rpc("select add_design($1,$2,$3) as id", [
        app,
        path,
        "접지면 치수 변경",
      ])
    ).rows[0].id as string;
    expect(
      (await rpc("select status from applications where id=$1", [app])).rows[0]
        .status,
    ).toBe("designing");
    await expect(
      rpc("select transition_application($1,$2,$3)", [
        app,
        "delivered",
        "전달 시도",
      ]),
    ).rejects.toThrow();
    await expect(rpc("delete from safety_reviews")).rejects.toThrow();
    await expect(rpc("update designs set version=99")).rejects.toThrow();
  });
  it("부적합은 승인 철회 / 재검토 후 사고 신고도 사용 차단", async () => {
    await rpc("select transition_application($1,$2,$3)", [
      app,
      "printing",
      "재출력 시작",
    ]);
    print = (
      await rpc("select add_print_job($1,$2) as id", [
        app,
        {
          design_id: design,
          material: "TPU 95A",
          printer: "프린터 A",
          duration_minutes: 60,
          result: "completed",
          notes: "새 버전 출력 완료",
        },
      ])
    ).rows[0].id as string;
    await rpc("select transition_application($1,$2,$3)", [
      app,
      "safety_review",
      "검토 시작",
    ]);
    const review = {
      print_job_id: print,
      decision: "passed",
      protocol: "시험 프로토콜 B",
      evidence: "마찰·하중·내구성 통과, 보고서 TEST-002",
      expert_name: "검토 전문가 A",
    };
    await rpc("select add_safety_review($1,$2)", [app, review]);
    await rpc("select transition_application($1,$2,$3)", [
      app,
      "approved",
      "사용 승인",
    ]);
    await rpc("select add_safety_review($1,$2)", [
      app,
      { ...review, decision: "failed" },
    ]);
    await expect(
      rpc("select transition_application($1,$2,$3)", [
        app,
        "approved",
        "재승인 시도",
      ]),
    ).rejects.toThrow();
    await rpc("select add_safety_review($1,$2)", [app, review]);
    await rpc("select transition_application($1,$2,$3)", [
      app,
      "approved",
      "재검토 통과",
    ]);
    await rpc("select transition_application($1,$2,$3)", [
      app,
      "delivered",
      "현장 전달",
    ]);
    await as(user);
    await rpc("select add_feedback($1,2,$2,true)", [
      app,
      "사용 도중 지팡이 팁이 미끄러졌습니다.",
    ]);
    expect(
      (await rpc("select status from applications where id=$1", [app])).rows[0]
        .status,
    ).toBe("safety_review");
    await as(admin);
    await expect(
      rpc("select transition_application($1,$2,$3)", [
        app,
        "approved",
        "이전 검토로 재승인",
      ]),
    ).rejects.toThrow();
  });
});
