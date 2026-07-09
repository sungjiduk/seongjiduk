# 발표 덱 소스 (성지덕_발표.pptx 재생성용)

## 구조
- `slides.html` — 18슬라이드 전체 디자인(Pretendard·코랄×인디고). 데모/관리자 스샷은 `../*.png` 참조(심링크 `F` 필요).
- `render_all.mjs` — slides.html의 각 `#sN` 섹션을 `rendered/slide-NN.png`로 렌더(Playwright, 시스템 Chrome).
- `assemble.mjs` — rendered PNG 18장을 풀블리드로 `.pptx` 조립(pptxgenjs).
- `dd_*.html`, `capture*.mjs` — 초기 딥다이브 이미지/서비스 스크린샷 캡처(이미 `../*.png`에 결과 있음).

## 재생성 절차 (scratchpad 등 작업폴더에서)
```
npm i playwright-core pptxgenjs        # 최초 1회
ln -sfn "/Users/teo/Project/3차 백엔드 프로젝트/발표자료/ppt" F   # 데모 스샷 경로
node render_all.mjs && node assemble.mjs
```
- 텍스트 편집은 `slides.html`에서. 폰트/색은 상단 `:root` CSS 변수.
- 팀 이름 등은 slides.html의 s4 섹션 직접 수정 후 재렌더.
