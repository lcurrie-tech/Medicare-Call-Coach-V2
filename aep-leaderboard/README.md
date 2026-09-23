# Palmetto TV leaderboard

Open `index.html` through the existing raw.githack hosting URL. Click **Enable
sound** once after opening or reloading the TV browser, then use **Preview
shout-out** to check volume. The preview never writes sales or changes totals.

New application events are polled every 15 seconds. Each event gets a nine-second
celebration, confetti, a chime, and a recorded agent shout-out. Simultaneous events
queue in order. A new page session starts at the current event watermark, so it
does not announce historical sales. Webhook retries retain the same event ID and
do not create repeat celebrations. Reduced-motion preferences disable confetti
and movement while keeping the visible shout-out.

The `leaderboard-celebrations` Edge Function exposes only a numeric event ID and
agent name. It checks the existing public TV application key and never returns
client identities, contact IDs, health data, or intake payloads. It needs the
standard Supabase URL and service-role environment variables server-side.

## Audio

The six recorded MP3 files work without installed speech-synthesis voices.
Browser speech synthesis is only a fallback for new names or failed recordings.
Regenerate recordings with `generate_audio.py` (piper-tts 1.3.0 and ffmpeg). The
voice is `en_US-ljspeech-high` from rhasspy/piper-voices. Its model card identifies
the LJ Speech dataset as public domain. Only generated clips are distributed;
the model and synthesis engine are not bundled.

## Verification

Run `node --test aep-leaderboard/celebrations.test.mjs` from the repository root.
The tests cover page-load suppression, duplicate delivery, multiple submissions,
midnight resets, reconnects, and pagination. Preview the animation in a browser
and check that audio playback succeeds after enabling sound.
