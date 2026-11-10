# 기준물 없는 사진 AI 추정 서버 (실험)

Grounding DINO가 품목별 대상 영역을 자동 감지하고, Apple Depth Pro가 단일 사진의 거리와 초점 거리를 추정합니다. 감지 영역의 픽셀 가로·세로에 `픽셀 길이 × 예상 거리 / 예상 초점거리`를 적용합니다. 기준물이나 사용자 지점 선택 없이 분석을 요청할 수 있습니다.

**이 값은 정면 투영된 감지 상자의 크기이며, 보조장치의 제작 치수가 아닙니다.** 문턱의 높이·깊이, 지팡이 내경·삽입 깊이, 설치 가능한 공간은 이 결과로 자동 채우지 않습니다. 대상 오인식, 원근, 가림, 반사, 촬영 거리로 큰 오차가 생길 수 있습니다. 물체 감지 점수는 mm 정확도/신뢰구간이 아닙니다. 여러 대상·잘린 대상·작은 영역·불안정한 거리·지원 범위 밖 결과는 `needs_measurement`로 응답합니다. 이 필터가 모든 잘못된 추정을 찾아내는 것은 아닙니다.

사전 학습 모델을 조합한 구현이며 자체 학습을 수행한 모델은 아닙니다. 현재 실제 모델 가중치 추론과 실측 대비 정확도는 검증하지 않았습니다. 따라서 기본 상태는 비활성이고, 검증용 서버를 연결한 경우에만 웹에서 분석 버튼이 활성화됩니다.

## 실행

Python 3.11/3.12 및 PyTorch가 지원하는 서버를 사용합니다. 모델 로딩에는 큰 다운로드와 충분한 RAM이 필요하며 GPU를 권장합니다. CPU의 경우 웹 요청 제한시간을 초과할 수 있습니다. Vercel 함수 내부에서 이 모델을 실행하지 마세요.

```sh
cd services/measurement-ai
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
# 임의의 긴 토큰을 직접 생성해 서버 환경변수로 설정합니다. 저장소에 커밋하지 않습니다.
export MEASUREMENT_AI_TOKEN='YOUR_RANDOM_TOKEN_AT_LEAST_32_CHARACTERS'
uvicorn server:app --host 127.0.0.1 --port 8000 --workers 1
```

기동 시 모델을 한 번 로드합니다. 추론은 한 번에 하나만 실행하고 대기 중 요청은 429로 거절합니다. `/health`는 모델 준비 여부를 반환합니다. 테스트용 로컬 바인딩 이후 배포할 때는 HTTPS 리버스 프록시와 3MB 요청 본문 상한, 연결 시간 제한을 반드시 설정하세요. 모델 가중치 라이선스와 배포 조건을 먼저 검토하세요. GPU 서버를 자동으로 생성하거나 유료 서비스를 신청하지 않습니다.

Next.js 서버 환경변수:

```dotenv
MEASUREMENT_AI_URL=https://YOUR_AI_SERVER
MEASUREMENT_AI_TOKEN=THE_SAME_PRIVATE_TOKEN
```

두 값은 서버 전용입니다. `NEXT_PUBLIC_`, `EXPO_PUBLIC_`에 넣지 않습니다. `supabase/migrations/202611100001_ai_requests.sql`을 적용해야 합니다. 웹·앱은 `/api/measurements/analyze`에 로그인 세션 및 사진 전송 동의를 보냅니다. 네이티브 access token은 Next.js에서만 검증하며 모델 서버에 전달하지 않습니다. 계정별 시간당 3회로 제한하고, 실패한 분석 시도도 포함합니다. 요청 사진은 AI 서버에서 저장하지 않습니다. 프록시/인프라 운영자도 요청 본문·Authorization을 로그에 남기지 않도록 설정하세요. 남용 방지 메타데이터는 DB 운영자가 7일 이전 기록을 주기적으로 정리합니다.

모델 서버가 없으면 503 안내를 반환합니다. 인증·동의 실패, 시간 초과, 잘못된 모델 응답에 대해 가짜 치수를 만들지 않습니다. AI 결과는 현재 화면에서만 보이며 DB 최종 치수나 기존 안전 승인 함수를 변경하지 않습니다.

## 현장 정확도 검증

품목별 실제 물체·촬영 조건을 나눠 최소 30장 이상을 별도 동의로 수집하세요. 동일 물체의 사진이 학습/검증에 함께 들어가지 않도록 분리합니다. 감지 영역의 실제 가로·세로를 실측하고, 감지 실패율·측정 포기율·오인식률과 MAE(mm)·상대 오차를 함께 기록하세요. 작은 지팡이 팁과 낮은 문턱을 별도 집계해야 합니다. 허용 오차와 실제 사용 가능 범위는 제작 담당자·전문가가 먼저 정하고, 실측 확인과 하중·마찰·내구성 검증을 계속 유지합니다. 검증 전에는 자동 CAD/STL 생성 입력으로 사용하지 않습니다.

## 검증 및 출처

```sh
python -m unittest discover -p 'test_*.py'
```

위 테스트는 투영 계산의 범위·비정상 값 거부만 검증하며, 실제 AI 모델의 정확도를 보장하지 않습니다.

- Depth Pro: https://github.com/apple/ml-depth-pro
- Transformers Depth Pro: https://huggingface.co/docs/transformers/model_doc/depth_pro
- Grounding DINO: https://huggingface.co/docs/transformers/model_doc/grounding-dino
