# 11. Git 브랜치 & PR 규칙

## 레포 전략

성지덕은 기획/프론트엔드/백엔드/AI 서비스 분리 repo로 관리한다.

```text
sungjiduk/seongjiduk           기획/문서/발표자료 SSOT
sungjiduk/seongjiduk-backend   Spring Boot API, 인프라
sungjiduk/seongjiduk-ai        LangGraph 기반 AI Agent 서비스
sungjiduk/seongjiduk-frontend  사용자/관리자 웹 UI
```

repo를 나누는 이유:

- 프론트와 백엔드 담당자가 독립적으로 작업하기 쉽다.
- AI Agent는 Python/LangGraph 의존성과 배포 주기가 백엔드와 다르다.
- 각 repo의 CI를 역할에 맞게 단순화할 수 있다.
- 기획/ERD/API 명세는 `sungjiduk/seongjiduk`에만 두어 SSOT를 유지한다.

주의:

- API/ERD/기능 변경은 코드 repo PR과 별개로 문서 repo도 함께 갱신해야 한다.
- 백엔드, 프론트, AI 계약이 충돌하면 `기획/05_API_명세.md`와 `기획/06_AI_에이전트_설계.md`를 기준으로 맞춘다.

## 브랜치 전략

```text
main      발표/배포 안정 브랜치
dev       개발 통합 브랜치
feat/*    기능 작업 브랜치
fix/*     버그 수정 브랜치
docs/*    문서 작업 브랜치
infra/*   인프라 작업 브랜치
chore/*   설정/잡무 브랜치
```

## 작업 흐름

1. 항상 `dev`에서 최신 상태를 받는다.
2. 작업 브랜치를 만든다.
3. 작은 단위로 커밋한다.
4. GitHub PR을 `dev` 대상으로 만든다.
5. 리뷰와 CI 통과 후 merge한다.
6. 발표/배포 안정화 시점에 `dev`에서 `main`으로 PR을 만든다.

## 브랜치 이름 예시

```text
feat/auth-signup
feat/trip-planner
feat/ai-trip-generate
feat/admin-dashboard
fix/login-token-expiry
docs/api-spec-update
infra/docker-compose
infra/github-actions
```

## PR 제목 / 커밋 메시지

PR 제목과 커밋 메시지는 같은 형식을 사용한다.

형식:

```text
[TYPE] 한국어 한 줄 요약
```

예시:

```text
[FEAT] 여행 일정 생성 API 추가
[FIX] 로그인 토큰 만료 처리 오류 수정
[DOCS] 여행 일정 ERD 갱신
[INFRA] Docker Compose 초기 구성 추가
[CHORE] 프로젝트 초기 설정 정리
```

사용 타입:

```text
FEAT / FIX / DOCS / INFRA / CHORE / REFACTOR / TEST / PERF
```

주의:

- 타입은 대문자로 작성한다.
- 대괄호를 포함한다.
- `feat:`, `fix:` 같은 소문자 conventional commit 형식은 사용하지 않는다.
- 임시 커밋이 필요하면 `[WIP]`를 사용할 수 있지만, PR merge 전에는 정상 타입으로 정리한다.

## 커밋 단위

커밋은 **작게, 하나의 관심사만** 담는다. "구현 + 테스트"를 한 커밋에 몰지 않는다.

### 원칙
- **테스트와 구현을 분리**한다. 실패하는 테스트를 먼저 커밋(`[TEST]`), 그다음 통과시키는 구현을 커밋(`[FEAT]`).
- **레이어별로 나눈다.** repository / service / controller 각각 `[TEST]`(실패) → `[FEAT]`(구현) 쌍으로.
- **선행물은 별도 커밋.** 그 기능이 쓰는 DTO·예외·enum·엔티티 메서드·설정 등은 소비하는 레이어 앞에 각각 커밋한다.
- **정리(dead code 제거, 메서드 추출)는 `[REFACTOR]`** 로 분리한다.
- 커밋 하나만 봐도 "무엇을, 왜" 바꿨는지 드러나게 한다.

### 예시 — 하나의 엔드포인트 (TRIP-007 공유)
```text
[FEAT] TripPlan에 shareToken 발급 메서드 추가      # 엔티티 선행물
[TEST] TRIP-007 공유 서비스 테스트 추가 (실패)       # service RED
[FEAT] TRIP-007 공유(share) 서비스 구현             # GREEN
```

### 예시 — 기존 로직 재사용이 필요할 때 (TRIP-002 재생성)
```text
[REFACTOR] 일자별 루트 배치를 layoutRoute로 추출     # 공유 로직 분리(동작 동일)
[TEST] TRIP-002 regenerate 서비스 테스트 추가 (실패)
[FEAT] TRIP-002 regenerate 서비스 구현
[REFACTOR] 미사용 mockTrip 헬퍼 제거                # 정리
```

### 참고
- 컨트롤러 web-slice 테스트(`@WebMvcTest`/MockMvc)는 현재 test classpath에 없어, 컨트롤러는 구현만 두고 테스트는 보류한다(추후 도입 시 추가). 서비스 테스트는 `@SpringBootTest` 사용.
- 크게 뭉쳐 커밋했다면 PR 전에 `git reset --soft` / `git rebase`로 위 단위로 재정리한다.
- 테스트 컨벤션(BDD given/when/then) 상세는 백엔드 `docs/TDD_GUIDE.md` 참고.

## PR 규칙

- PR base는 기본적으로 `dev`
- 한 PR은 하나의 목적만 가진다.
- API/ERD/기능 변경이 있으면 `기획/` 문서를 같은 PR에서 갱신한다.
- 민감정보, 키 파일, `.env` 파일은 커밋하지 않는다.
- `main`, `dev` 직접 push는 금지한다.

## GitHub 브랜치 보호 추천

### `main`

- Require a pull request before merging
- Require approvals: 1
- Require status checks to pass before merging
- Do not allow force pushes
- Do not allow deletions

### `dev`

- Require a pull request before merging
- Require approvals: 1
- Require status checks to pass before merging
- Do not allow force pushes
