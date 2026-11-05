#!/usr/bin/env python3
"""Citizen Score: build plugins/plus-builds/skills.js from aion2-meta's class
guides: every active skill (priority, share of top players at level 20+,
global average level, the level to raise it to and the specialty that goes in
at each skill level, PvE and PvP) and every passive (whether to look for it on
gear, shares, global average level).

aion2-meta has no PvP specialties for some classes and none at all for rarely
used skills. With MBDIR, MetaBot's class build pages (every skill's 5
specialties, from the client) fill those gaps with an estimate marked `est`.

    curl -o DLDIR/<class>.html https://aion2-meta.com/guides/<class>/   (×8)
    curl -o MBDIR/<class>.html https://metabot.gg/en/aion-2/classes/<class>/build   (×8)
    plus/scrape_skills.py DLDIR plugins/plus-builds/skills.js MBDIR
"""
import html as H
import json
import re
import sys
from datetime import date
from html.parser import HTMLParser

CLASSES = ["gladiator", "templar", "assassin", "ranger", "sorcerer", "spiritmaster", "cleric", "chanter"]


def section(page, heading):
    i = page.find(">" + heading + "<")
    if i < 0:
        return ""
    j = page.find("<h2", i + 10)
    return page[i : j if j > 0 else len(page)]


class Rows(HTMLParser):
    """Each <tbody> row: its cells, each with its text, the first skill span
    (data-tip-title / data-tip / data-tip-meta), its tag, and for specialty
    cells (td.specs) the list items and the note under them."""

    def __init__(self):
        super().__init__()
        self.rows, self.row, self.cell, self.li, self.cap, self.in_body = [], None, None, None, None, False

    def handle_starttag(self, t, a):
        a = dict(a)
        c = (a.get("class") or "").split()
        if t == "tbody":
            self.in_body = True
        if not self.in_body:
            return
        if t == "tr":
            self.row = []
        elif t == "td" and self.row is not None:
            self.cell = {"cls": c, "mode": a.get("data-mode"), "text": "", "tag": "", "skill": None, "items": [], "note": "", "after": False}
            self.row.append(self.cell)
        if self.cell is None:
            return
        if t == "span" and "sk" in c and not self.cell["skill"]:
            self.cell["skill"] = {"name": a.get("data-tip-title"), "tip": a.get("data-tip") or "", "meta": a.get("data-tip-meta") or ""}
        elif t == "span" and "tag" in c:
            self.cap = "tag"
        elif t == "li":
            self.li = {"alts": [], "lv": ""}
            self.cell["items"].append(self.li)
        elif t == "span" and "spi" in c and self.li is not None:
            self.li["alts"].append({"name": a.get("data-tip-title"), "meta": a.get("data-tip-meta") or ""})
        elif t == "span" and "lv" in c:
            self.cap = "lv"
        elif t == "small" and self.cell["after"]:
            self.cap = "note"

    def handle_endtag(self, t):
        if t == "tbody":
            self.in_body = False
        if t == "tr" and self.row is not None:
            if self.row:
                self.rows.append(self.row)
            self.row = None
        elif t == "td":
            self.cell = None
        elif t == "li":
            self.li = None
        elif t == "ul" and self.cell is not None:
            self.cell["after"] = True
        if t in ("span", "small"):
            self.cap = None

    def handle_data(self, d):
        if self.cell is None:
            return
        self.cell["text"] += d
        if self.cap == "tag":
            self.cell["tag"] += d
        elif self.cap == "lv" and self.li is not None:
            self.li["lv"] += d
        elif self.cap == "note":
            self.cell["note"] += d


def rows(fragment):
    p = Rows()
    p.feed(fragment)
    return p.rows


def num(text):
    m = re.search(r"-?\d+(?:\.\d+)?", text.replace(",", ""))
    return float(m.group()) if m else None


def clean(s):
    return re.sub(r"\s+", " ", H.unescape(s or "")).strip()


def mode_plan(cell):
    to = num(cell["tag"]) if cell["tag"] else None
    slots = []
    for li in cell["items"]:
        picks = []
        for alt in li["alts"]:
            m = re.search(r"Specialty (\d+) of (\d+).*?level (\d+)", alt["meta"])
            picks.append([clean(alt["name"]), int(m.group(1)) if m else 0, int(m.group(3)) if m else 0])
        slots.append([int(num(li["lv"]) or 0), picks])
    return {"tag": clean(cell["tag"]), "to": int(to) if to else None, "slots": slots, "note": clean(cell["note"])}


def parse(page):
    actives = {}
    order = []
    for r in rows(section(page, "Active skills: what to level first")):
        sk = r[0]["skill"]
        if not sk or len(r) < 5:
            continue
        name = clean(sk["name"])
        order.append(name)
        actives[name] = {
            "n": name, "tip": clean(sk["tip"]), "meta": clean(sk["meta"]), "pri": clean(r[1]["tag"] or r[1]["text"]),
            "pve20": num(r[2]["text"]), "pvp20": num(r[3]["text"]), "avg": num(r[4]["text"]),
            "pve": None, "pvp": None,
        }
    for r in rows(section(page, "Skill specialties: which to take")):
        sk = r[0]["skill"]
        if not sk:
            continue
        name = clean(sk["name"])
        a = actives.get(name)
        if a is None:
            order.append(name)
            a = actives[name] = {"n": name, "tip": clean(sk["tip"]), "meta": clean(sk["meta"]), "pri": "", "pve20": None, "pvp20": None, "avg": None, "pve": None, "pvp": None}
        if a["avg"] is None:
            a["avg"] = num(r[0]["text"].split("Global now:")[-1]) if "Global now:" in r[0]["text"] else None
        for cell in r[1:]:
            if "specs" in cell["cls"] and cell["mode"] in ("PvE", "PvP"):
                a[cell["mode"].lower()] = mode_plan(cell)
    passives = []
    for r in rows(section(page, "Passive skills: which ones to raise with gear")):
        sk = r[0]["skill"]
        if not sk or len(r) < 5:
            continue
        passives.append({
            "n": clean(sk["name"]), "tip": clean(sk["tip"]), "meta": clean(sk["meta"]), "verdict": clean(r[1]["tag"] or r[1]["text"]),
            "pve": num(r[2]["text"]), "pvp": num(r[3]["text"]), "avg": num(r[4]["text"]),
        })
    sample = re.search(r"The top (\d+) players of this class on the global servers \(([^)]*)\)", page)
    return {
        "sample": f"top {sample.group(1)} global players, {sample.group(2)}" if sample else "",
        "actives": [actives[n] for n in order],
        "passives": passives,
    }


def catalog(page):
    """MetaBot's class build page lists all 5 specialties of every active
    (client data): {skill: {k: [effect, opens at]}}. The icon id ends in k×10,
    the same numbering as aion2-meta's "Specialty k of 5"."""
    i = page.find("specializations by skill level</caption>")
    j = page.find("</table>", i)
    out = {}
    if i < 0:
        return out
    for m in re.finditer(r'<tr><th scope="row">.*?stigma%2F(\d+)\.webp.*?_nameText">(.*?)</span>.*?<td class="[^"]*">Lv\. (\d+)</td><td><span class="[^"]*">(.*?)</span>', page[i:j], re.S):
        sid, name, lv, eff = m.groups()
        eff = clean(re.sub(r"<[^>]+>", "", eff))
        # "Absorbs 70, 70% HP" is the client's raw value: 70 = 0.7% (aion2-meta's wording).
        eff = re.sub(r"(Absorbs|absorbs) (\d+), \2% HP", lambda g: f"{g.group(1)} {int(g.group(2)) / 100:g}% HP", eff)
        out.setdefault(clean(name), {})[int(sid[-2:]) // 10] = [eff, int(lv)]
    return out


# What a specialty does, to learn which kinds top players take in PvE and PvP.
KINDS = [
    ("absorb", r"absorbs|hp restored|restores [\d.,]+%? hp|restores .*hp"),
    ("mp", r"\bmp\b"),
    ("stamina", r"stamina"),
    ("speed", r"skill speed|combat speed"),
    ("crit", r"critical hit|skill critical"),
    ("multihit", r"multi-hit"),
    ("pierce", r"ignores block|ignores evasion|perfect"),
    ("cooldown", r"cooldown|consecutive use"),
    ("damage", r"damage|additional attack|attack"),
    ("aoe", r"aoe|more targets|up to \d+ enemies"),
    ("mobile", r"mobile"),
    ("range", r"range"),
    ("cc", r"stun|knock|pull|root|slow|bind|silence|seal|shackl|incapacitat|fear|snare|move speed reduction"),
    ("chain", r"chain skill"),
    ("duration", r"duration"),
    ("defense", r"tolerance|defense|tenacity|resist|shield|block"),
    ("enmity", r"enmity"),
    ("movement", r"move speed|moves to|rush|teleport"),
]


def kinds(effect):
    e = effect.lower()
    return [k for k, rx in KINDS if re.search(rx, e)] or ["other"]


def learn(data, cats):
    """Per mode, per kind: the share of offered specialties of that kind that
    the published picks take (Laplace-smoothed toward the overall share)."""
    rates = {}
    for mode in ("pve", "pvp"):
        took, offered = {}, {}
        for c in CLASSES:
            for a in data[c]["actives"]:
                p, cat = a.get(mode), cats[c].get(a["n"])
                if not p or not p["slots"] or not cat:
                    continue
                picked = {k for _, picks in p["slots"] for _, k, _ in picks}
                for k, (eff, _) in cat.items():
                    for kind in kinds(eff):
                        offered[kind] = offered.get(kind, 0) + 1
                        took[kind] = took.get(kind, 0) + (k in picked)
        base = sum(took.values()) / max(1, sum(offered.values()))
        rates[mode] = {kind: (took.get(kind, 0) + 3 * base) / (offered[kind] + 3) for kind in offered}
        rates[mode]["_base"] = base
    return rates


SLOT_LEVELS = (8, 12, 16, 20)


def estimate(a, mode, cat, rates):
    """A plan for a skill/mode the source has no pick for: the specialties top
    players take most in this mode, leaning hard on what they pick for the same
    skill in the other mode. Marked est so the panel can say so."""
    other = a.get("pvp" if mode == "pve" else "pve")
    rate = a.get(mode + "20")
    to = None
    if other and other.get("to") and (rate or 0) >= 30:
        to = other["to"]
    elif rate is not None:
        to = 20 if rate >= 60 else 16 if rate >= 30 else 12 if rate >= 8 else None
    # Rarely used: still say which ones to take if you slot it, up to 12.
    cap = to or 12
    r = rates[mode]
    # Where the other mode puts each of its picks in (first one of an "or").
    prior = {}
    for lv, picks in (other or {}).get("slots", []):
        for _, k, _ in picks:
            prior.setdefault(k, lv)
    scored = []
    for k, (eff, opens) in cat.items():
        if opens > cap:
            continue
        # Same skill's other-mode pick counts, but a strong mode preference
        # (PvP: life drain, crowd control, crits) can still outrank it.
        s = max(r.get(kind, r["_base"]) for kind in kinds(eff)) + (0.25 if k in prior else 0)
        scored.append((s, k, eff, opens))
    scored.sort(key=lambda x: (-x[0], x[1]))
    pick = scored[: 3 if cap >= 20 else 2]
    # Put-in level: the other mode's for a shared pick, else the first free
    # slot level it is open at (best first).
    used, placed = set(), {}
    for _, k, _, _ in pick:  # best first: an "or" pair keeps only the better one's level
        if k in prior and prior[k] <= cap and prior[k] not in used:
            used.add(prior[k])
            placed[k] = prior[k]
    for s, k, eff, opens in sorted(pick, key=lambda x: (x[3], -x[0])):
        if k in placed:
            continue
        lv = next((L for L in SLOT_LEVELS if opens <= L <= cap and L not in used), None)
        if lv is not None:
            used.add(lv)
            placed[k] = lv
    slots = sorted([placed[k], [[eff, k, opens]]] for s, k, eff, opens in pick if k in placed)
    if not slots:
        return None
    src = "the other mode's picks for this skill and " if prior else ""
    return {
        "tag": f"Raise to {to}" if to else "Rarely used",
        "to": to,
        "slots": slots,
        "note": "",
        "est": f"Estimate: aion2-meta lists no {MODE[mode]} pick here, so these lean on {src}what top players take in {MODE[mode]} for other skills.",
    }


MODE = {"pve": "PvE", "pvp": "PvP"}


# ---- Min-max: a pick on the merits, ignoring what anyone else runs. ----------
# Each specialty is valued from its own text and the skill it sits on: how long
# the cooldown is, whether the skill deals damage, heals or controls, and
# whether it already hits several targets. PvE assumes a raid or dungeon boss
# (CC-immune, single target, long fight, party around you); PvP assumes Abyss
# and Arena (block/evasion, CC chains, kiting, healers on the other side).


def skill_ctx(a):
    tip = (a.get("tip") or "").lower()
    m = re.search(r"cooldown: (\d+(?:\.\d+)?)s", (a.get("meta") or "").lower())
    cd = float(m.group(1)) if m else 0.0
    deals = "deals" in tip or "damage" in tip.split(".")[0]
    heal = bool(re.search(r"^restores .*hp|restores [\d,]+.*hp .*party|heal", tip)) and not tip.startswith("deals")
    return {
        "cd": cd,
        "dmg": deals and not heal,
        "heal": heal,
        "aoe": bool(re.search(r"up to \d+ enemies", tip)),
        "spirit": "spirit" in a["n"].lower(),
        "tenacity": "tenacity" in tip,
        "conditional": bool(re.search(r"afflicted with (stagger|knockdown|stun)", tip)),
    }


def num_in(e, rx, default=0.0):
    m = re.search(rx, e)
    return float(m.group(1).replace(",", "")) if m else default


def value(eff, ctx):
    """(PvE, PvP, why) for one specialty, 0–10."""
    e = eff.lower()
    cd, dmg, heal = ctx["cd"], ctx["dmg"], ctx["heal"]
    core = dmg or heal  # the skill's job is numbers, not utility

    # Cooldown: more casts of the skill. Worth the share of the cooldown it cuts.
    if re.search(r"^remove(s)? (\[[^\]]+\] )?cooldown$|^removes \[[^\]]+\] cooldown$", e):
        v = 9.5 if core and cd else 5
        return v, v, "no cooldown at all: cast it every time it is up in the rotation"
    if re.search(r"^-[\d.]+s (\[[^\]]+\] )?cooldown$|^-[\d.]+% \[[^\]]+\] cooldown$", e) and "on hit" not in e:
        cut = num_in(e, r"-([\d.]+)s")
        frac = cut / cd if cd and cut else num_in(e, r"-([\d.]+)%") / 100
        v = min(9.5, 3 + 14 * frac) if core else min(8, 3 + 10 * frac)
        return v, v, f"about {round(100 * frac / max(0.01, 1 - frac))}% more casts" if frac < 1 else "more casts"
    if "all skill cooldowns" in e or "all cooldowns" in e:
        v = 8.5 if not cd or cd <= 6 else 7
        return v, v, "speeds up your whole kit, best on a skill you press often"
    if re.search(r"cooldown on (hit|landing|block|evasion)|reset .*cooldown|resets .*cooldown", e):
        if "defeating" in e:
            return 4, 2, "only resets on kills: trash packs, not bosses"
        if "block" in e or "evasion" in e:
            return 3, 4.5, "needs you to block or evade first"
        chance = num_in(e, r"(\d+)% chance", 100)
        crit = "critical" in e
        v = 5 + (2.5 if crit else 0) + 2 * min(1, chance / 50)
        return min(8.5, v), min(8.5, v), "extra casts of a damage skill"
    if "chance to reset" in e:
        return 7, 7, "extra casts"

    # Landing hits and crits.
    if "ignores block and evasion" in e:
        bonus = "critical" in e or "multi-hit" in e or "damage over time" in e
        return (7.5 if bonus else 5.5), (9.5 if bonus else 8.5), "can't be blocked or evaded (players do both a lot)" + (", plus a guaranteed crit/multi-hit" if bonus else "")
    if re.search(r"^critical hit on hit|lands as a critical hit", e):
        return 8, 8.5, "every hit crits: the biggest flat damage gain"
    if re.search(r"skill critical hit|critical hit when less|critical damage boost", e):
        p = num_in(e, r"\+([\d.]+)%", 10)
        return 4.5 + p / 10, 5 + p / 10, "more crit on this skill"
    if "multi-hit" in e:
        p = num_in(e, r"\+([\d.]+)%", 100)
        v = 4 + 3.5 * min(1, p / 100) if dmg else 3
        return v, v - 0.5, "more multi-hits = more damage"

    # Damage.
    if "less targets" in e:
        return 7.5, 7, "full bonus on a single target: bosses and duels"
    if "more targets" in e or re.search(r"changes to aoe|aoe damage|aoe skill|aoe stun", e):
        aoe_pvp = 7 if "stun" in e or "pull" in e else 5.5
        return (3.5 if ctx["aoe"] else 4.5), aoe_pvp, "only pays off on several targets: trash and group fights"
    if re.search(r"chain skill", e):
        trig = "trigger chance" in e
        return (6 if trig else 7.5), (5 if trig else 6.5), "an extra follow-up hit after the skill"
    if re.search(r"extra damage|delayed damage|additional strikes|damage over time|additional attack|grants extra damage|damage boost for|attack on landing|element boost|fire damage boost", e):
        return 6.5, 6, "more damage"
    if re.search(r"charge skill", e):
        return (6.5 if "more damage" in e else 5), 4.5, "higher top damage, but you have to stand and charge"
    if re.search(r"activates .* extra time|consecutive use|regain four elements|keep \d+ stacks|engraves", e):
        return 7.5, 7, "an extra use of the skill or its resource"
    if re.search(r"skill speed|combat speed|attacking speed", e):
        p = num_in(e, r"\+([\d.]+)%", 20)
        return 4 + p / 10, 4.5 + p / 10, "faster cast: more of your rotation fits in a window"
    if re.search(r"status effect resist|impact-type resist", e):
        return 1.5, 5.5, "makes your crowd control land more: players only"
    if re.search(r"damage tolerance reduction|damage boost reduction|target defense|tolerance and .*reduction|-[\d.]+% target", e):
        return 6.5, 6.5, "debuffs the target for the whole party"
    if re.search(r"remove \d+ buff", e):
        return 3, 6.5, "strips a buff: bosses barely have any, players do"
    if re.search(r"breaks protective shield", e):
        return 2.5, 8, "cuts through shields: big against defensive players"
    if re.search(r"incoming heal for|incoming heal during debilitate", e):
        return 1.5, 8, "anti-heal: wins fights against healers"

    # Healing and survival.
    if heal and "when hp is" in e:
        return 5, 6, "bigger heals, but only on someone already low"
    if heal and re.search(r"hp restored|heal boost|amount healed|healing duration|heal over time can stack", e):
        return 7.5, 7.5, "bigger heals from a heal you cast anyway"
    if re.search(r"removes up to|remove \d+ debuff|chance to remove", e):
        return 5.5, 8, "cleanses more: CC and DoTs are what kill you in PvP"
    if re.search(r"absorbs|restores [\d.]+% hp", e):
        p = num_in(e, r"([\d.]+)% hp", 1)
        return 2.5 + min(1.5, p / 4), 6 + min(1.5, p / 3), "self-sustain while you deal damage"
    if re.search(r"tenacity duration", e):
        return 4, 7, "longer CC immunity"
    if re.search(r"block (while|during)", e):
        return 3, 4.5, "blocks more while you cast it"
    if re.search(r"tolerance|defense while|protective shield|incoming heal (during|for)", e):
        return 5, 6, "takes less damage"
    if re.search(r"stamina", e):
        return 2, 5.5, "more dodges"
    if "accuracy" in e:
        return 2.5, 4, "fewer misses against evasive targets"

    # Control: bosses ignore it; players don't.
    if re.search(r"pull", e):
        return 4.5, 6.5, "groups trash together; pulls a player out of position"
    if re.search(r"stun|seal|knockdown|airborne|fear|frost|root|bind|blind", e):
        strong = re.search(r"stun|seal|knockdown|fear|frost", e)
        chance = num_in(e, r"(\d+)% chance", 100)
        v = (7.5 if strong else 6) - (1.5 if chance < 50 else 0)
        return 1.5, v, "crowd control: useless on bosses, wins PvP fights"
    if re.search(r"knock back|slow|move speed reduction|enemy combat speed|attack speed by", e):
        return 1.5, 5, "slows or pushes players"
    if "mobile skill" in e or "move speed" in e or "moves to" in e:
        return 4.5, 7, "cast while moving: dodge mechanics, kite players"
    if "range" in e:
        return 3, 6, "longer reach"
    if "duration" in e:
        return 5, 5, "lasts longer"
    if ctx["spirit"] and re.search(r"stats|attack|critical|activate skill", e):
        return 5.5, 5.5, "a stronger spirit"
    if re.search(r"\bmp\b", e):
        return 2, 2, "MP only matters if you run dry"
    if "cooldown" in e:
        return 6.5, 6.5, "more casts of another rotation skill"
    return 4, 4, "small, situational gain"


def minmax(a, mode, cat, plan):
    """Best specialties for `mode` on the merits, in the slots the plan's
    level allows (2 below 20, 3 at 20, aion2-meta's convention)."""
    ctx = skill_ctx(a)
    cap = (plan or {}).get("to") or 12
    i = 0 if mode == "pve" else 1
    scored = []
    for k, (eff, opens) in cat.items():
        if opens > cap:
            continue
        v = value(eff, ctx)
        scored.append((v[i], k, eff, opens, v[2]))
    scored.sort(key=lambda x: (-x[0], x[3], x[1]))
    pick = scored[: 3 if cap >= 20 else 2]
    used, slots = set(), []
    # The third slot opens at skill level 20.
    order = sorted(pick, key=lambda x: (x[3], -x[0]))
    for n, (s, k, eff, opens, why) in enumerate(order):
        levels = (20,) if n == 2 else SLOT_LEVELS
        lv = next((L for L in levels if opens <= L <= cap and L not in used), None)
        if lv is None:
            continue
        used.add(lv)
        slots.append([lv, [[eff, k, opens]], why])
    return {"slots": sorted(slots, key=lambda x: x[0])}


def add_minmax(data, cats):
    same = total = 0
    for c in CLASSES:
        for a in data[c]["actives"]:
            cat = cats[c].get(a["n"])
            if not cat:
                continue
            for mode in ("pve", "pvp"):
                p = a.get(mode)
                if not p:
                    continue
                mm = minmax(a, mode, cat, p)
                p["mm"] = mm
                meta = {k for _, picks in p["slots"] for _, k, _ in picks}
                mine = {s[1][0][1] for s in mm["slots"]}
                total += 1
                same += mine <= meta
    return same, total


def fill(data, cats):
    rates = learn(data, cats)
    filled = 0
    for c in CLASSES:
        for a in data[c]["actives"]:
            cat = cats[c].get(a["n"])
            if not cat:
                continue
            for mode in ("pve", "pvp"):
                p = a.get(mode)
                if p and p["slots"]:
                    continue
                e = estimate(a, mode, cat, rates)
                if e:
                    # Keep the source's own note (e.g. why to leave it low).
                    if p and p.get("note"):
                        e["note"] = p["note"]
                    a[mode] = e
                    filled += 1
    return filled


STIGMA_COST = [(5, 1), (10, 2), (15, 4), (20, 8)]  # stigma points per level, Lv. 1 up


def stigma_cost(lv):
    """Stigma points to train a stigma from nothing to `lv` (MetaBot, client
    table: Lv. 1–5 cost 1 each, 6–10 2, 11–15 4, 16–20 8; Lv. 20 = 75)."""
    total, prev = 0, 0
    for top, each in STIGMA_COST:
        total += max(0, min(lv, top) - prev) * each
        prev = top
    return total


def mb_levels(page):
    """MetaBot's class build page: its 3 ready-made builds (Endgame PvE from
    top players, Leveling 1–45 and PvP editorial) with the trained level of
    every skill and stigma, and every stigma's share + average level among
    tracked top players."""
    out = {"cards": {}, "stigmas": [], "sample": ""}
    for art in re.findall(r'<article class="[^"]*_card [^"]*".*?</article>', page, re.S):
        title = clean(re.sub(r"<[^>]+>", "", (re.search(r"<h3[^>]*>(.*?)</h3>", art, re.S) or [None, ""])[1]))
        key = "pve" if "PvE" in title else "pvp" if "PvP" in title else "lvl" if "Level" in title else None
        if not key:
            continue
        skills = {}
        for li in re.findall(r"<li>(.*?)</li>", art.split("_slots")[0], re.S):
            n = re.search(r'_nameText">(.*?)</span>', li)
            lv = re.search(r'_lv">Lv\. (\d+)', li)
            if n and lv:
                b = re.search(r'_bonus"[^>]*>\+(?:<!-- -->)?(\d+)', li)
                skills[clean(n.group(1))] = [int(lv.group(1)), int(b.group(1)) if b else 0]
        slots = []
        for m in re.finditer(r"<small>Slot (\d+) · Lv\. (\d+)</small>.*?_nameText\">(.*?)</span>.*?_slotMeta\"><span>Lv\. (\d+)", art, re.S):
            slots.append([int(m.group(2)), clean(m.group(3)), int(m.group(4))])
        out["cards"][key] = {"skills": skills, "stigmas": slots}
    i = page.find('data-section="meta-stigmas"')
    if i > 0:
        j = page.find("</dl>", i)
        n = re.search(r"Share of ([\d,]+) top", page[i:j])
        out["sample"] = f"{n.group(1)} top players" if n else ""
        for row in re.findall(r'_barRow">(.*?)</dd>', page[i:j], re.S):
            name = re.search(r'_nameText">(.*?)</span>', row)
            text = clean(re.sub(r"<[^>]+>", " ", row.split("<dd>")[-1]))
            pct, avg = re.search(r"([\d.]+)%", text), re.search(r"avg\. Lv\. ([\d.]+)", text)
            if name:
                out["stigmas"].append([clean(name.group(1)), float(pct.group(1)) if pct else None, float(avg.group(1)) if avg else None])
    return out


def add_levels(data, mb):
    """Per class: `stigmas` (MetaBot's stigma levels) and per skill `pts`, the
    level to train it to with skill points in each MetaBot build."""
    for c in CLASSES:
        lv = mb_levels(open(f"{mb}/{c}.html", encoding="utf-8").read())
        data[c]["stigmas"] = {"sample": lv["sample"], "rates": lv["stigmas"],
                              "cards": {k: v["stigmas"] for k, v in lv["cards"].items()}}
        for a in data[c]["actives"] + data[c]["passives"]:
            pts = {k: v["skills"][a["n"]] for k, v in lv["cards"].items() if a["n"] in v["skills"]}
            if pts:
                a["pts"] = pts
        print(f"{c}: stigma levels for {len(lv['stigmas'])} stigmas, cards {', '.join(f'{k} {len(v['stigmas'])}' for k, v in lv['cards'].items())}", file=sys.stderr)


def main():
    src, out = sys.argv[1], sys.argv[2]
    mb = sys.argv[3] if len(sys.argv) > 3 else None
    data = {}
    for c in CLASSES:
        page = open(f"{src}/{c}.html", encoding="utf-8").read()
        data[c] = parse(page)
        a = data[c]["actives"]
        print(f"{c}: {len(a)} actives ({sum(1 for x in a if x['pve'] or x['pvp'])} with specialties), {len(data[c]['passives'])} passives", file=sys.stderr)
    if mb:
        cats = {c: catalog(open(f"{mb}/{c}.html", encoding="utf-8").read()) for c in CLASSES}
        print(f"estimated {fill(data, cats)} missing skill plans from MetaBot's specialty lists", file=sys.stderr)
        same, total = add_minmax(data, cats)
        print(f"min-max picks: {same}/{total} skill plans agree with the meta/estimate", file=sys.stderr)
        add_levels(data, mb)
    body = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    with open(out, "w", encoding="utf-8") as f:
        f.write("// Citizen Score: every skill of every class, generated by plus/scrape_skills.py\n")
        f.write(f"// from aion2-meta.com/guides/<class>/ on {date.today().isoformat()}. Don't edit by hand: re-run it.\n")
        f.write("// actives: [{ n, tip, meta, pri, pve20, pvp20 (% of top KR players at level 20+), avg (global average level),\n")
        f.write("//   pve/pvp: { tag, to (level to raise it to), slots: [[skill level, [[specialty, k of 5, opens at]]]], note,\n")
        f.write("//     est (set when aion2-meta has no pick: estimated from MetaBot's specialty list; says why),\n")
        f.write("//     mm: { slots: [[skill level, [[specialty, k, opens at]], why]] } (min-max: picked on the merits, see value()) } }]\n")
        f.write("//   pts: { pve|lvl|pvp: [level trained with skill points, + levels from Daevanion/gear] } (MetaBot's Endgame PvE / Leveling 1-45 / PvP builds)\n")
        f.write("// passives: [{ n, tip, meta, verdict, pve, pvp (% of top KR gear raising it), avg (global average level), pts }]\n")
        f.write("// stigmas: { sample, rates: [[stigma, % of top players, their average level]], cards: { pve|lvl|pvp: [[slot opens at char level, stigma, level]] } } (MetaBot)\n")
        f.write(f"const SKILL_PLAN = {body};\n")


if __name__ == "__main__":
    main()
