-- daily_recommendations: AI가 매일 한 번, 50개 인기 대여소 각각에 대해
-- 반경 3km 내 행사 중 오늘의 날씨/요일/컨텍스트에 맞는 5개를 큐레이션.
-- 행 수: 50 anchors × 5 picks = 250 rows (rank 1-5).
-- ETL: recommendations-daily.yml 이 매일 21:00 UTC (06:00 KST) 호출.
-- 웹앱: 사용자 geolocation → 가장 가까운 anchor → 그 anchor의 5 픽 조회.

create table if not exists public.daily_recommendations (
  anchor_station_no  text not null,
  rank               integer not null check (rank between 1 and 5),
  event_id           text not null,
  reason_ko          text not null,
  reason_en          text not null,
  distance_km        double precision not null,
  pick_date          date not null,
  updated_at         timestamptz not null default now(),
  primary key (anchor_station_no, rank)
);

create index if not exists daily_recommendations_anchor_idx
  on public.daily_recommendations (anchor_station_no);

alter table public.daily_recommendations enable row level security;

create policy "Public read"
  on public.daily_recommendations
  for select
  using (true);
