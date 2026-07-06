# 성지덕 웹 쇼케이스 v2 — 3막 인터랙티브 3D 여정

덕식이 스카이다이브(ACT1) → 클라우드 덱 팀 카드(ACT2) → 성지 마을 도착(ACT3)으로
이어지는 스크롤 구동 3D 쇼케이스. `holymoly.cloud`(EC2 + Nginx Proxy Manager)에 배포된다.

- 스택: Vite · three.js · GSAP ScrollTrigger · Web Audio(절차 생성 사운드, 음원 파일 없음)
- v1(`../showcase/`)은 GitHub Pages용으로 유지, 배포 타깃은 v2만 EC2.

## 로컬 개발

```bash
cd showcase-v2
npm install        # 최초 1회 (CI는 npm ci)
npm run dev        # http://localhost:5173
npm run build      # dist/ 생성 (base:'./' 상대 경로 빌드)
npm run preview    # 빌드 결과 로컬 확인
npm test           # node:test — core 순수 로직(timeline/path/stations)
```

데이터(`public/data/*.json`)는 v1 `showcase/data/`가 SSOT이며 빌드에 복사본이 포함된다.
`progress.json`만 배포 워크플로우가 GitHub 이슈 집계로 매번 새로 생성한다.

## 배포 구조

```
push(dev/main, showcase-v2/**) ─┐
schedule(*/30분, 진행률 갱신)  ─┼─▶ GitHub Actions (.github/workflows/deploy-showcase.yml)
workflow_dispatch(수동)        ─┘        │
                                         │ 1. npm ci && npm run build  → showcase-v2/dist/
                                         │ 2. showcase/scripts/build-progress.mjs
                                         │      OUT_FILE=showcase-v2/dist/data/progress.json
                                         │      API_SPEC_FILE=showcase/data/api-spec.json
                                         ▼ 3. rsync -az --delete dist/ → EC2:$DEPLOY_PATH
                              EC2 인스턴스 (정적 파일 루트)
                                         ▼
                     Nginx Proxy Manager → https://holymoly.cloud
```

- schedule 트리거는 repo **기본 브랜치**의 워크플로우 파일 기준으로 실행된다.
- 진행률 집계가 실패해도(`continue-on-error`) 빌드에 포함된 기존 progress.json으로 배포는 진행된다.
- NPM에서 `holymoly.cloud` 프록시 호스트가 `$DEPLOY_PATH`를 정적 루트로 서빙하는지 확인할 것.

## 필요한 GitHub Secrets

Settings → Secrets and variables → Actions 에 등록한다.
아래 4종이 없으면 워크플로우가 첫 스텝에서 명확한 에러로 실패한다.

| Secret        | 용도                                             | 예시                          |
| ------------- | ------------------------------------------------ | ----------------------------- |
| `EC2_HOST`    | 배포 대상 EC2 호스트(IP 또는 도메인)             | `3.xx.xx.xx`                  |
| `EC2_USER`    | SSH 접속 사용자                                  | `ubuntu`                      |
| `EC2_SSH_KEY` | SSH 개인키 전문(PEM, 개행 포함 그대로)           | `-----BEGIN OPENSSH ...`      |
| `DEPLOY_PATH` | EC2 내 정적 루트 절대 경로(끝 슬래시 없이)       | `/var/www/showcase`           |

추가(선택): `SHOWCASE_TOKEN` — private 백엔드 repo(`sungjiduk/seongjiduk-backend`) 이슈를
읽는 PAT. 미설정 시 기본 `GITHUB_TOKEN`으로 폴백하지만 private repo 집계는 실패할 수 있다.
(v1 `showcase-pages.yml`과 공유)

## 사운드

`src/ui/sound.js` — Web Audio로 바람(필터드 노이즈)·앰비언트 패드(펜타토닉 오실레이터)를
절차 생성한다. 첫 사용자 제스처(pointerdown/keydown) 이후에만 AudioContext를 시작해
브라우저 자동재생 정책을 준수하며, 우상단 `#sound-toggle`로 켜고 끈다(기본 OFF).
