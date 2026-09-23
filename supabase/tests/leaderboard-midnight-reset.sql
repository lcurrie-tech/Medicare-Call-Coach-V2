BEGIN;
CREATE TEMP TABLE midnight_test_saved AS SELECT * FROM public.leaderboard_public;
CREATE TEMP TABLE midnight_test_results(test text, passed boolean);
DO $test$
DECLARE
  boundary timestamptz := (((now() AT TIME ZONE 'America/Chicago')::date + 1)::timestamp AT TIME ZONE 'America/Chicago');
  source_sql text;
  refresh_sql text;
  changes integer;
  expected_week bigint;
  expected_aep bigint;
  target_id bigint;
BEGIN
  source_sql := replace(pg_get_viewdef('public.leaderboard_current'::regclass, true),
                        'now()', format('%L::timestamptz',boundary));
  EXECUTE 'CREATE TEMP VIEW midnight_test_current AS ' || source_sql;
  SELECT sum(apps_this_week),sum(aep_apps) INTO expected_week,expected_aep FROM midnight_test_current;
  refresh_sql := replace(replace(replace($refresh$-- Recompute only rows that still belong to a previous Chicago calendar day.
-- The guard is checked again after row-lock waits, preserving any newer intake update.
UPDATE public.leaderboard_public AS saved
SET rank = current_totals.rank,
    full_name = current_totals.full_name,
    apps_today = current_totals.apps_today,
    apps_this_week = current_totals.apps_this_week,
    aep_apps = current_totals.aep_apps,
    calls_today = current_totals.calls_today,
    talk_time_seconds_today = current_totals.talk_time_seconds_today,
    next_milestone = current_totals.next_milestone,
    updated_at = now()
FROM public.leaderboard_current AS current_totals
JOIN public.agents AS agent ON agent.full_name = current_totals.full_name
WHERE saved.agent_id = agent.id
  AND saved.updated_at <
      (date_trunc('day', now() AT TIME ZONE 'America/Chicago')
       AT TIME ZONE 'America/Chicago');$refresh$,
                 'public.leaderboard_public','pg_temp.midnight_test_saved'),
                 'public.leaderboard_current','pg_temp.midnight_test_current'),
                 'now()',format('%L::timestamptz',boundary));
  EXECUTE refresh_sql;
  GET DIAGNOSTICS changes = ROW_COUNT;
  INSERT INTO midnight_test_results
    SELECT 'midnight clears previous-day apps and retains period totals',
           changes = (SELECT count(*) FROM public.leaderboard_public)
           AND sum(apps_today)=0 AND sum(apps_this_week)=expected_week AND sum(aep_apps)=expected_aep
    FROM midnight_test_saved;
  EXECUTE refresh_sql;
  GET DIAGNOSTICS changes = ROW_COUNT;
  INSERT INTO midnight_test_results VALUES ('repeated refresh is a no-op',changes=0);
  SELECT min(agent_id) INTO target_id FROM midnight_test_saved;
  UPDATE midnight_test_saved SET apps_today=1, apps_this_week=apps_this_week+1,
    updated_at=boundary + interval '1 second' WHERE agent_id=target_id;
  EXECUTE refresh_sql;
  INSERT INTO midnight_test_results SELECT 'new-day intake update is preserved',apps_today=1
    FROM midnight_test_saved WHERE agent_id=target_id;
  IF EXISTS(SELECT 1 FROM midnight_test_results WHERE passed IS DISTINCT FROM true)
  THEN RAISE EXCEPTION 'midnight refresh verification failed'; END IF;
END $test$;
INSERT INTO midnight_test_results
SELECT 'Chicago midnight follows CST/CDT across both DST changes',
 bool_and(actual=expected)
FROM (
 VALUES
 ('2026-01-15 00:00'::timestamp AT TIME ZONE 'America/Chicago','2026-01-15 06:00+00'::timestamptz),
 ('2026-07-15 00:00'::timestamp AT TIME ZONE 'America/Chicago','2026-07-15 05:00+00'::timestamptz),
 ('2026-03-08 00:00'::timestamp AT TIME ZONE 'America/Chicago','2026-03-08 06:00+00'::timestamptz),
 ('2026-03-09 00:00'::timestamp AT TIME ZONE 'America/Chicago','2026-03-09 05:00+00'::timestamptz),
 ('2026-11-01 00:00'::timestamp AT TIME ZONE 'America/Chicago','2026-11-01 05:00+00'::timestamptz),
 ('2026-11-02 00:00'::timestamp AT TIME ZONE 'America/Chicago','2026-11-02 06:00+00'::timestamptz)
) t(actual,expected);
SELECT * FROM midnight_test_results;
ROLLBACK;