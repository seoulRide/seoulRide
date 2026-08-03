# Supabase full dump — 2026-08-03

Supabase 프로젝트(`hrxuaqbtwyslmsmivhtw`) 삭제 전 전체 테이블 스냅샷.
PostgREST(`/rest/v1/<table>?select=*`)로 service_role 키를 사용해 추출.

| 파일 | 테이블 | 행 수 |
|------|--------|------|
| `popular_stations.json` | `public.popular_stations` | 56 |
| `events_by_station.json` | `public.events_by_station` | 56 |
| `trending.json` | `public.trending` | 5 |
| `daily_recommendations.json` | `public.daily_recommendations` | 272 |

## 복원 절차

1. 새 Supabase 프로젝트 생성
2. `supabase/migrations/0001~0004.sql`을 순서대로 실행 (스키마 + 인덱스 + RLS)
3. 데이터 주입 — 둘 중 하나:
   - SQL Editor에서 각 JSON을 `insert ... select from jsonb_populate_recordset` 으로 로드
   - 또는 `scripts/upsert/`를 로컬 산출물(`_workspace/`, `apps/mobile/assets/data/`) 기준으로 재실행
     (단, `daily_recommendations` 이력은 upsert 스크립트로 재생성 불가 — 이 덤프가 유일한 사본)
