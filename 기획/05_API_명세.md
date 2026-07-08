# 05. API 명세

> 코드의 단일 출처는 Swagger 런타임 문서다. 이 문서는 설계 기준선이며, 충돌 시 합의 후 양쪽을 갱신한다.

## 공통

- Base URL: `/api`
- 인증: Bearer JWT
- 에러 포맷:

```json
{
  "code": "ERROR_CODE",
  "message": "사용자에게 보여줄 수 있는 메시지"
}
```

## 인증 API

| Method | Path            | 설명              | 인증   | 기능ID |
|--------|-----------------|-----------------|------|--------|
| POST | `/auth/signup`  | 회원가입            | X    | F-1 |
| POST | `/auth/login`   | 로그인             | X    | F-1 |
| POST | `/auth/logout`  | 로그아웃            | USER | F-1 |
| GET | `/auth/me`      | 내 정보 조회         | USER | F-1 |
| POST | `/auth/refresh` | AccessToken 재발급 | X    | F-1 |

### POST `/auth/signup`

Request:

```json
{
  "email": "fan@example.com",
  "password": "password1234",
  "nickname": "muse_fan"
}
```

Response:

```json
{
  "id": 1,
  "email": "fan@example.com",
  "nickname": "muse_fan"
}
```

## 콘텐츠/성지 API

| Method | Path | 설명 | 인증 | 기능ID |
|--------|------|------|------|--------|
| GET | `/contents` | 작품 목록 조회 (spotCount·thumbnailUrl 포함) | X | F-3 |
| GET | `/contents/{contentId}` | 작품 상세 조회 | X | F-3 |
| GET | `/contents/{contentId}/spots` | 작품별 성지 스팟 조회 (AI 설명 병합) | X | F-3 |
| GET | `/contents/{contentId}/route-verification` | 블로그 후기 기반 검증 코스·언급 랭킹 | X | F-3 |
| GET | `/contents/{contentId}/missions` | 성지별 미션 목록 (시네마틱 여정) | X | F-3 |
| POST | `/missions/{missionId}/complete` | 미션 완료 처리 | USER | F-3 |
| GET | `/spots/{spotId}` | 성지 상세 조회 | X | F-3 |
| GET | `/spots/{spotId}/nearby-attractions` | 주변 관광지 (리뷰수 순 상위 6) | X | F-3 |
| GET | `/spots/{spotId}/nearby-restaurants` | 주변 맛집 (별점 순 상위 6) | X | F-3 |
| GET | `/spots/{spotId}/nearby?theme=` | 테마별 주변(SIGHTS·FOOD·CAFE·SHOPPING·LODGING) | X | F-3 |
| GET | `/spots/{spotId}/street-view` | 성지 Street View 이미지(프록시, 없으면 404) | X | F-3 |
| POST | `/spot-reports` | 성지 제보 | USER | F-5 |

> 외부 API 연동(Google Places/Street View)은 키 없거나 파노라마 없으면 빈 결과/404 — 프론트는 섹션을 숨긴다.
> `route-verification`은 네이버 검색+GPT 추출 파이프라인이라 첫 조회가 수십 초(작품별 캐시). 상세: `기획/06_AI_에이전트_설계.md`.

### GET `/contents/{contentId}/spots`

Response:

```json
{
  "contentId": 1,
  "contentTitle": "러브라이브! 뮤즈",
  "spots": [
    {
      "id": 1,
      "name": "神田明神",
      "koreanName": "칸다묘진",
      "city": "Tokyo",
      "address": "Tokyo, Japan",
      "lat": 35.0,
      "lng": 139.0,
      "recommendedDurationMin": 30,
      "referenceUrl": "https://example.com/reference",
      "sceneDescription": "μ's 멤버들이 자주 찾는 신사로, 학교와도 가까운 위치에 있다.",
      "specialPoint": "신사에서 소원을 비는 장면이 인상적이며, 실제로도 많은 팬들이 방문한다.",
      "sceneImageUrl": "https://image.anitabi.cn/...",
      "tips": ["오전 방문이 한산", "에마(소원패)를 남기는 팬이 많다"]
    }
  ]
}
```

> `koreanName·sceneDescription·specialPoint·sceneImageUrl·tips`는 **AI describe 결과 병합**(ai-service 미가용 시 null/원어). 05 설계 기준선에는 없던 확장 필드 — Swagger 런타임이 최신 계약이다.

### GET `/contents/{contentId}/route-verification`

Response (available=false는 네이버 키 미설정):

```json
{
  "contentId": 1,
  "available": true,
  "postCount": 12,
  "usedPostCount": 4,
  "spotMentions": [
    { "spotId": 5, "count": 3, "sources": [ { "title": "성지순례 후기", "link": "https://blog...", "postdate": "20260627" } ] }
  ],
  "verifiedPairs": [ { "fromSpotId": 5, "toSpotId": 6, "count": 3 } ],
  "courses": [
    { "rank": 1, "spotIds": [5, 6, 22], "supportCount": 3,
      "sources": [ { "title": "칸다묘진→UDX→타케무라", "link": "https://blog...", "postdate": "20260627" } ] }
  ]
}
```

## 여행 일정 API

| Method | Path | 설명 | 인증 | 기능ID |
|--------|------|------|------|--------|
| POST | `/trips/generate` | AI 일정 생성 | 선택 | F-4 |
| POST | `/trips/{tripId}/regenerate` | 스팟 추가/제외 후 AI 재생성 | 선택 | F-4 |
| POST | `/trips/{tripId}/save` | 일정 저장 | USER | F-3 |
| GET | `/trips` | 내 일정 목록 | USER | F-3 |
| GET | `/trips/{tripId}` | 일정 상세 조회 | 선택 | F-3 |
| DELETE | `/trips/{tripId}` | 일정 삭제 | USER | F-3 |
| POST | `/trips/{tripId}/share` | 공유 링크 또는 공유 문구 생성 | USER | F-3 |

### POST `/trips/generate`

Request:

```json
{
  "contentId": 1,
  "durationDays": 3,
  "budgetLevel": "NORMAL",
  "startLocation": "Tokyo Station",
  "travelStyle": "PILGRIMAGE_ONLY",
  "selectedSpotIds": [1, 2, 3],
  "excludedSpotIds": []
}
```

Response:

```json
{
  "tripId": 10,
  "title": "러브라이브! 뮤즈 2박 3일 성지순례",
  "days": [
    {
      "dayNo": 1,
      "summary": "아키하바라 주변 성지 중심 일정",
      "stops": [
        {
          "sequence": 1,
          "spotType": "PILGRIMAGE",
          "spotId": 1,
          "name": "쇼헤이바시",
          "arrivalTime": "10:00",
          "stayMinutes": 30,
          "reason": "작품 주요 장면과 연결된 대표 성지입니다."
        }
      ]
    }
  ],
  "shareText": "러브라이브! 뮤즈 성지순례 2박 3일 루트"
}
```

## 방문 인증/기록 API

| Method | Path | 설명 | 인증 | 기능ID |
|--------|------|------|------|--------|
| POST | `/visits` | 방문 인증/메모 등록 | USER | F-3 |
| GET | `/visits/me` | 내 방문 기록 조회 (성지 여권 — contentId·contentTitle 포함) | USER | F-3 |
| DELETE | `/visits/{visitId}` | 방문 기록 삭제 (소유자만) | USER | F-3 |

> `VisitResponse`에 `contentId·contentTitle` 포함 — 마이페이지가 작품별 컬렉션(성지 여권)으로 묶는다. 삭제는 소유자 검사(FORBIDDEN).

## 예약/외부 링크 API

| Method | Path | 설명 | 인증 | 기능ID |
|--------|------|------|------|--------|
| GET | `/booking-links` | 항공권/숙소 외부 링크 후보 조회 | X | F-6 |

MVP에서는 실제 예약 API를 호출하지 않는다. 검색 키워드 또는 외부 예약 사이트 링크를 제공한다.

## 이벤트 수집 API

접속자/이용 통계(`07_관리자_통계_설계.md`)의 데이터 소스다. 화면·행동 이벤트는 프론트엔드가 이 API로 전송하고, 서버 발생 이벤트(SIGNUP/LOGIN/TRIP_* 등)는 백엔드 서비스 로직에서 직접 기록한다. 수집 대상 이벤트 타입은 07의 "수집 이벤트" 표를 따른다.

| Method | Path | 설명 | 인증 | 기능ID |
|--------|------|------|------|--------|
| POST | `/events` | 접속/행동 이벤트 수집 (EVENT-001) | 선택 | F-5 |

### POST `/events`

Request:

```json
{
  "eventType": "PAGE_VIEW",
  "path": "/map",
  "targetId": 1,
  "sessionId": "anon-8f3c1a2b"
}
```

- `eventType`: 07의 이벤트 타입 (PAGE_VIEW, CONTENT_SELECTED, SPOT_VIEWED 등)
- `path`, `targetId`, `sessionId`: 선택. 비회원 식별은 `sessionId`(익명 UUID)로 처리
- 서버가 `userId`(인증 시), `occurredAt`, IP/User-Agent를 채워 `UsageEvent`로 저장한다

Response: `204 No Content`

## 관리자 API

| Method | Path | 설명 | 인증 | 기능ID |
|--------|------|------|------|--------|
| GET | `/admin/stats/overview` | 관리자 통계 요약 | ADMIN | F-5 |
| GET | `/admin/stats/visitors` | 접속자 통계 | ADMIN | F-5 |
| GET | `/admin/stats/usage` | 서비스 이용 통계 | ADMIN | F-5 |
| POST | `/admin/contents` | 작품 등록 | ADMIN | F-5 |
| PATCH | `/admin/contents/{contentId}` | 작품 수정 | ADMIN | F-5 |
| DELETE | `/admin/contents/{contentId}` | 작품 삭제 | ADMIN | F-5 |
| POST | `/admin/spots` | 성지 등록 | ADMIN | F-5 |
| PATCH | `/admin/spots/{spotId}` | 성지 수정 | ADMIN | F-5 |
| DELETE | `/admin/spots/{spotId}` | 성지 삭제 | ADMIN | F-5 |
| POST | `/admin/contents/{contentId}/spots/import` | Anitabi bangumiId로 성지 일괄 임포트 | ADMIN | F-5 |
| POST | `/admin/spots/{spotId}/missions` | 성지 미션 등록 | ADMIN | F-5 |
| PATCH | `/admin/missions/{missionId}` | 미션 수정 | ADMIN | F-5 |
| DELETE | `/admin/missions/{missionId}` | 미션 삭제 | ADMIN | F-5 |
| GET | `/admin/spot-reports` | 성지 제보 목록 | ADMIN | F-5 |
| PATCH | `/admin/spot-reports/{reportId}` | 성지 제보 처리 | ADMIN | F-5 |

### GET `/admin/stats/overview`

Response:

```json
{
  "totalUsers": 120,
  "todayVisitors": 34,
  "tripPlanCount": 88,
  "aiRequestCount": 103,
  "topContent": "러브라이브! 뮤즈",
  "topSpot": "쇼헤이바시"
}
```
