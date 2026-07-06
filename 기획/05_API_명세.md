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
| GET | `/contents` | 작품 목록 조회 | X | F-3 |
| GET | `/contents/{contentId}` | 작품 상세 조회 | X | F-3 |
| GET | `/contents/{contentId}/spots` | 작품별 성지 스팟 조회 | X | F-3 |
| GET | `/spots/{spotId}` | 성지 상세 조회 | X | F-3 |
| POST | `/spot-reports` | 성지 제보 | USER | F-5 |

### GET `/contents/{contentId}/spots`

Response:

```json
{
  "contentId": 1,
  "contentTitle": "러브라이브! 뮤즈",
  "spots": [
    {
      "id": 1,
      "name": "쇼헤이바시",
      "city": "Tokyo",
      "address": "Tokyo, Japan",
      "lat": 35.0,
      "lng": 139.0,
      "recommendedDurationMin": 30,
      "referenceUrl": "https://example.com/reference"
    }
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
| GET | `/visits/me` | 내 방문 기록 조회 | USER | F-3 |
| DELETE | `/visits/{visitId}` | 방문 기록 삭제 | USER | F-3 |

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
