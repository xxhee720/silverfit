"use server";
import { evidenceSchema, estimateLength } from "@/lib/photo-measurement";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { supabase } from "@/lib/supabase/server";
import { requireUser, requireAdmin } from "@/lib/auth";
import {
  applicationSchema,
  products,
  validatePhoto,
  safeNext,
} from "@/lib/domain";
import type { ActionState } from "@/components/action-form";
const str = (f: FormData, k: string) => String(f.get(k) || "");
function message(e: unknown) {
  if (e instanceof z.ZodError)
    return {
      error:
        "입력 내용을 확인해 주세요. 필수 항목, 치수 범위, 글자 수를 확인해 주세요.",
    };
  return {
    error:
      e instanceof Error
        ? e.message
        : "처리하지 못했습니다. 다시 시도해 주세요.",
  };
}
function check(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}
export async function login(_: ActionState, f: FormData): Promise<ActionState> {
  const client = await supabase();
  const { error } = await client.auth.signInWithPassword({
    email: str(f, "email"),
    password: str(f, "password"),
  });
  if (error) return { error: "이메일과 비밀번호를 확인해 주세요." };
  redirect(safeNext(str(f, "next")));
}
export async function signup(
  _: ActionState,
  f: FormData,
): Promise<ActionState> {
  try {
    const data = z
      .object({
        email: z.email(),
        password: z.string().min(12),
        name: z.string().trim().min(1).max(60),
        role: z.enum(["self", "guardian", "social_worker"]),
      })
      .parse(Object.fromEntries(f));
    const client = await supabase();
    const { error } = await client.auth.signUp({
      email: data.email,
      password: data.password,
      options: { data: { name: data.name, role: data.role } },
    });
    check(error);
    return {
      success:
        "가입 요청을 받았습니다. 이메일의 확인 링크를 눌러 가입을 완료한 뒤 로그인해 주세요.",
    };
  } catch (e) {
    return message(e);
  }
}
export async function signout() {
  const client = await supabase();
  await client.auth.signOut();
  redirect("/");
}
export async function requestReset(
  _: ActionState,
  f: FormData,
): Promise<ActionState> {
  const client = await supabase();
  const { error } = await client.auth.resetPasswordForEmail(str(f, "email"));
  return error
    ? { error: "잠시 후 다시 요청해 주세요." }
    : { success: "등록된 주소라면 비밀번호 재설정 이메일이 발송됩니다." };
}
export async function resetPassword(
  _: ActionState,
  f: FormData,
): Promise<ActionState> {
  try {
    await requireUser();
    const p = z.string().min(12).parse(str(f, "password"));
    const client = await supabase();
    const { error } = await client.auth.updateUser({ password: p });
    check(error);
    return { success: "비밀번호를 변경했습니다." };
  } catch (e) {
    return message(e);
  }
}
export async function createApplication(
  _: ActionState,
  f: FormData,
): Promise<ActionState> {
  await requireUser();
  let id = "";
  let photoFailed = false;
  try {
    const product = z.enum(["ramp", "tip", "holder"]).parse(str(f, "product"));
    const measurements = Object.fromEntries(
      Object.keys(products[product].fields).map((k) => [k, Number(f.get(k))]),
    );
    const input = applicationSchema.parse({
      ...Object.fromEntries(f),
      product,
      measurements,
      consent: f.get("consent") === "on",
    });
    const evidence = z
      .array(evidenceSchema)
      .max(4)
      .parse(JSON.parse(str(f, "measurement_evidence") || "[]"));
    const seen = new Set<string>();
    for (const e of evidence) {
      if (
        seen.has(e.field) ||
        !(e.field in products[product].fields) ||
        estimateLength(
          e.points,
          e.image_width,
          e.image_height,
          e.reference_mm,
        ) !== e.estimated_mm ||
        measurements[e.field] !== e.estimated_mm
      )
        throw new Error("사진 치수와 입력값을 확인해 주세요.");
      seen.add(e.field);
    }
    const photo = f.get("photo");
    if (evidence.length && (!(photo instanceof File) || !photo.size))
      throw new Error("측정에 사용한 사진이 필요합니다.");
    if (photo instanceof File && photo.size) validatePhoto(photo);
    const client = await supabase();
    const { data, error } = await client.rpc("create_application", {
      payload: { ...input, measurement_evidence: evidence },
    });
    check(error);
    id = data as string;
    if (photo instanceof File && photo.size) {
      try {
        const path = `${id}/${crypto.randomUUID()}.${photo.type.split("/")[1]}`;
        const uploaded = await client.storage
          .from("application-photos")
          .upload(path, photo, { contentType: photo.type, upsert: false });
        check(uploaded.error);
        const meta = await client.from("attachments").insert({
          application_id: id,
          path,
          original_name: photo.name.slice(0, 200),
        });
        check(meta.error);
      } catch {
        photoFailed = true;
      }
    }
  } catch (e) {
    return message(e);
  }
  revalidatePath("/applications");
  redirect(`/applications/${id}${photoFailed ? "?notice=photo_failed" : ""}`);
}
export async function addPhoto(
  _: ActionState,
  f: FormData,
): Promise<ActionState> {
  await requireUser();
  try {
    const file = f.get("photo");
    if (!(file instanceof File)) throw new Error("사진을 선택해 주세요.");
    validatePhoto(file);
    const id = z.uuid().parse(str(f, "id"));
    const path = `${id}/${crypto.randomUUID()}.${file.type.split("/")[1]}`;
    const client = await supabase();
    check(
      (
        await client.storage
          .from("application-photos")
          .upload(path, file, { contentType: file.type })
      ).error,
    );
    check(
      (
        await client.from("attachments").insert({
          application_id: id,
          path,
          original_name: file.name.slice(0, 200),
        })
      ).error,
    );
    revalidatePath(`/applications/${id}`);
    return { success: "사진을 추가했습니다." };
  } catch (e) {
    return message(e);
  }
}
export async function addFeedback(
  _: ActionState,
  f: FormData,
): Promise<ActionState> {
  await requireUser();
  try {
    const d = z
      .object({
        id: z.uuid(),
        rating: z.coerce.number().int().min(1).max(5),
        comment: z.string().trim().min(5).max(2000),
      })
      .parse(Object.fromEntries(f));
    const client = await supabase();
    check(
      (
        await client.rpc("add_feedback", {
          app_id: d.id,
          score: d.rating,
          body: d.comment,
          incident: f.get("incident") === "on",
        })
      ).error,
    );
    revalidatePath(`/applications/${d.id}`);
    return { success: "의견을 전달했습니다." };
  } catch (e) {
    return message(e);
  }
}
export async function changeStatus(
  _: ActionState,
  f: FormData,
): Promise<ActionState> {
  await requireAdmin();
  try {
    const client = await supabase();
    const id = z.uuid().parse(str(f, "id"));
    check(
      (
        await client.rpc("transition_application", {
          app_id: id,
          target: str(f, "status"),
          reason: str(f, "reason"),
        })
      ).error,
    );
    revalidatePath(`/applications/${id}`);
    revalidatePath("/admin");
    return { success: "진행 상태를 변경했습니다." };
  } catch (e) {
    return message(e);
  }
}
export async function addDesign(
  _: ActionState,
  f: FormData,
): Promise<ActionState> {
  await requireAdmin();
  try {
    const id = z.uuid().parse(str(f, "id"));
    const file = f.get("file");
    if (
      !(file instanceof File) ||
      file.size === 0 ||
      file.size > 20 * 1024 * 1024 ||
      !/\.(stl|step|stp|3mf|scad)$/i.test(file.name)
    )
      throw new Error("STL·STEP·3MF·SCAD 파일(20MB 이하)을 선택해 주세요.");
    const notes = z.string().trim().min(5).max(2000).parse(str(f, "notes"));
    const client = await supabase();
    const path = `${id}/${crypto.randomUUID()}.${file.name.split(".").pop()!.toLowerCase()}`;
    check(
      (
        await client.storage.from("design-files").upload(path, file, {
          contentType: "application/octet-stream",
          upsert: false,
        })
      ).error,
    );
    check(
      (await client.rpc("add_design", { app_id: id, file_path: path, notes }))
        .error,
    );
    revalidatePath(`/applications/${id}`);
    return {
      success:
        "새 설계 버전을 등록했습니다. 기존 승인은 새 버전에 적용되지 않습니다.",
    };
  } catch (e) {
    return message(e);
  }
}
export async function addPrint(
  _: ActionState,
  f: FormData,
): Promise<ActionState> {
  await requireAdmin();
  try {
    const payload = z
      .object({
        design_id: z.uuid(),
        material: z.string().trim().min(2).max(100),
        printer: z.string().trim().min(2).max(100),
        duration_minutes: z.coerce.number().int().positive().max(100000),
        result: z.enum(["completed", "failed"]),
        notes: z.string().trim().min(5).max(2000),
      })
      .parse(Object.fromEntries(f));
    const id = z.uuid().parse(str(f, "id"));
    const client = await supabase();
    check((await client.rpc("add_print_job", { app_id: id, payload })).error);
    revalidatePath(`/applications/${id}`);
    return { success: "출력물 기록을 등록했습니다." };
  } catch (e) {
    return message(e);
  }
}
export async function addReview(
  _: ActionState,
  f: FormData,
): Promise<ActionState> {
  await requireAdmin();
  try {
    const payload = z
      .object({
        print_job_id: z.uuid(),
        decision: z.enum(["passed", "failed"]),
        protocol: z.string().trim().min(5).max(2000),
        evidence: z.string().trim().min(10).max(4000),
        expert_name: z.string().trim().min(2).max(100),
      })
      .parse(Object.fromEntries(f));
    const id = z.uuid().parse(str(f, "id"));
    const client = await supabase();
    check(
      (await client.rpc("add_safety_review", { app_id: id, payload })).error,
    );
    revalidatePath(`/applications/${id}`);
    return { success: "검토 결과를 등록했습니다." };
  } catch (e) {
    return message(e);
  }
}
