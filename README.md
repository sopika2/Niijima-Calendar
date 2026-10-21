# Niijima Calendar

The sisters' calendar at `calendar.niijimasisters.com`, part of the Niijima Network. It looks
like the Persona 5 in-game calendar (the date in a red starburst, slanted day numbers on
weekday plates, today in thief red) and is meant to be used every day, on a phone and on a
computer. Sae hosts it.

## What it does

- **Month view**: the main view. Each day shows its events as chips (computer) or dots
  (phone) in the colour of whose they are: Makoto's cyan, Sae's gold, red for shared.
  Tap a day for its list; double-click a day (or Shift+Enter) to add something on it.
- **Agenda**: the next 60 days grouped by day, with the host's greeting and what's next.
  Phones open here the first time; after that the app opens the view you used last.
- **Day view**: one day hour by hour, overlapping events side by side, a red line at the
  current time. Tap an hour to add an event there.
- **Keyboard** on a computer: `←`/`→` previous/next month (or day), `t` today, `n` new
  event, `Esc` closes the sheet. On a phone, swipe left/right on the month or day.
- **Events**: title, whose (Makoto / Sae / Shared, starting as whoever you are), all-day or
  start/end time, place (links to Maps) and notes. Created, edited and deleted in one sheet
  that slides up on a phone. Everything is checked again on the server.
- **Repeats**: daily, weekly on chosen weekdays, monthly on the same day, yearly, with an
  optional last day. Editing a repeating event changes the whole series. The rules are the
  ones Google Calendar and the iPhone use: monthly on the 31st skips months without one,
  yearly on 29 February only happens in leap years, and a weekly 09:00 stays at 09:00 when
  the clocks change.
- **Time zone**: `config.yml → timezone` (default Europe/Budapest). Times are stored as the
  wall-clock time you typed plus the zone, so daylight saving never moves them.
- **Makoto and Sae**: the persona switch in the header (shared with every Niijima site)
  picks whose calendar you see: hers and the shared events. Someone else's event gets a
  small tag.
- **Subscribe from a phone**: a private, read-only `.ics` feed (see below).
- **Imported calendars**: other calendars (a Google Calendar's secret iCal address…) listed
  in `config.yml` are fetched every 30 minutes and shown read-only, striped and with a
  dashed edge. If one can't be reached, the last copy stays and the Sync page says so.
- **Start-page API** for Niijima Home: `/api/upcoming` (see below).
- `/healthz` for the container health check, the 404 Palace for missing pages, and "Take
  your time" when a page is slow.

## Install on the VM

You need Docker with Compose and the Traefik + Cloudflare Tunnel setup the other Niijima
apps use (2 vCPU / 8 GB is plenty).

```sh
git clone https://github.com/sopika2/Niijima-Calendar ~/niijima-calendar && cd ~/niijima-calendar && cp .env.example .env && cp config.example.yml config.yml && nano .env && docker compose up -d --build
```

In `.env`:

1. **Discord sign-in.** Use the same Discord application as Treasure
   ([Developer Portal](https://discord.com/developers/applications) → your app → OAuth2):
   copy its Client ID and Secret into `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET`, and add
   this redirect there: **`https://calendar.niijimasisters.com/auth/callback`**
   (that is `${PUBLIC_URL}/auth/callback`).
2. **One sign-in for the whole Network.** Use the **same `SESSION_SECRET` and
   `SESSION_DOMAIN`** (`niijimasisters.com`) in every Niijima app, and you sign in once for
   all of them (the `nj_session` cookie). Create the secret once with `openssl rand -hex 32`.
3. **Who may sign in**: your Discord user ids go in `config.yml` → `access.discord_user_ids`.
   Don't know yours? Sign in once; the page shows it with a copy button.
4. **`PUBLIC_URL`** must be the real https address. Behind the Cloudflare tunnel and Traefik
   the app only sees plain http, so `compose.yml` passes `PUBLIC_URL` to it as `ORIGIN`.
   That keeps SvelteKit's CSRF check passing for form posts (saving an event) and the sign-in
   cookie `Secure`. If you run it some other way, set `ORIGIN` yourself.
5. `FEED_TOKEN` and `HOME_TOKEN`: long random strings (`openssl rand -hex 24`), or empty to
   turn the feed / API off.

Put the host's art in `./assets` (e.g. `assets/sae.webp`, PNG or WebP) and name it in
`config.yml → host.art`. Until then a silhouette stands in. Never commit game art; the repo
is public.

**Update:**

```sh
git pull && docker compose up -d --build
```

The database lives in `./data/calendar.db`; back that folder up. Migrations run on start.

## Subscribe from a phone

With `FEED_TOKEN` set, the **Sync** page (footer link) lists three private addresses, with
Copy and Subscribe buttons:

```
https://calendar.niijimasisters.com/feed/<FEED_TOKEN>.ics                  both sisters
https://calendar.niijimasisters.com/feed/<FEED_TOKEN>.ics?persona=makoto   Makoto + shared
https://calendar.niijimasisters.com/feed/<FEED_TOKEN>.ics?persona=sae      Sae + shared
```

- **iPhone**: tap **Subscribe** on the Sync page (it opens a `webcal://` link), or Settings →
  Calendar → Accounts → Add Account → Other → Add Subscribed Calendar, and paste the address.
- **Google Calendar / Android**: on a computer, open calendar.google.com → _Other calendars_
  **+** → **From URL**, paste the address. Then in the Google Calendar app on the phone, turn
  the new calendar on (Settings → the calendar → Sync). Google refreshes subscribed
  calendars on its own schedule, usually within a few hours.
- **Other Android calendars**: apps like ICSx⁵ subscribe to the address directly.

The feed is read-only and contains only the sisters' own events (imported calendars are
left out: your phone already has those from their source). Anyone with the address can read
it; change `FEED_TOKEN` to revoke every subscription at once. It is valid RFC 5545:
VTIMEZONE for the zone, RRULE for repeats, escaped and folded text.

## Import other calendars

```yaml
subscriptions:
  - name: Prosecutor's office
    url: https://calendar.google.com/calendar/ical/…/private-…/basic.ics
    owner: sae # makoto, sae or shared: who sees it
```

For Google Calendar, take Settings → the calendar → **Secret address in iCal format**.
`webcal://` addresses work too. They're fetched at start and every 30 minutes (15-second
timeout), expanded from six months back to eighteen months ahead (repeats, exceptions and
moved occurrences included), and kept in the database, so a network failure never breaks
the page. Restart after editing `config.yml`.

## Start-page API (for Niijima Home)

```sh
curl -H "Authorization: Bearer $HOME_TOKEN" \
  "https://calendar.niijimasisters.com/api/upcoming?days=7&persona=makoto"
```

```json
{
  "events": [
    {
      "title": "Court hearing",
      "start": "2026-10-22T09:30:00+02:00",
      "end": "2026-10-22T12:00:00+02:00",
      "allDay": false,
      "owner": "sae",
      "location": "District Court"
    },
    {
      "title": "Holiday",
      "start": "2026-10-23",
      "end": "2026-10-23",
      "allDay": true,
      "owner": "shared",
      "location": null
    }
  ]
}
```

- `days`: today plus the following days, 1–60, default 7. Events already over today are left
  out.
- `persona`: `makoto` or `sae` for her events plus shared ones; leave it out for everyone's.
- Timed events: ISO 8601 with the zone's offset. All-day events: dates, and `end` is the
  **last day (included)**.
- Includes imported calendars. Sorted by start, all-day first on each day.
- `401` without the right token; `404` while `HOME_TOKEN` is empty. Over the internal Docker
  network the address is `http://niijima-calendar:3000/api/upcoming`.

## Develop

```sh
pnpm install
ACCESS_MODE=off pnpm dev     # http://localhost:5181, sign-in off, config.yml optional
pnpm verify                  # prettier + eslint, svelte-check, unit tests, production build
```

Needs Node.js 22.18+ and pnpm 10. Data goes to `./data`. Set `FEED_TOKEN` / `HOME_TOKEN` in
the environment to try the feed and the API locally.

```
src/lib/dates.ts, zone.ts     calendar dates and time zones (shared with the browser)
src/lib/server/recurrence.ts  which days a series happens on (unit-tested: DST, 29 Feb, 31st)
src/lib/server/ics.ts         the .ics writer, checked against ical.js
src/lib/server/imports.ts     subscribed calendars, parsed with ical.js
src/lib/server/scope.ts       Makoto / Sae / shared
src/lib/server/db/            Drizzle schema; migrations in drizzle/
src/routes/(app)/             month, agenda, day, sync, event actions
```

Schema changes: edit `src/lib/server/db/schema.ts`, run `pnpm db:generate`, commit the new
file in `drizzle/`.
