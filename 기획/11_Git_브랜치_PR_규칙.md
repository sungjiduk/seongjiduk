# 11. Git 브랜치 & PR 규칙

## 레포 전략

성지덕은 front/back 분리 repo로 관리한다.

```text
sungjiduk/seongjiduk           기획/문서/발표자료 SSOT
sungjiduk/seongjiduk-backend   Spring Boot API, LangGraph AI 서비스, 인프라
sungjiduk/seongjiduk-frontend  사용자/관리자 웹 UI
```

front/back을 나누는 이유:

- 프론트와 백엔드 담당자가 독립적으로 작업하기 쉽다.
- 각 repo의 CI를 역할에 맞게 단순화할 수 있다.
- 기획/ERD/API 명세는 `sungjiduk/seongjiduk`에만 두어 SSOT를 유지한다.

주의:

- API/ERD/기능 변경은 코드 repo PR과 별개로 문서 repo도 함께 갱신해야 한다.
- 백엔드와 프론트가 충돌하면 `기획/05_API_명세.md`를 기준으로 맞춘다.

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
