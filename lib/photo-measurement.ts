import { z } from "zod";
const point = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
});
export const evidenceSchema = z.object({
  method: z.literal("photo-reference-v1"),
  field: z.string().max(60),
  reference_mm: z.number().positive().max(10000),
  image_width: z.number().int().positive().max(10000),
  image_height: z.number().int().positive().max(10000),
  points: z.array(point).length(4),
  estimated_mm: z.number().positive().max(10000),
});
export type Evidence = z.infer<typeof evidenceSchema>;
export type Point = z.infer<typeof point>;
export function estimateLength(
  points: Point[],
  width: number,
  height: number,
  referenceMm: number,
) {
  if (
    points.length !== 4 ||
    !Number.isFinite(referenceMm) ||
    referenceMm <= 0 ||
    width <= 0 ||
    height <= 0
  )
    throw new Error("기준물과 측정 지점을 확인해 주세요.");
  const distance = (a: Point, b: Point) =>
    Math.hypot((a.x - b.x) * width, (a.y - b.y) * height);
  const reference = distance(points[0], points[1]),
    target = distance(points[2], points[3]);
  if (reference < 20 || target < 5)
    throw new Error("측정 지점이 너무 가깝습니다. 더 가까이 촬영해 주세요.");
  const mm = Math.round((target / reference) * referenceMm * 10) / 10;
  if (!Number.isFinite(mm) || mm <= 0 || mm > 10000)
    throw new Error("측정 범위를 확인해 주세요.");
  return mm;
}
