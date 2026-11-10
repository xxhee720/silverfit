# SilverFit iOS · Android 앱

Expo SDK 58 / React Native 네이티브 화면을 사용하는 별도 앱입니다. 웹사이트를 WebView로 감싼 앱이 아닙니다. 기존 Supabase 인증·신청·치수·비공개 사진·상태 이력·피드백을 공유합니다. 관리자 제작·설계·안전성 관리는 기존 웹에서 수행합니다.

## 포함된 기능

- 한국어 로그인/회원가입/이메일 확인/비밀번호 복구
- 플랫폼 보안 저장소에 로그인 세션 보관, 앱 백그라운드에서 갱신 중단
- 본인·보호자·복지사 신청, 제품별 필수 치수·환경·동의 입력
- 휴대폰 카메라와 앨범, 최대 1600px JPEG 정규화, 2MB 제한
- 기준 길이 + 네 지점으로 치수 계산, 사진 및 계산 근거 저장
- 기준물 없는 AI 서버 분석 요청과 참고 결과 표시 (서버 연결 필요)
- 내 신청 목록·상세·상태 이력·비공개 사진, 사진 재첨부
- 전달 후 후기·안전 문제 신고
- 개인정보 안내, 계정 삭제 요청 접수 (운영자가 처리하며 즉시 삭제는 아님)

## 개발 실행

```sh
cd mobile
pnpm install --frozen-lockfile
cp .env.example .env.local
# .env.local에 기존 프로젝트의 공개 연결값을 넣습니다.
pnpm start
```

`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `EXPO_PUBLIC_SITE_URL`을 설정합니다. publishable 키만 사용하고 서비스 역할 키·DB 비밀번호·AI 서버 토큰은 앱에 넣지 않습니다. Expo Go의 카메라·딥링크 지원은 제한될 수 있으므로 실제 검증은 개발 빌드로 진행하세요.

Supabase Redirect URLs에 아래 주소를 추가합니다. 가입과 복구 메일은 요청한 기기에서 열어야 합니다.

- `silverfit://auth/callback?type=signup`
- `silverfit://auth/callback?type=recovery`

기존 웹의 Site URL은 유지합니다. 기본 Supabase ConfirmationURL 이메일 템플릿을 사용합니다. token_hash를 웹 주소로 고정한 사용자 지정 템플릿을 사용 중이라면 모바일용 PKCE 반환 주소를 지원하도록 운영자가 수정해야 합니다. 일반 참여자의 이메일 발송에는 별도 SMTP가 필요합니다.

DB에 다음 마이그레이션을 기존 두 마이그레이션 다음으로 적용합니다.

- `202611100001_ai_requests.sql`: 계정별 분석 요청 제한
- `202611100002_account_deletion.sql`: 삭제 요청과 관리자 조회

웹의 API·개인정보·삭제 요청 페이지도 함께 배포합니다. AI 서비스는 `../services/measurement-ai/README.md`를 참고하세요. 서버를 연결하지 않아도 직접 입력과 기준물 측정으로 신청할 수 있습니다.

## 검사

```sh
pnpm typecheck
pnpm lint
pnpm export:native
pnpm dlx expo-doctor
```

타입 검사·린트·iOS/Android JS 번들 생성은 네이티브 기기 테스트나 스토어 심사를 대체하지 않습니다. 실제 계정 두 개로 서로의 신청·사진 접근 차단, 촬영 허용/거부, 사진 업로드 실패·재시도, 앱 재시작 세션, 이메일 딥링크, 재설정, 계정 삭제 요청, 안전 문제 신고를 확인하세요.

## 설치 파일과 스토어 빌드

```sh
pnpm dlx eas-cli@latest login
pnpm dlx eas-cli@latest build:configure
pnpm dlx eas-cli@latest build --platform android --profile preview
pnpm dlx eas-cli@latest build --platform ios --profile preview
# 스토어 배포용 AAB / iOS 서명 빌드
pnpm dlx eas-cli@latest build --platform all --profile production
```

본인 Expo 프로젝트를 연결하고 EAS production/preview 환경에도 세 공개 환경변수를 설정하세요. 현재 `com.xxhee720.silverfit`은 프로젝트용 제안 식별자입니다. 스토어 등록 전 소유권·중복 여부를 확인하고 확정하세요. Expo 프로젝트 ID와 Apple/Google 등록 정보는 임의로 만들지 않았습니다. iOS 기기 설치는 Apple 계정·프로비저닝이 필요하며 Android 내부 배포는 APK, Play 배포는 AAB를 사용합니다.

스토어 업로드는 개발자 계정·앱 레코드·서명을 본인이 준비한 뒤 진행합니다.

```sh
pnpm dlx eas-cli@latest submit --platform ios --latest
pnpm dlx eas-cli@latest submit --platform android --latest
```

출시 전 필수 준비:

1. Apple Developer 및 Google Play Console 계정과 Expo 프로젝트/서명, 실제 기기 테스트
2. 운영 책임 기관·연락처·보존 기준·위탁/국외 이전을 확정한 개인정보 처리방침
3. 계정 삭제 요청 담당자와 실제 삭제 처리 절차, Google의 외부 삭제 요청 URL
4. SMTP, 실사용 계정·관리자, Supabase 프로젝트 정상 가동과 모바일 반환 주소
5. AI 서버와 사진 전송 동의, 실제 정확도 검증 (미준비 시 AI는 비활성 유지)
6. App Privacy / Data Safety, 앱 설명·스크린샷·심사용 계정, 이용 연령 등 스토어 제출 자료

현재 소스만으로 스토어 등록·배포·심사가 완료된 것은 아닙니다. 기존 안전 승인 절차는 그대로 유지합니다.

공식 빌드 안내: https://docs.expo.dev/build/setup/
공식 제출 안내: https://docs.expo.dev/deploy/submit-to-app-stores/
