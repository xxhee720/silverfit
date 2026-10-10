import { z } from "zod";
export const products = {
  ramp: {
    name: "문턱 경사로",
    subtitle: "문턱을 넘는 일, 조금 더 편안하게",
    description: "문턱과 설치 공간을 측정해 맞춤 제작을 요청하세요.",
    important: true,
    fields: {
      height_mm: "문턱 높이",
      width_mm: "문턱 너비",
      depth_mm: "문턱 깊이",
      available_length_mm: "설치 가능한 길이",
    },
  },
  tip: {
    name: "미끄럼 방지 지팡이 팁",
    subtitle: "한 걸음마다 안정적인 접지",
    description: "지팡이 끝에 맞는 교체형 팁을 검토합니다.",
    important: true,
    fields: {
      shaft_diameter_mm: "지팡이 외경",
      contact_diameter_mm: "희망 접지면 지름",
      insertion_depth_mm: "삽입 깊이",
    },
  },
  holder: {
    name: "지팡이 거치대",
    subtitle: "필요할 때, 손 닿는 곳에",
    description: "지팡이를 놓아둘 위치와 고정 방식을 확인합니다.",
    important: false,
    fields: {
      shaft_diameter_mm: "지팡이 외경",
      mounting_width_mm: "설치면 너비",
    },
  },
} as const;
export type Product = keyof typeof products;
export const statuses = {
  submitted: "신청 접수",
  measuring: "측정 확인",
  designing: "설계 검토",
  printing: "시험 제작",
  safety_review: "안전성 검토",
  approved: "사용 승인",
  delivered: "전달 완료",
  evaluating: "사용 평가",
  closed: "평가 완료",
  rejected: "제작 불가",
} as const;
export type Status = keyof typeof statuses;
export const flow: Status[] = [
  "submitted",
  "measuring",
  "designing",
  "printing",
  "safety_review",
  "approved",
  "delivered",
  "evaluating",
  "closed",
];
export const roles = {
  self: "본인",
  guardian: "보호자",
  social_worker: "복지사",
};
export const applicationSchema = z
  .object({
    product: z.enum(["ramp", "tip", "holder"]),
    applicant_role: z.enum(["self", "guardian", "social_worker"]),
    beneficiary_name: z.string().trim().min(1).max(60),
    contact: z
      .string()
      .trim()
      .regex(/^[0-9+()\- ]{8,30}$/, "연락처를 확인해 주세요."),
    environment: z.string().trim().min(2).max(1000),
    problem: z.string().trim().min(5).max(2000),
    consent: z.literal(true),
    measurements: z.record(z.string(), z.number()),
  })
  .superRefine((data, ctx) => {
    const keys = Object.keys(products[data.product].fields);
    if (Object.keys(data.measurements).length !== keys.length)
      ctx.addIssue({
        code: "custom",
        message: "제품별 필수 치수만 입력해 주세요.",
      });
    for (const key of keys) {
      const v = data.measurements[key];
      if (!Number.isFinite(v) || v <= 0 || v > 10000)
        ctx.addIssue({
          code: "custom",
          message: "치수는 0보다 크고 10,000mm 이하인 수여야 합니다.",
        });
    }
  });
export type Application = {
  id: string;
  owner_id: string;
  product: Product;
  applicant_role: keyof typeof roles;
  beneficiary_name: string;
  contact: string;
  environment: string;
  problem: string;
  measurements: Record<string, number>;
  measurement_evidence?: import("./photo-measurement").Evidence[];
  status: Status;
  created_at: string;
  updated_at: string;
};
export function allowedNext(status: Status) {
  return status === "rejected" || status === "closed"
    ? []
    : [
        ...(flow[flow.indexOf(status) + 1]
          ? [flow[flow.indexOf(status) + 1]]
          : []),
        ...(status === "delivered" || status === "evaluating"
          ? []
          : ["rejected" as Status]),
      ];
}
export function safeNext(value: unknown) {
  return typeof value === "string" &&
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.includes("\\")
    ? value
    : "/applications";
}
export const fileLimit = 10 * 1024 * 1024;
export function validatePhoto(file: File) {
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size > fileLimit ||
    file.size === 0
  )
    throw new Error("사진은 JPG·PNG·WebP 형식, 10MB 이하로 올려 주세요.");
}
export function date(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeZone: "Asia/Seoul",
  }).format(new Date(value));
}
