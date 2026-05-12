-- events_by_station: 인기 대여소 반경 1km 내 문화행사 큐레이션.
-- ETL: events-daily.yml이 매일 05:00 KST에 ingest → curate → translate → upsert.
-- 데이터 형태: 행마다 station_no와 그 대여소의 events 배열(jsonb).

create table if not exists public.events_by_station (
  station_no   text primary key,
  events       jsonb not null default '[]'::jsonb,
  updated_at   timestamptz not null default now()
);

alter table public.events_by_station enable row level security;

create policy "Public read"
  on public.events_by_station
  for select
  using (true);
