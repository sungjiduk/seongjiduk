# 15. 시네마틱 GLB 에셋 통합 설계

> 마이페이지 "시사회(여행 미리보기)"의 절차적 three.js 씬을, 준비된 저폴리 GLB 에셋으로 교체.
> 여전히 **브라우저 실시간 렌더 + 사용자 일정별 동적**. 결정일: 2026-07-09.

## 0. 확정 결정
- **실시간 three.js + GLB 로딩** 방식 (사전 렌더 영상 X). 클릭 시 브라우저에서 그 사람 일정으로 조립·재생.
- 에셋은 `cinematic animation/assets/`의 GLB 15개 (총 341MB, 최적화 필수).
- 스토리보드(`animation_storyboard.png`, 8샷)를 기존 `journeyTimeline` 구간에 매핑.

## 1. ⚠️ 자산 최적화 (게이팅 1단계)
원본 341MB는 웹 불가 → `gltf-transform optimize`로 경량화:
- **Draco 지오메트리 압축 + 텍스처 WebP·1024 리사이즈 + meshopt 데시메이트(simplify-error 0.002)**.
- 산출은 `seongjiduk-frontend/public/cinematic/` 에 슬러그 이름으로. 목표 **총 15~25MB 이하**.
- 데시메이트가 모델을 깨뜨리면 error 완화(0.001) 또는 해당 파일 simplify 제외.

## 2. 에셋 → 씬 매핑 (슬러그)
| 슬러그 | 원본 | 용도 |
|--------|------|------|
| `world-map.glb` | 1_World_Map | 지구본/세계지도 인트로(샷1) |
| `japan.glb` | 2_Japan | 일본 줌인(샷2) |
| `diorama-base.glb` | organics_diorama | Day 섬 베이스 플랫폼(샷3~8) |
| `spot-island.glb` | 3_Spot | 보조 지형(선택) |
| `mount-fuji.glb` | mount_fuji | 디오라마 위 경관 랜드마크 |
| `map-pin.glb` | map_pin_location_pin | 정차지 핀 마커 |
| `train.glb` | toy_train | 이동체(기차) |
| `building-*.glb` ×6 | spots/* | 정차지별 랜드마크 빌딩(순환 배정) |

## 3. 스토리보드 8샷 → 타임라인 매핑
| 샷 | 스토리보드 | 기존 구간(journeyTimeline) |
|---|---|---|
| 1 | 세계지도 여행 시작 | globe intro (GLOBE_END) |
| 2 | 일본 줌인 | intro 부감 (INTRO_END) |
| 3 | 지형 사이드뷰 + 전체 경로 | Day 섬 등장 + dashed path + 핀 |
| 4·7 | 목적지 카드 + 퀘스트 | 정차 패널(ScenePanel) + 미션 |
| 5·8 | 실제 스트리트뷰 도착 | 정차 sceneImageUrl 패널 |
| 6 | 미니 기차 이동 | 스탑 간 mover 이동 (ENDING_START 전) |
- **동적**: Day 수만큼 섬, 정차지마다 핀+빌딩. 스토리보드는 시각 언어이고 타임라인이 N스탑으로 일반화.

## 4. 코드 구조 (seongjiduk-frontend/src/cinematic)
- `assetLoader.ts` (신규) — GLTFLoader + DRACOLoader(+meshopt) 싱글턴, 매니페스트, `preload()` Promise, `get(slug)` 캐시 클론. draco decoder는 `public/cinematic/draco/` 로컬 호스팅(CSP·오프라인 안전).
- `IslandBuilder.ts` (수정) — `buildIsland`가 절차적 대신 `diorama-base` 클론 배치; `buildMover`가 `train` GLB; 핀은 `map-pin`. **폴백**: 에셋 미로드 시 기존 절차적 지오메트리 유지 → 실패해도 안 깨짐.
- `globeIntro.ts` (수정) — `world-map`/`japan` GLB. 폴백 동일.
- `CinematicStage.tsx` (수정) — 빌드 전 `assetLoader.preload()` 대기(로딩 오버레이), 완료 후 씬 조립.
- `journeyTimeline.ts` — 카메라·이동 t 구동 로직 **유지**(GLB transform만 구동).
- **스팟 빌딩 지연 로드**: `building-*`는 정차 진입 시 로드(전량 프리로드 X). 미도착 시 핀만.
- 스케일·업축·센터 정규화 유틸(각 GLB bbox 기준 자동 스케일/센터).

## 5. 성능·안전
- 프리로드 대상: world-map/japan/diorama/train/map-pin/mount-fuji(코어 ~목표 <15MB). 빌딩은 지연.
- 로드 실패·CSP·저사양: 절차적 폴백으로 그레이스풀 디그레이드.
- 백그라운드 탭 rAF 스로틀은 기존과 동일(가시 탭에서 정상 재생).
- 검증: `tsc -b`+`vite build` + 브라우저 실측(마이페이지 저장 일정 → 시사회 → GLB 씬 렌더).

## 6. 스코프 아웃
- 사전 렌더 영상/하이브리드. 캐릭터 리깅 애니메이션(있으면 후속). 에셋 자체 리모델링(주신 것 그대로 최적화).

## 7. 순서
1. 에셋 최적화 → public/cinematic/ 배치·용량 확인.
2. assetLoader + 정규화 유틸.
3. globeIntro/IslandBuilder GLB 교체(폴백 유지).
4. CinematicStage 프리로드·조립 + 스팟 빌딩 지연.
5. 브라우저 실측·튜닝(스케일·카메라).
