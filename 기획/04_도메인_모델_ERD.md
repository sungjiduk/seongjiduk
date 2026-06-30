# 04. 도메인 모델 & ERD

> 제출물: ERD, Class Diagram. Mermaid로 관리하고 PNG는 `../발표자료/assets`로 export한다.

## 엔티티 목록

| 엔티티 | 설명 | 주요 필드 |
|--------|------|-----------|
| User | 회원 | id, email, password_hash, nickname, role, created_at |
| UserPreference | 사용자 선호 정보 | id, user_id, favorite_content_id, travel_style, budget_level |
| Content | 작품/콘텐츠 | id, title, category, country, description |
| PilgrimageSpot | 성지 스팟 | id, content_id, name, address, lat, lng, city, recommended_duration_min, reference_url |
| NearbyAttraction | 주변 일반 관광지 | id, name, address, lat, lng, category, budget_level |
| SpotReference | 성지 레퍼런스 링크 | id, spot_id, title, url, source_name |
| TripPlan | 여행 일정 | id, user_id, title, content_id, start_location, duration_days, budget_level, status |
| TripDay | 일자별 일정 | id, trip_plan_id, day_no, summary |
| TripStop | 일정 내 방문 장소 | id, trip_day_id, spot_type, spot_id, sequence, arrival_time, stay_minutes |
| VisitRecord | 방문 인증/메모 | id, user_id, spot_id, trip_plan_id, note, image_url, visited_at |
| SpotReport | 사용자 성지 제보 | id, user_id, content_id, name, address, reference_url, status |
| AiRequestLog | AI 호출 로그 | id, user_id, trip_plan_id, request_type, status, token_usage, created_at |
| UsageEvent | 접속/이용 이벤트 | id, user_id, event_type, path, created_at |
| BookingLink | 항공권/숙소 외부 링크 | id, trip_plan_id, link_type, title, url |

## ERD (Mermaid)

```mermaid
erDiagram
    USER ||--o{ USER_PREFERENCE : has
    USER ||--o{ TRIP_PLAN : creates
    USER ||--o{ VISIT_RECORD : writes
    USER ||--o{ SPOT_REPORT : submits
    USER ||--o{ AI_REQUEST_LOG : triggers
    USER ||--o{ USAGE_EVENT : generates

    CONTENT ||--o{ PILGRIMAGE_SPOT : contains
    CONTENT ||--o{ TRIP_PLAN : selected_for
    CONTENT ||--o{ SPOT_REPORT : reported_for
    PILGRIMAGE_SPOT ||--o{ SPOT_REFERENCE : has
    PILGRIMAGE_SPOT ||--o{ VISIT_RECORD : visited

    TRIP_PLAN ||--o{ TRIP_DAY : has
    TRIP_PLAN ||--o{ AI_REQUEST_LOG : generated_by
    TRIP_PLAN ||--o{ BOOKING_LINK : suggests
    TRIP_DAY ||--o{ TRIP_STOP : has

    USER {
      bigint id PK
      string email UK
      string password_hash
      string nickname
      string role
      datetime created_at
    }

    USER_PREFERENCE {
      bigint id PK
      bigint user_id FK
      bigint favorite_content_id FK
      string travel_style
      string budget_level
    }

    CONTENT {
      bigint id PK
      string title
      string category
      string country
      string description
    }

    PILGRIMAGE_SPOT {
      bigint id PK
      bigint content_id FK
      string name
      string address
      decimal lat
      decimal lng
      string city
      int recommended_duration_min
      string reference_url
    }

    SPOT_REFERENCE {
      bigint id PK
      bigint spot_id FK
      string title
      string url
      string source_name
    }

    NEARBY_ATTRACTION {
      bigint id PK
      string name
      string address
      decimal lat
      decimal lng
      string category
      string budget_level
    }

    TRIP_PLAN {
      bigint id PK
      bigint user_id FK
      bigint content_id FK
      string title
      string start_location
      int duration_days
      string budget_level
      string status
      datetime created_at
    }

    TRIP_DAY {
      bigint id PK
      bigint trip_plan_id FK
      int day_no
      string summary
    }

    TRIP_STOP {
      bigint id PK
      bigint trip_day_id FK
      string spot_type
      bigint spot_id
      int sequence
      string arrival_time
      int stay_minutes
    }

    VISIT_RECORD {
      bigint id PK
      bigint user_id FK
      bigint spot_id FK
      bigint trip_plan_id FK
      string note
      string image_url
      datetime visited_at
    }

    SPOT_REPORT {
      bigint id PK
      bigint user_id FK
      bigint content_id FK
      string name
      string address
      string reference_url
      string status
    }

    AI_REQUEST_LOG {
      bigint id PK
      bigint user_id FK
      bigint trip_plan_id FK
      string request_type
      string status
      int token_usage
      datetime created_at
    }

    USAGE_EVENT {
      bigint id PK
      bigint user_id FK
      string event_type
      string path
      datetime created_at
    }

    BOOKING_LINK {
      bigint id PK
      bigint trip_plan_id FK
      string link_type
      string title
      string url
    }
```

## Class Diagram

```mermaid
classDiagram
    class User {
      Long id
      String email
      String passwordHash
      String nickname
      Role role
    }

    class Content {
      Long id
      String title
      ContentCategory category
      String country
    }

    class PilgrimageSpot {
      Long id
      String name
      String address
      BigDecimal lat
      BigDecimal lng
      Integer recommendedDurationMin
    }

    class TripPlan {
      Long id
      String title
      Integer durationDays
      BudgetLevel budgetLevel
      TripStatus status
    }

    class TripDay {
      Long id
      Integer dayNo
      String summary
    }

    class TripStop {
      Long id
      String spotType
      Long spotId
      Integer sequence
      Integer stayMinutes
    }

    class AiRequestLog
    class UsageEvent
    class VisitRecord
    class SpotReport

    User "1" --> "*" TripPlan
    Content "1" --> "*" PilgrimageSpot
    Content "1" --> "*" TripPlan
    TripPlan "1" --> "*" TripDay
    TripDay "1" --> "*" TripStop
    User "1" --> "*" VisitRecord
    User "1" --> "*" SpotReport
    User "1" --> "*" AiRequestLog
```

## 설계 메모

- `TripStop.spot_type`은 MVP에서 `PILGRIMAGE` 또는 `ATTRACTION`으로 구분한다.
- `TripStop.spot_id`는 타입에 따라 `PilgrimageSpot` 또는 `NearbyAttraction`을 참조한다. 구현 시 다형 관계가 부담되면 `pilgrimage_spot_id`, `nearby_attraction_id`로 분리한다.
- MVP에서는 실제 지도 API 없이 위도/경도 mock 데이터로 지도 UI를 구성한다.
