-- trending: AI 합성된 핫플레이스 상위 N개 (보통 5개).
-- ETL: trending-daily.yml이 매일 06:00 KST에 Reddit + Visit Seoul + NAVER →
--      Solar Pro 2 extract/synthesize → upsert.
-- 데이터 형태: rank PK로 매일 전체 교체. station_name_ko/gu_ko는 denormalized
--      (popular_stations join 회피 — 한국어 표시는 항상 동기 보장).

create table if not exists public.trending (
  rank              integer primary key,
  station_no        text not null,
  station_name_ko   text not null,
  gu_ko             text not null,
  gu_en             text,
  mention_count     integer not null,
  sentiment_avg     double precision not null,
  summary_ko        text not null,
  summary_en        text not null,
  related_event_ids jsonb not null default '[]'::jsonb,
  sources           jsonb not null default '[]'::jsonb,
  entry_updated_at  timestamptz,
  updated_at        timestamptz not null default now()
);

alter table public.trending enable row level security;

create policy "Public read"
  on public.trending
  for select
  using (true);
