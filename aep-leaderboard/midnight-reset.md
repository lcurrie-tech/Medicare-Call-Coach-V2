# Midnight reset

The TV reads saved totals from `public.leaderboard_public`. Intake submissions refresh those totals; the scheduled job also refreshes them at the start of each Chicago calendar day.

- Job: `palmetto-leaderboard-midnight-chicago`
- Schedule: every minute (`* * * * *`), including 00:00 in `America/Chicago`.
- Only rows last updated before today's Chicago midnight are recalculated. Other runs make no changes. This retries a missed reset without needing a new application.
- The existing `leaderboard_current` view supplies daily, Monday-based weekly, and AEP totals. Weekly totals roll over Monday; AEP totals retain the configured season.
- Chicago timezone calculations follow CST/CDT automatically.
- Rows updated by a new-day intake are skipped, preserving applications recorded after midnight.
- No application events are created/deleted, and the reset does not trigger shout-outs.
- An online TV displays the change on its next normal 15-second refresh.

Applied migration: `20260923214941_leaderboard_midnight_chicago_reset.sql`.

Verification on 2026-09-23: four checks passed using temporary copies and a simulated next-day clock (reset and period totals, repeat no-op, newer intake preservation, winter/summer and DST boundaries). The scheduled production job then ran successfully with `UPDATE 0`, preserving the current day's totals.

To check job runs:

```sql
select r.status, r.return_message, r.start_time
from cron.job_run_details r
join cron.job j using (jobid)
where j.jobname = 'palmetto-leaderboard-midnight-chicago'
order by r.start_time desc
limit 10;
```

To disable only this reset:

```sql
select cron.unschedule('palmetto-leaderboard-midnight-chicago');
```
