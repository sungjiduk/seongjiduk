# 성지덕 팀 허브

글라스 성지덕 + 지구본 히어로 → 스크롤 → Notion식 대시보드(개요/역할/API 명세/트러블슈팅/링크).

## 열기
- 로컬 미리보기: `index.html` 더블클릭. (three.js·GSAP·Draco 디코더는 CDN이라 **인터넷 필요**)
- 배포: 이 폴더(`성지덕_허브/`)를 Vercel/Netlify에 드래그하거나 GitHub Pages로 올리면 끝.

## 트러블슈팅 로그 저장
- 기본: 브라우저 localStorage (개인 브라우저에만 저장).
- 팀 공유: **Supabase** 연결 시 실시간 공유.
  1. Supabase 프로젝트 생성 → `schema.sql` 실행.
  2. `index.html` 상단 `const SUPA = { url:'', anonKey:'' }` 에 프로젝트 URL과 anon key 입력.
  3. 저장 → 배포. 이후 모든 팀원이 같은 로그를 봄.

## 에셋
- `assets/duck_glass.glb` — 글라스용(지오메트리, 480KB). 현재 HTML에 base64로 내장됨.
- `assets/duck_textured.glb` — 텍스처 포함본(456KB). 유리 대신 원본 질감을 쓰고 싶을 때 교체용.
