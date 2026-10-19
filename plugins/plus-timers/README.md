# Event Timers

Countdowns to AION 2's recurring events and scheduled bosses, in your server's time, nearest first.

| Event | When (server time) |
|---|---|
| Shugo Festival | every hour at :00, in your faction's field |
| Dimensional Invasion | every hour at :30, in your faction's field |
| Spacetime Rift | every 3 hours from 02:00 (the portal stays open 10 minutes) |
| Watcher Kaira | every 3 hours from 01:00, Lower Reshanta |
| Artifact Siege | Monday, Thursday and Saturday at 21:00 |
| Executors Tamasa, Argo and Kaira | Monday, Thursday and Saturday at 21:30 |
| Guardian Lord Nahma | Friday and Sunday at 21:00 |
| Daily and weekly resets | 07:00 UTC; the weekly one on Wednesday |

Each row shows how long until it starts and the start time (in this computer's time zone, or another you pick under **Settings**, or the server's own clock); a running event shows how long it has left (where the game's data says how long it runs). × hides an event; the hidden ones are listed below the others, and clicking one shows it again. Folded (the window's compact button), only the next three show.

## Alerts

Under **Alerts**, switch on the events and bosses you want an alert for, and pick how long before each one (as it starts, or 1, 2, 3, 4, 5, 10, 15, 20, 30, 45 or 60 minutes before; 5 unless you change it). An alert plays a sound and shows a message in the window, once per showing; tick **Show this window when an alert goes off** to bring the window up too. The sounds are Hidden Cube Alert's (Chime, Bell, Sparkle, Ping, Soft) and four more (Gong, Horn, Harp, Alarm), made in the plugin, with no sound files. A timer with an alert set shows a 🔔. On the **Bosses** tab, each boss has its own bell, which turns its alert on or off, and a gear, lit while the alert is on, which opens that alert under **Alerts**; a field boss covered only by **All field bosses** shows a half-lit bell. Click **Scheduled bosses** or **Field bosses** to fold that list away; the window remembers which are folded. With **Also alert as it starts** on (under Settings), an alert set for some minutes before goes off again as the event starts, or as the field boss is due.

## Server time

Each Global region's servers keep their own clock: NA East is New York time, NA West Los Angeles, Europe Berlin, South America São Paulo, Asia Seoul. The region comes from your character's server (the second digit of its number), and so does your faction (the first). Before you log in, or to see another region's times, pick it under **Settings → Server**. Korean and Taiwanese servers share their numbers and run some events on other cycles, so they aren't covered yet.

## Where the times come from

The game's own tables: `EventSchedule` and `FieldEvent` for the field events, `PeriodSpawn` for the scheduled bosses and rift portals, `RiftData` for how long a portal stays open, and names in the game's own words in every language. Maps that aren't open yet (Eltnen, Morheim, Middle Reshanta) are left out, as in Pet Soul Tracker. To rebuild `schedule.js` after a game patch, extract the client's `AION2/Content/Data/Table` and `Data/Map` to JSON, then run:

```
python tools/event-timers/build.py --tables <Output>/AION2/Content/Data/Table --tw-l10n <TW Output>/AION2/Content/Data/Table/L10N
```

Field bosses that respawn a while after they're killed (most of the world map's named bosses) aren't on a schedule, so they aren't here yet.

## Permissions

- `events:character`: your server, for its time and your faction.
- `storage`: your settings, alerts and hidden events, on this computer.
- `notify`: the alert's message in the window.
- `window`: to bring the window up when an alert goes off, if you ask for it.

Plugin API 2: needs meter 2.0.62 or later.
