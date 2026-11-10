"""Self-hosted, authenticated experimental photo-only metric estimation.
Models load once. Never logs or persists uploaded photos. Run behind HTTPS.
"""
import asyncio
import hmac
import io
import os
from contextlib import asynccontextmanager
import numpy as np
import torch
from PIL import Image, ImageOps, UnidentifiedImageError
from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.responses import JSONResponse
from transformers import AutoProcessor, AutoModelForZeroShotObjectDetection, DepthProForDepthEstimation, DepthProImageProcessor
from geometry import visible_dimensions

MODEL = "apple/DepthPro-hf"
DETECTOR = "IDEA-Research/grounding-dino-tiny"
TOKEN = os.environ.get("MEASUREMENT_AI_TOKEN", "")
PROMPTS = {"ramp": "door threshold.", "tip": "walking cane rubber tip.", "holder": "walking cane holder."}
NOTICE = ["기준물 없는 단일 사진의 실험적 추정입니다.", "표시된 가로·세로는 감지 영역의 정면 투영 크기이며 제작 치수가 아닙니다.", "문턱 높이·설치 공간·지팡이 내경·삽입 깊이와 가려진 면은 실측해 주세요."]
models = {}
lock = asyncio.Lock()

@asynccontextmanager
async def lifespan(app):
    if not TOKEN or len(TOKEN) < 32:
        raise RuntimeError("Set a random MEASUREMENT_AI_TOKEN of at least 32 characters")
    device = "cuda" if torch.cuda.is_available() else "cpu"
    models.update(device=device,
        dp=DepthProImageProcessor.from_pretrained(MODEL),
        depth=DepthProForDepthEstimation.from_pretrained(MODEL, use_fov_model=True).to(device).eval(),
        detector_processor=AutoProcessor.from_pretrained(DETECTOR),
        detector=AutoModelForZeroShotObjectDetection.from_pretrained(DETECTOR).to(device).eval())
    yield
    models.clear()

app = FastAPI(lifespan=lifespan)

@app.middleware("http")
async def protect(request, call_next):
    if request.url.path != "/health":
        if not TOKEN or not hmac.compare_digest(request.headers.get("authorization", ""), f"Bearer {TOKEN}"):
            return JSONResponse({"error": "Unauthorized"}, status_code=401)
        try:
            length = int(request.headers.get("content-length", "0"))
        except ValueError:
            return JSONResponse({"error": "Invalid length"}, status_code=400)
        if length > 3*1024*1024:
            return JSONResponse({"error": "Image too large"}, status_code=413)
    return await call_next(request)


def abstain(reason):
    return dict(status="needs_measurement", model=f"{MODEL} + {DETECTOR}", box=None, visible_width_mm=None, visible_height_mm=None, detection_score=None, warnings=[reason, *NOTICE])

def analyze(image, product):
    width, height = image.size
    inputs = models["detector_processor"](images=image, text=PROMPTS[product], return_tensors="pt").to(models["device"])
    with torch.inference_mode():
        output = models["detector"](**inputs)
    found = models["detector_processor"].post_process_grounded_object_detection(output, inputs.input_ids, threshold=0.35, text_threshold=0.3, target_sizes=[(height, width)])[0]
    if len(found["boxes"]) != 1:
        return abstain("대상이 하나로 명확히 감지되지 않았습니다. 대상만 정면에서 다시 촬영해 주세요.")
    box = found["boxes"][0].detach().cpu().numpy().tolist()
    box = [max(0, min(v, width if i % 2 == 0 else height)) for i, v in enumerate(box)]
    x1, y1, x2, y2 = box
    if x1 < 4 or y1 < 4 or x2 > width-4 or y2 > height-4 or min(x2-x1, y2-y1) < 20:
        return abstain("대상이 잘렸거나 너무 작습니다. 전체가 보이도록 다시 촬영해 주세요.")
    depth_inputs = models["dp"](images=image, return_tensors="pt").to(models["device"])
    with torch.inference_mode():
        raw = models["depth"](**depth_inputs)
    result = models["dp"].post_process_depth_estimation(raw, target_sizes=[(height, width)])[0]
    depth = result["predicted_depth"].squeeze().detach().cpu().numpy()
    focal = float(result["focal_length"].item())
    roi = depth[int(y1):int(y2), int(x1):int(x2)]
    valid = roi[np.isfinite(roi) & (roi > 0)]
    if valid.size < 100 or valid.size < roi.size * 0.9:
        return abstain("거리 추정 근거가 부족합니다.")
    median = float(np.median(valid))
    if (np.percentile(valid, 90)-np.percentile(valid, 10))/median > 0.3:
        return abstain("영역 안의 거리 차이가 커 치수를 추정하지 않았습니다.")
    try:
        w, h = visible_dimensions(box, width, height, median, focal)
    except ValueError:
        return abstain("추정값이 지원 범위를 벗어났습니다.")
    return dict(status="estimated", model=f"{MODEL} + {DETECTOR}", box=[x1/width,y1/height,x2/width,y2/height], visible_width_mm=w, visible_height_mm=h, detection_score=float(found["scores"][0]), warnings=NOTICE)

@app.get("/health")
async def health():
    return {"ready": bool(models)}

@app.post("/analyze")
async def endpoint(photo: UploadFile = File(...), product: str = Form(...), authorization: str = Header(default="")):
    if not TOKEN or not hmac.compare_digest(authorization, f"Bearer {TOKEN}"):
        raise HTTPException(401, "Unauthorized")
    if product not in PROMPTS or photo.content_type not in ("image/jpeg", "image/png", "image/webp"):
        raise HTTPException(400, "Invalid image/product")
    content = await photo.read(2*1024*1024+1)
    if not content or len(content) > 2*1024*1024:
        raise HTTPException(413, "Image must be at most 2MB")
    try:
        image = Image.open(io.BytesIO(content))
        if image.width*image.height > 20_000_000:
            raise ValueError("Image too large")
        image = ImageOps.exif_transpose(image).convert("RGB")
        image.thumbnail((1600,1600))
    except (UnidentifiedImageError, ValueError, OSError, Image.DecompressionBombError):
        raise HTTPException(400, "Invalid image")
    if lock.locked():
        raise HTTPException(429, "Server busy")
    async with lock:
        return await asyncio.to_thread(analyze, image, product)
