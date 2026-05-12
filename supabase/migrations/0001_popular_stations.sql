-- popular_stations: TOP-N 외국인 따릉이 대여소 랭킹 산출물.
-- ETL: bike-daily.yml GitHub Actions가 매일 04:00 KST에 service_role로 upsert.
-- 웹앱: anon 키로 read-only 조회 (RLS 정책 "Public read" 허용).

create table if not exists public.popular_stations (
  station_no       text primary key,
  station_name_ko  text not null,
  station_name_en  text,
  lat              double precision not null,
  lng              double precision not null,
  gu_ko            text not null,
  gu_en            text,
  address          text not null default '',
  rent_total       integer not null,
  rank_overall     integer not null,
  rank_in_gu       integer not null,
  hotspot_z        double precision not null,
  is_outlier       boolean not null default false,
  monthly_series   jsonb not null default '[]'::jsonb,
  updated_at       timestamptz not null default now()
);

create index if not exists popular_stations_rank_overall_idx
  on public.popular_stations (rank_overall);

create index if not exists popular_stations_gu_en_idx
  on public.popular_stations (gu_en);

alter table public.popular_stations enable row level security;

create policy "Public read"
  on public.popular_stations
  for select
  using (true);
