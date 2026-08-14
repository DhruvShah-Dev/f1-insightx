create or replace view public.v_driver_season_telemetry as
with idx as (
  select race_analysis_id, season::int as season, round::int as round from public.race_analysis_index
),
q as (
  select q.race_id, r.season, d.driver_code,
         least(coalesce(q.q3_time_ms, 2147483647), coalesce(q.q2_time_ms, 2147483647), coalesce(q.q1_time_ms, 2147483647)) as best_ms
  from public.qualifying_results q
  join public.races r on r.id = q.race_id
  join public.drivers d on d.id = q.driver_id
),
pole as (select race_id, min(best_ms) as pole_ms from q where best_ms < 2147483647 group by 1),
quali as (
  select q.season, q.driver_code,
         count(*)::int as quali_samples,
         percentile_cont(0.5) within group (order by (q.best_ms - p.pole_ms)/1000.0) as quali_gap_med_s
  from q join pole p on p.race_id = q.race_id
  where q.best_ms < 2147483647
  group by 1, 2
),
pace as (
  select i.season, pe.driver as driver_code,
         max(pe.team) as team,
         count(*)::int as lap_samples,
         percentile_cont(0.5) within group (order by pe.fuel_corrected_delta_s::numeric) as race_pace_delta_s,
         stddev_samp(pe.normalized_pace_delta_s::numeric) as pace_consistency_s,
         avg(pe.field_rank_on_lap::numeric) as avg_field_rank,
         min(pe.lap_time_s::numeric) as best_lap_s
  from public.race_analysis_pace_evolution pe
  join idx i on i.race_analysis_id = pe.race_analysis_id
  where pe.lap_time_s is not null and pe.fuel_corrected_delta_s is not null
  group by 1, 2
),
deg as (
  select i.season, s.driver as driver_code,
         count(*)::int as stint_samples,
         avg(s.degradation_s_per_lap::numeric) as deg_s_per_lap
  from public.race_analysis_stints s
  join idx i on i.race_analysis_id = s.race_analysis_id
  where s.stint_length::int >= 8 and s.degradation_s_per_lap::numeric between -0.5 and 0.5
  group by 1, 2
),
stand as (
  select ds.season, d.driver_code, d.full_name, c.name as constructor_name,
         ds.standing_position, ds.points, ds.wins, ds.round,
         row_number() over (partition by ds.season, ds.driver_id order by ds.round desc) as rn
  from public.driver_standings ds
  join public.drivers d on d.id = ds.driver_id
  left join public.constructors c on c.id = ds.constructor_id
)
select
  st.season,
  st.driver_code,
  st.full_name as driver_name,
  coalesce(pace.team, st.constructor_name) as team,
  st.constructor_name,
  st.standing_position,
  st.points,
  st.wins,
  st.round as standings_round,
  quali.quali_gap_med_s,
  quali.quali_samples,
  pace.race_pace_delta_s,
  pace.pace_consistency_s,
  pace.avg_field_rank,
  pace.best_lap_s,
  pace.lap_samples,
  deg.deg_s_per_lap,
  deg.stint_samples
from stand st
left join quali on quali.season = st.season and quali.driver_code = st.driver_code
left join pace on pace.season = st.season and pace.driver_code = st.driver_code
left join deg on deg.season = st.season and deg.driver_code = st.driver_code
where st.rn = 1;

create or replace view public.v_driver_lap_trace as
select
  i.season::int as season,
  i.round::int as round,
  i.race_name,
  i.circuit,
  pe.race_analysis_id,
  pe.driver as driver_code,
  pe.team,
  pe.lap_number,
  pe.compound,
  pe.stint_number,
  pe.race_phase,
  pe.lap_time_s::numeric as lap_time_s,
  pe.normalized_pace_delta_s::numeric as normalized_pace_delta_s,
  pe.fuel_corrected_delta_s::numeric as fuel_corrected_delta_s,
  pe.field_rank_on_lap::numeric as field_rank_on_lap,
  pe.tyre_age
from public.race_analysis_pace_evolution pe
join public.race_analysis_index i on i.race_analysis_id = pe.race_analysis_id;

grant select on public.v_driver_season_telemetry to anon, authenticated;
grant select on public.v_driver_lap_trace to anon, authenticated;
grant select on public.v_driver_season_telemetry to service_role;
grant select on public.v_driver_lap_trace to service_role;