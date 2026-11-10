import { z } from "zod";
export const aiResultSchema = z
  .object({
    status: z.enum(["estimated", "needs_measurement"]),
    model: z.string().min(1).max(200),
    box: z
      .tuple([
        z.number().min(0).max(1),
        z.number().min(0).max(1),
        z.number().min(0).max(1),
        z.number().min(0).max(1),
      ])
      .nullable(),
    visible_width_mm: z.number().positive().max(10000).nullable(),
    visible_height_mm: z.number().positive().max(10000).nullable(),
    detection_score: z.number().min(0).max(1).nullable(),
    warnings: z.array(z.string().max(500)).max(10),
  })
  .superRefine((r, ctx) => {
    if (
      r.status === "estimated" &&
      (!r.box || !r.visible_width_mm || !r.visible_height_mm)
    )
      ctx.addIssue({ code: "custom", message: "추정 근거가 누락되었습니다." });
    if (r.box && (r.box[0] >= r.box[2] || r.box[1] >= r.box[3]))
      ctx.addIssue({
        code: "custom",
        message: "대상 영역이 올바르지 않습니다.",
      });
    if (
      r.status === "needs_measurement" &&
      (r.visible_width_mm !== null || r.visible_height_mm !== null)
    )
      ctx.addIssue({
        code: "custom",
        message: "측정 불가 결과에 치수를 포함할 수 없습니다.",
      });
  });
export type AiResult = z.infer<typeof aiResultSchema>;
export const aiNotice =
  "AI가 찾은 영역의 화면상 가로·세로 추정치입니다. 문턱 높이·지팡이 외경 등 제작 치수와 다를 수 있으며, 제작 전 실측이 필요합니다.";
