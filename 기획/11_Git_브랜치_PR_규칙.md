# 11. Git 브랜치 & PR 규칙

## 레포 전략

성지덕은 monorepo로 관리한다.

```text
백엔드/      Spring Boot API
프론트엔드/  사용자 UI
ai-service/ LangGraph AI 서비스
인프라/      Docker, GitHub Actions, Cloud
기획/        SSOT 문서
발표자료/    발표 산출물
```

프론트/백엔드를 별도 레포로 나누지 않는 이유:

- Docker Compose, CI/CD, 배포 문서가 한 레포에서 관리되는 편이 단순하다.
- API/ERD/기능 명세 변경을 같은 PR에서 함께 추적할 수 있다.
- 2026-07-10 발표까지 일정이 짧아 레포 간 동기화 비용을 줄이는 것이 중요하다.

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

## 커밋 메시지

```text
feat: add trip generation API
fix: handle invalid login token
docs: update ERD for trip plan
infra: add docker compose skeleton
chore: initialize workspace
```

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
