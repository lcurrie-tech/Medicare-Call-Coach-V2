-- Keep the TV's saved totals aligned with the Chicago calendar.
-- Runs at every minute boundary, including 00:00 America/Chicago.
-- Current-day rows are a no-op; a missed midnight run is retried next minute.
-- No application events are inserted/deleted and no shout-outs are generated.
CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
  'palmetto-leaderboard-midnight-chicago',
  '* * * * *',
  $job$
-- Recompute only rows that still belong to a previous Chicago calendar day.
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
       AT TIME ZONE 'America/Chicago');
  $job$
);
