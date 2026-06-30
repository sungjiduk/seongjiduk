# 성지덕

오덕후를 위한 성지순례 기반 AI 여행 플래너.

실제 고객이 사용할 수 있는 수준의 웹 서비스 개발 프로젝트입니다. 진행 기간은 2026-06-29 ~ 2026-07-10이며, 발표일은 2026-07-10입니다.

## 서비스 개요

사용자가 좋아하는 작품을 선택하면 지도에 실제 성지순례 스팟이 표시되고, 여행 기간/예산/스타일에 맞춰 AI가 성지 중심 여행 루트를 생성합니다.

- 팀명: 성지덕
- 서비스명: 성지덕
- MVP: 애니메이션 성지순례
- 대표 데모 콘텐츠: 러브라이브! 뮤즈
- 핵심 플로우: 작품 선택 -> 지도 스팟 확인 -> 기간/예산/출발지 선택 -> AI 루트 생성 -> 저장/공유

## AI/협업 시작점
👉 작업 전 **[`CLAUDE.md`](./CLAUDE.md)** 를 먼저 읽으세요 (SSOT·작업 규칙). `AGENTS.md`도 동일.

## 폴더 구조
```
.
├── CLAUDE.md / AGENTS.md      # AI 인수인계 지침 (SSOT)
├── .github/                    # PR/Issue 템플릿, GitHub Actions
├── 프로젝트3_요구사항.md       # 요구사항 (불변 기준)
├── 기획/                       # 모든 기획 문서 (SSOT 원본)
│   ├── 00_프로젝트_브리프.md
│   ├── 01_아이디어_초안.md      # ← 주제 브레인스토밍 (후보 4개)
│   ├── 02_최종_기획서.md
│   ├── 03_기능_명세.md
│   ├── 04_도메인_모델_ERD.md
│   ├── 05_API_명세.md
│   ├── 06_AI_에이전트_설계.md
│   ├── 07_관리자_통계_설계.md
│   ├── 08_일정_체크리스트.md
│   ├── 09_트러블슈팅.md
│   ├── 10_컨벤션.md
│   ├── 11_Git_브랜치_PR_규칙.md
│   └── decisions/              # ADR (주요 의사결정)
├── 백엔드/                     # Spring Boot (Java 25+)
├── 프론트엔드/                 # 사용자 UI
├── ai-service/                 # LangGraph (Python), REST 연동
├── 인프라/                     # docker / github-actions / cloud
└── 발표자료/                   # 슬라이드, 다이어그램 export
```

## 기술 스택
Java 25+ · Spring Boot/Security/Data JPA · LangGraph(Python) · PostgreSQL · Docker/Compose · GitHub Actions · 클라우드 1종 · HTTPS
