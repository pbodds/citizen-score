//! Citizen Score: what is around the player, for the Pet Map's radar.
//!
//! ```text
//! <len> 41 36 <entity> <kind u8> ... <npc u24> 00 (00|40) 02 <x f32> <y f32> <z f32>   a spawn
//! <len> 42 36 <entity> <varint 0> <flag>          flag 1 out of view, 3 died, 7 gone
//! <len> 23 36 00 <5 bytes> <x f32> <y f32> <z f32> you, put down at a zone load
//! <len> 21 36 ...                                  a map load: nothing is around any more
//! <len> 2a 38 | 2b 38 ... <caster> ... <u8> <x f32> <y f32> <z f32>   a buff, at its caster
//! ```
//!
//! The spawn's position follows the same `00 (00|40) 02` marker that
//! `StreamProcessor::extract_and_register_mob_type` reads the NPC id from.
//! Your own position comes from the buffs you cast (each add and change ends
//! with the caster's position, `capture::abnormal`), which in a fight is
//! several times a second, and from where a zone load puts you. Positions are
//! the game's world units, z up. Read from slices of 2026-10-18.
//!
//! Monsters come into view about 55 m away and leave it (flag 1) about 65 m
//! away (measured 2026-10-26 against buff positions over 336 slices), so the
//! monsters kept here are the ones within some 65 m of you.

use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};

use super::stream_processor::read_varint;

/// Spawn kinds that are someone's summon or a skill's effect, never a monster.
const NOT_MONSTERS: [u8; 5] = [0x5F, 0x1F, 0x1D, 0x5D, 0x1C];
/// The most monsters kept: far more than are ever in view.
const MAX_MOBS: usize = 2000;

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Mob {
    pub npc: i32,
    pub pos: [f32; 3],
    pub seen_ms: i64,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Me {
    pub pos: [f32; 3],
    pub at_ms: i64,
    /// "buff" (one you cast) or "zone" (where a zone load put you).
    pub source: &'static str,
}

#[derive(Debug, Default)]
pub struct Radar {
    pub mobs: HashMap<i32, Mob>,
    pub me: Option<Me>,
    /// Bumped on every change, so a reader can skip an unchanged radar.
    pub seq: u64,
}

fn radar() -> &'static Mutex<Radar> {
    static RADAR: OnceLock<Mutex<Radar>> = OnceLock::new();
    RADAR.get_or_init(Mutex::default)
}

/// A copy of the radar now, if it changed since `seq`.
pub fn since(seq: u64) -> Option<(u64, HashMap<i32, Mob>, Option<Me>)> {
    let r = radar().lock().unwrap_or_else(|p| p.into_inner());
    (r.seq != seq).then(|| (r.seq, r.mobs.clone(), r.me))
}

/// Read one framed packet; `me` is your entity id when known.
pub fn feed(packet: &[u8], me: Option<i64>, now_ms: i64) {
    let mut r = radar().lock().unwrap_or_else(|p| p.into_inner());
    apply(&mut r, packet, me, now_ms);
}

fn f32_at(b: &[u8], at: usize) -> Option<f32> {
    let v = f32::from_le_bytes(b.get(at..at + 4)?.try_into().ok()?);
    v.is_finite().then_some(v)
}

fn pos_at(b: &[u8], at: usize) -> Option<[f32; 3]> {
    let p = [f32_at(b, at)?, f32_at(b, at + 4)?, f32_at(b, at + 8)?];
    // World units run to a few hundred thousand; anything past that is a
    // misread, as is the origin.
    (p.iter().all(|v| v.abs() < 1.0e6) && p != [0.0; 3]).then_some(p)
}

pub fn apply(r: &mut Radar, packet: &[u8], me: Option<i64>, now_ms: i64) {
    let len = read_varint(packet, 0);
    if len.length <= 0 {
        return;
    }
    let o = len.length as usize;
    let Some(op) = packet.get(o..o + 2) else { return };
    match op {
        [0x41, 0x36] => {
            if let Some((id, mob)) = spawn(packet, o + 2, now_ms) {
                if r.mobs.len() >= MAX_MOBS && !r.mobs.contains_key(&id) {
                    if let Some(oldest) = r.mobs.iter().min_by_key(|(_, m)| m.seen_ms).map(|(k, _)| *k) {
                        r.mobs.remove(&oldest);
                    }
                }
                r.mobs.insert(id, mob);
                r.seq += 1;
            }
        }
        [0x42, 0x36] => {
            let entity = read_varint(packet, o + 2);
            if entity.length <= 0 {
                return;
            }
            let mut at = o + 2 + entity.length as usize;
            let zero = read_varint(packet, at);
            if zero.length <= 0 {
                return;
            }
            at += zero.length as usize;
            let flag = read_varint(packet, at);
            if flag.length > 0 && matches!(flag.value, 1 | 3 | 7) && r.mobs.remove(&entity.value).is_some() {
                r.seq += 1;
            }
        }
        [0x23, 0x36] => {
            if packet.get(o + 2) == Some(&0) && let Some(pos) = pos_at(packet, o + 8) {
                r.me = Some(Me { pos, at_ms: now_ms, source: "zone" });
                r.seq += 1;
            }
        }
        [0x21, 0x36] => {
            r.mobs.clear();
            r.seq += 1;
        }
        [0x2A, 0x38] | [0x2B, 0x38] => {
            let Some(me) = me else { return };
            let caster = match super::abnormal::parse(packet) {
                Some(super::abnormal::Record::Added(a) | super::abnormal::Record::Changed(a)) => a.caster,
                _ => return,
            };
            // The record ends with the caster's position (abnormal::parse
            // checked that it ends where the layout says).
            if i64::from(caster) == me && let Some(pos) = pos_at(packet, packet.len() - 12) {
                r.me = Some(Me { pos, at_ms: now_ms, source: "buff" });
                r.seq += 1;
            }
        }
        _ => {}
    }
}

/// A monster's spawn record, after its opcode: its entity id and what it is.
fn spawn(packet: &[u8], at: usize, now_ms: i64) -> Option<(i32, Mob)> {
    let entity = read_varint(packet, at);
    if entity.length <= 0 {
        return None;
    }
    let start = at + entity.length as usize;
    if NOT_MONSTERS.contains(packet.get(start)?) {
        return None;
    }
    let end = packet.len().saturating_sub(2).min(start + 60);
    let marker = (start + 3..end).find(|&i| packet[i] == 0 && matches!(packet[i + 1], 0x00 | 0x40) && packet[i + 2] == 0x02)?;
    let npc = i32::from(packet[marker - 3]) | i32::from(packet[marker - 2]) << 8 | i32::from(packet[marker - 1]) << 16;
    let pos = pos_at(packet, marker + 3)?;
    Some((entity.value, Mob { npc, pos, seen_ms: now_ms }))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn hex(s: &str) -> Vec<u8> {
        (0..s.len()).step_by(2).map(|i| u8::from_str_radix(&s[i..i + 2], 16).unwrap()).collect()
    }

    #[test]
    fn a_monster_spawns_dies_and_the_map_clears() {
        let mut r = Radar::default();
        // Two spawns of 2026-10-18, cut after their position.
        apply(&mut r, &hex("cd01413696bb016f0000cf902c0000020431f94629917146007f0b47f5331843"), None, 1);
        apply(&mut r, &hex("c8014136bf9a015f1000c78e2c004002004b164700fe8d4600ae0c476f580c43"), None, 1);
        assert_eq!(r.mobs.len(), 1, "a 0x5F spawn is a summon");
        let mob = r.mobs[&23958];
        assert_eq!(mob.npc, 2_920_655);
        assert_eq!(mob.pos.map(f32::round), [31897.0, 15460.0, 35711.0]);
        apply(&mut r, &hex("0b4236968b010007"), None, 2);
        assert_eq!(r.mobs.len(), 1, "another entity");
        apply(&mut r, &hex("0b423696bb010003"), None, 2);
        assert!(r.mobs.is_empty(), "died");
        apply(&mut r, &hex("cd01413696bb016f0000cf902c0000020431f94629917146007f0b47f5331843"), None, 2);
        apply(&mut r, &hex("0b423696bb010001"), None, 2);
        assert!(r.mobs.is_empty(), "out of view");
        apply(&mut r, &hex("cd01413696bb016f0000cf902c0000020431f94629917146007f0b47f5331843"), None, 3);
        apply(&mut r, &hex("0a21360100000064000000"), None, 4);
        assert!(r.mobs.is_empty(), "a map load");
    }

    #[test]
    fn a_zone_load_puts_you_down() {
        let mut r = Radar::default();
        apply(&mut r, &hex("1e23360000000000003afa0e474e387e4600a80c4702000000fa32"), None, 5);
        let me = r.me.unwrap();
        assert_eq!(me.pos.map(f32::round), [36602.0, 16270.0, 36008.0]);
        assert_eq!(me.source, "zone");
    }
}
