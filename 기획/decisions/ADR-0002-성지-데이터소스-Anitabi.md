# ADR-0002. 성지 데이터 소스 — Anitabi API

- 상태: 승인 (Accepted)
- 날짜: 2026-07-06

## 맥락
성지(좌표·장면 정보) 데이터가 제품의 토대다. 후보는 ① 블로그/anime-tourism.jp 크롤링 ② 수작업 시드 ③ Anitabi API(api.anitabi.cn). 크롤링은 저작권·품질·시간 리스크가 크고 좌표가 없다. 수작업은 확장이 안 된다.

## 결정
- **Anitabi API를 성지 데이터 소스로 확정.** `/bangumi/{id}/lite`(작품 메타·city), `/bangumi/{id}/points/detail`(이름·좌표·장면이미지·에피소드·출처). 작품 키 = Bangumi(bgm.tv) subjectID (러브라이브 원작 = 49294).
- 관리자 임포트 엔드포인트로 당겨온다: `POST /api/admin/contents/{contentId}/spots/import {bangumiId}` (backend #32).
- 중복 방지는 `(content, name)` upsert로 시작. `external_source`/`external_id` provenance 컬럼은 A파트(테이블 소유) 조율 후 도입.
- 역지오코딩은 스위처블: Google(env 키 옵션) → 실패/무키 시 작품 city 폴백. Nominatim 공개서버는 403 정책 차단으로 폐기.

## 라이선스 정책 (중요)
- Anitabi = **CC BY-NC-SA 4.0 (비상업)**. 이 프로젝트(교육·비상업)는 사용 가능하되:
  - **출처 표기 필수** — UI 푸터 "성지 데이터: Anitabi (CC BY-NC-SA 4.0)" + SpotReference에 원출처 URL 저장.
  - **이미지 재호스팅 금지** — 장면 스크린샷은 **핫링크(URL 링크)만** 저장·표시 (backend #38, frontend #2).
- **상용 전환 시 자체 데이터로 교체**가 전제. 독점 데이터 확보가 상용 무기라는 방향과 일치.

## 결과 / 영향
- 러브라이브 36포인트 실임포트 검증 완료(34 created + 2 updated — 동명 포인트는 name-upsert로 병합됨, external_id 도입 시 해소).
- 데이터 파이프라인: 임포트(좌표·장면컷) → AI 설명 생성 → 지도/카드 노출까지 연결.
