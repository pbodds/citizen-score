"""Build the Pet Map's heatmap data: spawn points, Kibelisks and map images.

    python3 -I tools/citizen-map/build_map.py            # fetch what's missing, write the data
    python3 -I tools/citizen-map/build_map.py --offline  # only from the cache

The plugin's sources.js (from the game's tables) says which monsters drop each
soul, but not where they stand. metabot.gg's public soul pages draw those
spawns on the world map, and embed them as map pixels ("pins": every spawn of
every monster dropping the soul, per map). Its public Kibelisk lists and zone
pages place each Kibelisk, its monster pages fill in the monsters a soul page
leaves out, and its map tiles are the game's world maps.
robots.txt allows these pages and images (only /api/ is off limits, and this
never touches it). Requests go one at a time, under a second apart, and are
cached in ~/.cache/citizen-score/metabot, so a rebuild fetches only what's new.

Map pixels: every world map is an 8192 x 8192 image, cut into 256 px tiles,
2^z across at zoom z. A page's view is a window onto those tiles; its dots are
percentages of the view, so a dot's map pixel is (view origin + pct x view
span), both read off the tiles' own placement. Soul pages' "pins" are in a
smaller frame on some maps (the Abyss: 1/2 and 1/4), measured per map from the
pages' own dots, and pins no drop in sources.js accounts for are left out.

Maps metabot has no tiles for (dungeons such as Fire_Temple), and Kibelisks it
can't place, come from manual.json next to this script, filled by hand from
screenshots of the in-game map. See manual.example.json and load_manual().

Writes into plugins/plus-souls/:
  maps/<map>.webp   each world map at zoom 3 (2048 px), stitched
  mapdata.js        MAP_DATA: maps, spawns per pet, Kibelisks per map
Then prints how well the Kibelisks agree with sources.js' "nearest Kibelisk,
N m" (the same spawn medoid, measured on the map).
"""
import argparse
import hashlib
import json
import math
import os
import re
import subprocess
import sys
import tempfile
import time
import urllib.request
from urllib.parse import quote

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PLUGIN = os.path.join(ROOT, "plugins", "plus-souls")
MANUAL = os.path.join(os.path.dirname(os.path.abspath(__file__)), "manual.json")
CACHE = os.path.join(os.path.expanduser("~"), ".cache", "citizen-score", "metabot")
BASE = "https://metabot.gg"
UA = "Mozilla/5.0 (X11; Linux x86_64) citizen-score-map-builder (personal, cached)"
WORLD = 8192
STITCH_ZOOM = 3

offline = False
last_fetch = 0.0


def fetch(path, binary=False):
    """GET BASE+path through the cache. None for a 404 (a page metabot hasn't made)."""
    global last_fetch
    key = hashlib.sha1(path.encode()).hexdigest()
    file = os.path.join(CACHE, key + (".bin" if binary else ".html"))
    miss = file + ".404"
    if os.path.exists(file):
        with open(file, "rb") as f:
            data = f.read()
        return data if binary else data.decode("utf-8", "replace")
    if os.path.exists(miss) or offline:
        return None
    wait = 0.8 - (time.time() - last_fetch)
    if wait > 0:
        time.sleep(wait)
    last_fetch = time.time()
    req = urllib.request.Request(BASE + quote(path, safe="/:?=&%"), headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            data = r.read()
    except urllib.error.HTTPError as e:
        if e.code == 404:
            open(miss, "w").close()
            return None
        raise
    os.makedirs(CACHE, exist_ok=True)
    with open(file, "wb") as f:
        f.write(data)
    return data if binary else data.decode("utf-8", "replace")


def flight(html):
    """The page's React Server Components payload, unescaped into one string."""
    parts = re.findall(r'self\.__next_f\.push\(\[1,"(.*?)"\]\)', html, re.S)
    return json.loads('"' + "".join(parts) + '"') if parts else ""


def raw_json(text, at):
    """The JSON value starting at text[at]."""
    return json.JSONDecoder().raw_decode(text, at)[0]


TILE_RE = re.compile(
    r'"className":"B32I9a_spawnTile","style":\{"left":"([-\d.]+)%","top":"([-\d.]+)%",'
    r'"width":"calc\(([\d.]+)% \+ 1px\)","height":"calc\(([\d.]+)% \+ 1px\)",'
    r'"backgroundImage":"url\(/web/aion2/worldmap/([a-z0-9_]+)/(\d+)/(\d+)/(\d+)\.webp\)"')
DOT_RE = re.compile(r'"className":"B32I9a_spawnDot","data-kind":"([a-z]+)","style":\{"left":"([-\d.]+)%","top":"([-\d.]+)%"')


def view_of(p):
    """(map folder, fn(pct x, pct y) -> map pixel) for the first spawn map on a page."""
    m = TILE_RE.search(p)
    if not m:
        return None
    left, top, w, h, folder, z, x, y = m.groups()
    left, top, w, h = (float(v) / 100 for v in (left, top, w, h))
    z, x, y = int(z), int(x), int(y)
    tile = WORLD / (2 ** z)
    # The view's origin, in map pixels, and how many map pixels 100% spans.
    ox = (x - left / w) * tile
    oy = (y - top / h) * tile
    sx, sy = tile / w, tile / h
    return folder, lambda px, py: (ox + px / 100 * sx, oy + py / 100 * sy)


BLOCK_RE = re.compile(r'\["\$","div","([A-Za-z0-9_]+)",\{"className":"[A-Za-z0-9]+_spawnBlock"')


def monster_spawns(name):
    """{map id: [[x, y], ...]} from a monster's own page, one spawn map per block."""
    page = fetch(f"/en/aion-2/monsters/{slug(name)}")
    if not page:
        return {}
    p = flight(page)
    starts = list(BLOCK_RE.finditer(p))
    out = {}
    for i, m in enumerate(starts):
        block = p[m.start():starts[i + 1].start() if i + 1 < len(starts) else len(p)]
        view = view_of(block)
        if not view:
            continue
        dots = [[round(c) for c in view[1](float(x), float(y))] for kind, x, y in DOT_RE.findall(block) if kind == "monster"]
        if dots:
            out[m.group(1)] = dots
    return out


def slug(text):
    s = re.sub(r"['’]", "", str(text).lower())
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


def load_sources():
    with open(os.path.join(PLUGIN, "sources.js"), encoding="utf-8") as f:
        s = f.read()
    ps = json.loads(re.search(r"const PET_SOURCES = (\{.*?\n\});", s, re.S).group(1))
    st = json.loads(re.search(r"const SOURCE_TEXT = (\{.*?\n\});", s, re.S).group(1))
    return ps, st


def map_id(key):
    m = re.match(r"String_STR_Map_(.+)_body$", key or "")
    return m.group(1) if m else None


def image_size(path):
    out = subprocess.run(["magick", "identify", "-format", "%w %h", path + "[0]"], check=True, capture_output=True, text=True)
    w, h = out.stdout.split()
    return int(w), int(h)


def load_manual():
    """manual.json: {map id: {"image": path, "spawns": {monster: [[x, y], ...]},
    "kibelisks": [{"name": .., "x": .., "y": ..}]}}, in pixels of that image.
    Without "image", pixels of the plugin's own maps/<map>.webp. Monsters and
    Kibelisks are matched by English name or by key."""
    if not os.path.exists(MANUAL):
        return {}
    with open(MANUAL, encoding="utf-8") as f:
        data = json.load(f)
    return {k: v for k, v in data.items() if not k.startswith("_")}


def medoid(pts):
    sample = pts if len(pts) <= 400 else pts[:: max(1, len(pts) // 400)]
    return min(sample, key=lambda p: sum(math.hypot(p[0] - o[0], p[1] - o[1]) for o in sample))


def main():
    global offline
    ap = argparse.ArgumentParser()
    ap.add_argument("--offline", action="store_true", help="use only cached pages")
    ap.add_argument("--no-tiles", action="store_true", help="skip stitching the map images")
    args = ap.parse_args()
    offline = args.offline
    ps, st = load_sources()
    en = lambda k: (st.get(k) or {}).get("en", k)

    # ---- spawns, from each soul's page ----
    spawns = {}  # pet -> [[map, npc key, [[x, y], ...]], ...]
    map_pages = {}  # map id -> "/en/aion-2/map/verteron"
    folders = {}  # map id -> tile folder
    pets = [pid for pid, v in ps.items() if v.get("drops")]
    pages = []  # (pet, flight payload, pins)
    for n, pid in enumerate(pets, 1):
        page = fetch(f"/en/aion-2/items/{slug(en(ps[pid]['title']))}")
        print(f"\r souls {n}/{len(pets)}", end="", file=sys.stderr)
        if not page:
            continue
        p = flight(page)
        at = p.find('"pins":[')
        if at >= 0:
            pages.append((pid, p, raw_json(p, at + len('"pins":'))))
    print(file=sys.stderr)

    # Pins aren't always in map pixels: the Abyss's come at 1/2 (Lower
    # Reshanta) or 1/4 (Middle), as metabot keeps them in a smaller frame. The
    # page's own dots are drawn from the same pins, in the same order, as
    # percentages of the view, so each map's factor is measured on the pages
    # showing only that map, rounded to a power of two.
    pin_scale = {}
    for pid, p, pins in pages:
        maps_on = {pin.get("map") for pin in pins}
        folders_on = {m.group(5) for m in TILE_RE.finditer(p)}
        view = view_of(p)
        if len(maps_on) != 1 or len(folders_on) != 1 or not view:
            continue
        shown = [view[1](float(x), float(y)) for kind, x, y in DOT_RE.findall(p) if kind == "monster"]
        raw = [d for pin in pins for d in pin.get("dots") or []]
        ratios = sorted(s[0] / r[0] for s, r in zip(shown, raw) if r[0] > 0)
        if len(shown) == len(raw) and ratios:
            pin_scale.setdefault(maps_on.pop(), []).append(2 ** round(math.log2(ratios[len(ratios) // 2])))
    for mid, seen in pin_scale.items():
        pin_scale[mid] = max(set(seen), key=seen.count)
        if len(set(seen)) > 1:
            print(f" {mid}: pin scales disagree {sorted(set(seen))}, using {pin_scale[mid]}", file=sys.stderr)
    print(" pin scale: " + ", ".join(f"{m} x{s}" for m, s in sorted(pin_scale.items())), file=sys.stderr)

    unmatched = {}  # map id -> pins no drop in sources.js accounts for
    for pid, p, pins in pages:
        src = ps[pid]
        at = p.find('"pins":[')
        at = p.find('"open":{', at)
        if at > 0:
            map_pages.update(raw_json(p, at + len('"open":')))
        names = {}
        for d in src["drops"]:
            names.setdefault((map_id(d["map"]), en(d["npc"]).lower()), d["npc"])
        # The marks' titles name each pin's monster, in mark order.
        titles = dict(re.findall(r'"data-kind":"step","style":\{[^}]*\},"title":"([^"]*)","children":"(\d+)"', p))
        titles = {v: k for k, v in titles.items()}
        out = []
        for pin in pins:
            mid = pin.get("map")
            who = titles.get(str(pin.get("mark")), "")
            npc = names.get((mid, who.lower()))
            if npc is None:  # not matched by name: the drop on that map with that many spawns
                npc = next((d["npc"] for d in src["drops"] if map_id(d["map"]) == mid and d.get("spawns") == len(pin.get("dots") or [])), None)
            if npc is None:
                # A drop the game's tables don't list here, as on maps not
                # open yet (Middle Reshanta): it would be heat for nothing.
                unmatched[mid] = unmatched.get(mid, 0) + 1
                continue
            k = pin_scale.get(mid, 1)
            dots = [[round(x * k), round(y * k)] for x, y in pin.get("dots") or []]
            if dots:
                out.append([mid, npc, dots])
        if out:
            spawns[pid] = out
    if unmatched:
        print(" pins with no drop in sources.js, left out: " + ", ".join(f"{m} {n}" for m, n in sorted(unmatched.items())), file=sys.stderr)

    # Soul pages pin only some of a soul's monsters: the rest come from each
    # monster's own page, which plots every spawn it has.
    gaps = [(pid, d) for pid, v in ps.items() for d in v.get("drops", [])
            if not any(r[0] == map_id(d["map"]) and r[1] == d["npc"] for r in spawns.get(pid, []))]
    by_npc = {}
    for n, (pid, d) in enumerate(gaps, 1):
        print(f"\r monsters {n}/{len(gaps)}", end="", file=sys.stderr)
        if d["npc"] not in by_npc:
            by_npc[d["npc"]] = monster_spawns(en(d["npc"]))
        dots = by_npc[d["npc"]].get(map_id(d["map"]))
        if dots:
            spawns.setdefault(pid, []).append([map_id(d["map"]), d["npc"], dots])
    print(file=sys.stderr)

    # A map's tile folder is its id, lower-cased, wherever a page showed it.
    for mid in {s[0] for v in spawns.values() for s in v}:
        folders[mid] = mid.lower()

    # ---- Kibelisks ----
    # Zone pages draw every place of interest as an unnamed dot. Each
    # Kibelisk sources.js names is placed on the dot that best fits its
    # distances there ("nearest Kibelisk, N m" from each drop's spawn medoid,
    # at the map's own scale). Candidates are the dots of the zone pages
    # of every drop's area and of each map's Kibelisk list. A Kibelisk no drop
    # names is placed by its list row when the page's dots and table agree,
    # or at the centre of its own area's page.
    teleports = {}  # (map id, en name) -> (key, number)
    refs = {}  # (map id, key) -> [(medoid, m)]
    for pid, rows in spawns.items():
        for mid, npc, dots in rows:
            for d in ps[pid]["drops"]:
                if d["npc"] != npc or map_id(d["map"]) != mid:
                    continue
                c = medoid(dots)
                for k in [d.get("kibelisk")] + list((d.get("bySide") or {}).values()):
                    if k and k.get("m"):
                        refs.setdefault((mid, k["name"]), []).append((c, k["m"]))
    for v in ps.values():
        for d in v.get("drops", []):
            for k in [d.get("kibelisk")] + list((d.get("bySide") or {}).values()):
                if k:
                    teleports[(map_id(d["map"]), en(k["name"]).lower())] = (k["name"], k.get("teleport"))

    def zone_dots(path, mid):
        """(pois as map pixels, places table, the page's view) for a zone page on map mid."""
        zp = fetch(path)
        if not zp:
            return [], [], None
        q = flight(zp)
        view = view_of(q)
        if not view or view[0] != folders.get(mid):
            return [], [], None
        pois = [(float(x), float(y)) for kind, x, y in DOT_RE.findall(q) if kind == "poi"]
        at = q.find("Places of interest")
        places = re.findall(r'"th","0",\{[^}]*"children":"([^"]+)"\}\],\["\$","td","1",\{[^}]*"children":"([^"]*)"\}\],\["\$","td","2",\{[^}]*"children":"([^"]*)"', q[at:at + 60000]) if at > 0 else []
        return [view[1](*d) for d in pois], places, (pois, view)

    candidates = {}  # map id -> {(x, y)}
    listed = {}  # map id -> [(name, zone path)]
    for mid, page_path in sorted(map_pages.items()):
        if mid not in folders:
            continue
        page = fetch(page_path + "/kibelisks")
        rows = re.findall(r'\["\$","th","0",\{[^}]*"children":"([^"]+)"\}\],\["\$","td","1",\{[^}]*?"href":"(/en/aion-2/zones/[^"]+)"', flight(page)) if page else []
        listed[mid] = rows
        zones = {z for _, z in rows}
        for pid, v in ps.items():
            for d in v.get("drops", []):
                if map_id(d["map"]) == mid:
                    zones.update(f"/en/aion-2/zones/{slug(en(z))}" for z in d.get("zones") or [])
        for (m2, key) in refs:
            if m2 == mid:
                zones.add(f"/en/aion-2/zones/{slug(en(key))}")
        for i, z in enumerate(sorted(zones)):
            print(f"\r {mid} zone pages {i + 1}/{len(zones)}", end="", file=sys.stderr)
            pts, _, _ = zone_dots(z, mid)
            candidates.setdefault(mid, set()).update((round(x), round(y)) for x, y in pts)
        print(file=sys.stderr)

    def fit(rs, pts, scale):
        best = None
        for x, y in pts:
            err = sum(abs(math.hypot(x - c[0], y - c[1]) * scale - m) / max(m, 30) for c, m in rs) / len(rs)
            if best is None or err < best[0]:
                best = (err, x, y)
        return best

    # Metres per map pixel differ by map (the Abyss is drawn smaller): the
    # scale that fits the most Kibelisks closely, from 0.5 to 8.
    kibs = {}  # map id -> [{n, t, x, y}]
    fits = []
    for mid in sorted({m for m, _ in refs}):
        mine = [(key, rs) for (m, key), rs in refs.items() if m == mid]
        pts = list(candidates.get(mid, ()))
        if not pts:
            continue
        # Judged on the Kibelisks two or more drops name: one distance alone
        # fits some dot at almost any scale.
        multi = [(k, rs) for k, rs in mine if len(rs) >= 2] or mine
        scales = [0.5 * 1.03 ** i for i in range(95)]
        scale = max(scales, key=lambda sc: (sum(1 for _, rs in multi if (fit(rs, pts, sc) or (1,))[0] < 0.05), -abs(math.log(sc))))
        print(f" {mid}: {scale:.3f} m per map pixel", file=sys.stderr)
        for key, rs in mine:
            best = fit(rs, pts, scale)
            if best and best[0] < 0.25:
                number = teleports.get((mid, en(key).lower()), (None, None))[1]
                kibs.setdefault(mid, []).append({"n": key, "t": number, "x": best[1], "y": best[2]})
                fits.append(best[0])
    placed = {(mid, en(k["n"]).lower()) for mid, ks in kibs.items() for k in ks}
    for mid, rows in listed.items():
        for name, zone in rows:
            if (mid, name.lower()) in placed:
                continue
            pts, places, raw = zone_dots(zone, mid)
            if not raw:
                continue
            spots = []
            for pname, ptype, count in places:
                spots += [(pname, ptype)] * (int(count) if count.isdigit() else 1)
            pick = None
            if len(spots) == len(pts):
                idx = next((j for j, s in enumerate(spots) if s == (name, "Kibelisk")), None)
                if idx is not None:
                    pick = pts[idx]
            if pick is None and slug(name) == zone.rsplit("/", 1)[-1] and pts:
                pois, view = raw
                j = min(range(len(pois)), key=lambda i: math.hypot(pois[i][0] - 50, pois[i][1] - 50))
                pick = pts[j]
            if pick is None:
                continue
            key, number = teleports.get((mid, name.lower()), (None, None))
            kibs.setdefault(mid, []).append({"n": key or name, "t": number, "x": round(pick[0]), "y": round(pick[1])})
            placed.add((mid, name.lower()))
    if fits:
        fits.sort()
        print(f"Kibelisks placed by distance: {len(fits)}/{len(refs)}, median error {fits[len(fits) // 2]:.1%}", file=sys.stderr)

    # ---- by hand, from manual.json ----
    os.makedirs(os.path.join(PLUGIN, "maps"), exist_ok=True)
    own_image = set()
    for mid, m in load_manual().items():
        folder = folders.setdefault(mid, mid.lower())
        out = os.path.join(PLUGIN, "maps", f"{folder}.webp")
        if m.get("image"):
            # Padded to a square and scaled to the stitched size, so its
            # pixels map onto the 8192 world like a tiled map's do.
            src = os.path.expanduser(m["image"])
            if not os.path.exists(src):
                print(f" manual.json: {mid}: no image at {src}, skipped", file=sys.stderr)
                continue
            w, h = image_size(src)
            side = max(w, h)
            subprocess.run(["magick", src + "[0]", "-background", "black", "-gravity", "center",
                            "-extent", f"{side}x{side}", "-resize", f"{256 * 2 ** STITCH_ZOOM}x",
                            "-quality", "82", out], check=True)
            own_image.add(mid)
            ox, oy, k = (side - w) / 2, (side - h) / 2, WORLD / side
        elif os.path.exists(out):
            ox, oy, k = 0, 0, WORLD / image_size(out)[0]
        else:
            print(f" manual.json: {mid} has no image yet: give it one", file=sys.stderr)
            continue
        px = lambda p: [round((p[0] + ox) * k), round((p[1] + oy) * k)]
        # The Pet Map's template leaves every point at [0, 0] until filled.
        for who, pts in (m.get("spawns") or {}).items():
            pts = [p for p in pts if list(p) != [0, 0]]
            if not pts:
                continue
            hit = False
            for pid, v in ps.items():
                for d in v.get("drops", []):
                    if map_id(d["map"]) == mid and who.lower() in (d["npc"].lower(), en(d["npc"]).lower()):
                        rows = [r for r in spawns.get(pid, []) if not (r[0] == mid and r[1] == d["npc"])]
                        spawns[pid] = rows + [[mid, d["npc"], [px(p) for p in pts]]]
                        hit = True
            if not hit:
                print(f" manual.json: no soul drops from {who!r} on {mid}", file=sys.stderr)
        for kib in m.get("kibelisks") or []:
            if (kib.get("x"), kib.get("y")) == (0, 0):
                continue
            name = kib["name"]
            key, number = next(((k2, t) for (m2, n2), (k2, t) in teleports.items()
                                if m2 == mid and name.lower() in (n2, k2.lower())), (name, kib.get("teleport")))
            ks = [k2 for k2 in kibs.get(mid, []) if k2["n"] != key]
            kibs[mid] = ks + [{"n": key, "t": number, "x": px((kib["x"], kib["y"]))[0], "y": px((kib["x"], kib["y"]))[1]}]

    # ---- the map images ----
    maps = {}
    for mid, folder in sorted(folders.items()):
        if mid not in kibs and not any(s[0] == mid for v in spawns.values() for s in v):
            continue
        out = os.path.join(PLUGIN, "maps", f"{folder}.webp")
        if not args.no_tiles and mid not in own_image:
            n = 2 ** STITCH_ZOOM
            with tempfile.TemporaryDirectory() as tmp:
                files = []
                for y in range(n):
                    for x in range(n):
                        data = fetch(f"/web/aion2/worldmap/{folder}/{STITCH_ZOOM}/{x}/{y}.webp", binary=True)
                        print(f"\r {mid} tiles {y * n + x + 1}/{n * n}", end="", file=sys.stderr)
                        f = os.path.join(tmp, f"{y:02d}_{x:02d}.webp")
                        if data:
                            with open(f, "wb") as fh:
                                fh.write(data)
                        else:  # outside the map: black
                            subprocess.run(["magick", "-size", "256x256", "xc:black", f], check=True)
                        files.append(f)
                print(file=sys.stderr)
                subprocess.run(["magick", "montage", *files, "-tile", f"{n}x{n}", "-geometry", "256x256+0+0",
                                "-background", "black", "-quality", "82", out], check=True)
        if os.path.exists(out):
            maps[mid] = {"image": f"maps/{folder}.webp", "key": f"String_STR_Map_{mid}_body"}

    data = {"world": WORLD, "maps": maps, "spawns": spawns, "kibelisks": {m: k for m, k in kibs.items() if m in maps}}
    with open(os.path.join(PLUGIN, "mapdata.js"), "w", encoding="utf-8") as f:
        f.write("// The Pet Map's heatmap: each pet's spawn points and each map's Kibelisks,\n"
                "// in map pixels (8192 across). Generated by tools/citizen-map/build_map.py:\n"
                "// don't edit by hand.\n")
        f.write("const MAP_DATA = ")
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
        f.write(";\n")
    n_spawn = sum(len(s[2]) for v in spawns.values() for s in v)
    print(f"{len(spawns)} pets, {n_spawn} spawn points, "
          f"{sum(len(v) for v in data['kibelisks'].values())} Kibelisks, maps: {', '.join(maps)}", file=sys.stderr)


if __name__ == "__main__":
    main()
