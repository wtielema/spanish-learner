# Meridian — Game Design Document

## Concept

A multiplayer survival strategy game for 3-20 players. You are an astronaut who survived the crash of the colony ship *Meridian* on an uncharted alien planet. You landed alone in an escape pod with almost nothing. The ship's launch module is repairable — but there aren't enough seats for everyone.

The game runs in 2-week seasons with 12-hour ticks. Between ticks you queue orders. At tick time, everything resolves simultaneously. An LLM narrates what happens on each hex, making every game unique.

**Tone:** Weird planet meets pulp adventure. Strange, beautiful, dangerous — but fun to explore, not just terrifying.

**Target:** 3-20 friends, playable in 2-5 minute check-ins twice a day. No grinding. Decisions matter more than time spent.

---

## Core Loop

1. **Read your tick report** — what happened since last tick (narrated by LLM)
2. **Review the map** — fog of war, other players' movements, new discoveries
3. **Queue 2-3 actions** for next tick — move, gather, explore, build, craft, sleep, fight
4. **Coordinate on WhatsApp** — alliances, deals, lies, taunting (no in-game chat)
5. **Wait for next tick** — everything resolves simultaneously

### Action Points

- 2-3 energy per tick (based on rest/shelter/food status)
- Accumulate up to 3 ticks' worth (~9 max) so missing a day doesn't waste progress
- Well-fed and sheltered = full recovery. Starving in a storm = partial recovery.

### Tick Cadence

- Every 12 hours (e.g., 8am and 8pm, configurable per game)
- ~28 ticks per 2-week season
- Planet hostility escalates each tick — storms worsen, fauna gets aggressive, terrain shifts

---

## The Planet

### Map

Hex grid, procedurally generated per season. ~8-10 hexes per player. Fog of war — you only see hexes adjacent to your position.

### Biome Types (7 base types)

| Biome | Character | Typical Yields | Risk Level |
|-------|-----------|---------------|------------|
| **Flats** | Barren rocky plains, low scrub. Safe, boring. | Low rations, some salvage | Low |
| **Biolume Forest** | Glowing alien trees, dense canopy. Things live in there. | Rations, biostock, discoveries | Medium |
| **Fungal Marsh** | Spore-heavy wetlands. Visibility near zero. Weird things grow. | Rare biostock, high rations | High |
| **Crystal Ridge** | Jagged mineral formations. Beautiful and resource-rich. | Minerals, energy cells | Medium |
| **Ruin** | Something built this. Long ago. Still hums faintly. | Alien tech, ship parts, artifacts | Unpredictable |
| **Vent Fields** | Geothermal activity. Warm, energy-rich, unstable. | Energy cells, warmth in storms | Medium-High |
| **The Scar** | Impact crater from the *Meridian*'s breakup. Wreckage everywhere. | Ship parts, salvage | Varies |

Plus **Chasm** as impassable terrain to shape the map into natural corridors and chokepoints.

### The Planet is Alive

- Biomes mutate between ticks — a forest might sprout fungal growths, vent fields might erupt or go dormant
- New terrain features appear — sinkholes, growths, formations
- The planet reacts to player activity (LLM-driven)
- Shifts are gradual and telegraphed, not totally random

### Alien Ruins

Scattered across the map. Contain artifacts and sometimes ship parts. Something lived here before. The ruins still hum. Exploring them is high-risk, high-reward, and the LLM makes every ruin visit unique.

### Escalation Clock

The planet becomes increasingly hostile each tick. Storms intensify, fauna gets more aggressive, terrain shifts faster. Something is waking up. By the final ticks, the surface is becoming unsurvivable. You cannot wait forever.

---

## Resources

| Resource | Source | Used For |
|----------|--------|----------|
| **Rations** | Gathering, hunting alien fauna | Feeding yourself. No food = health loss. |
| **Salvage** | Scar hexes, ruins, scavenging | Building structures, crafting equipment, ship parts |
| **Biostock** | Biolume forests, fungal marsh, alien creatures | Medicine, organic tools, crafting, fuel synthesis |
| **Energy Cells** | Crystal ridges, vent fields, alien tech | Powering equipment, scanners, devices |

**Ship Parts** — special resource found in Scar hexes and Ruins. Heavy (take multiple inventory slots). Required to repair the launch module. The win condition currency.

**No currency.** Trade between players is barter, coordinated on WhatsApp. No in-game trade system.

---

## Your Character

Each player is one astronaut. No crews, no units — just you.

### Creation

- Pick a name
- Choose a basic avatar (visual customization at season start)

### Stats

- **Health** — damage from environment, creatures, combat. Heals slowly when sheltered and fed. Zero = dead.
- **Energy** — your action points. 2-3 per tick. Recovers between ticks based on rest/shelter/food.
- **Inventory** — ~6 slots. Limited carrying capacity. Stash the rest at your camp or hide it.

### No Classes

Every player starts equal. Differentiation is emergent — based on what you find, craft, and discover. Two weeks in, no two players look the same.

### Death & Respawn

- Death is rare in early/mid game — combat is risky for everyone, the planet kills slowly
- Late game, death becomes a real threat when players fight over ship parts and launch access
- **On death:** Respawn in a new escape pod, randomly placed far from other players. Lose all inventory and stashed items. Your old camp remains as lootable ruins. You keep tech knowledge (discoveries) but lose everything physical.
- Effectively resets you to day 1 while everyone else is ahead — devastating but you're still in the game.

---

## Structures (Your Camp)

Build at whatever hex you're on — that becomes your camp. One camp at a time. Moving means abandoning the old one (persists as lootable ruins for a few ticks).

| Structure | Cost | Effect |
|-----------|------|--------|
| **Lean-to** | Salvage | Basic shelter. Weather protection, proper rest (full energy recovery). |
| **Bed** | Salvage + Biostock | Enables **Sleep** action: costs 1 action this tick, grants **Rested** buff next tick (+1 energy, better LLM event outcomes). |
| **Stash** | Salvage | Secure storage. 6-8 extra inventory slots at your camp. |
| **Workbench** | Salvage + Biostock | Required to craft tools and equipment. |
| **Signal Fire** | Salvage + Energy Cell | Visible to all players within 3 hexes. Call allies or set bait. |
| **Scanner Array** | Salvage + Energy Cell | +1 vision range. Detects movement within 2 hexes. |
| **Barricade** | Salvage | Defensive. Attackers take damage/energy breaking through. |

**Rules:**
- Max ~6 structure slots per camp
- Building takes actions (1 action for basic, 2-3 for advanced)
- Structures can be damaged by combat and weather events
- Relocating abandons structures — choose your camp location carefully

---

## Equipment & Crafting

### Equipment Slots

| Slot | Function |
|------|----------|
| **Tool** | Gathering, building, crafting efficiency |
| **Weapon** | Combat and hunting effectiveness |
| **Suit** | Defense, weather resistance, special properties |
| **Device** | Wildcard — alien tech, scanners, gadgets |

### Crafting

At your workbench, spend an action + materials to make gear. Recipes are discovered through exploration — find new materials, figure out what they can become.

### Example Equipment

| Item | Materials | Slot | Effect |
|------|-----------|------|--------|
| **Makeshift Knife** | Salvage | Tool | Basic gathering bonus |
| **Crystal Blade** | Minerals + Salvage | Weapon | Solid combat weapon |
| **Spore Suit** | Biostock x2 | Suit | Fungal marsh immunity, camouflage |
| **Patched Scanner** | Salvage + Energy Cell | Device | Reveals hex contents before entering |
| **Chitin Shield** | Biostock + Minerals | Suit | Damage reduction |
| **Alien Resonator** | Ruin artifact + Energy Cell | Device | Unpredictable alien tech — effects determined by LLM |

### Alien Artifacts

Found in ruins. Powerful but unpredictable. The LLM determines their behavior — one might detect nearby players, another might attract creatures, another might do nothing for 5 ticks and then save your life. You don't get a manual. You experiment. The LLM tracks what you've learned about each artifact across ticks.

---

## The LLM Event System

The core innovation. The game loop is deterministic strategy — but what happens on each hex is narrated by an LLM (e.g., Gemini Flash) with structured outcomes.

### How It Works

At tick resolution, for each player's hex, the LLM receives:
- Hex biome type and known features
- Player's stats, equipment, inventory
- What they ordered (gather, explore, hunt, etc.)
- Current planet hostility level
- Other players/parties on the same hex
- History of what's happened on this hex before

### LLM Returns Two Things

1. **Narrative** — 2-3 sentence story of what happened. Personal, vivid, sometimes funny, sometimes terrifying.
2. **Structured outcomes** — JSON the game engine consumes: resource changes, health changes, discoveries, new threats, etc.

### Balance Guardrails

- Outcomes bounded by ranges per biome type (e.g., forest yields 2-8 rations, never 50)
- LLM picks within ranges and adds narrative flavor
- Difficulty parameter scales with planet hostility — early ticks are kinder, late ticks are brutal
- Critical events (player injury, major discovery) have probability caps per tick
- The LLM cannot invent new resource types, break the economy, or override game rules

### Why This Works

- Every game is unique, even on the same map
- Tick reports become stories you screenshot and share on WhatsApp
- The planet genuinely feels alive and unpredictable
- Emergent narrative — the LLM remembers hex history, so encounters have continuity
- Since you're one person, every event is YOUR personal story

---

## Combat

Rare, fast, and scary. You're one person — every fight is a gamble.

### Resolution

If two players are on the same hex and one (or both) chose an aggressive action, combat resolves at tick. The LLM narrates, but outcomes follow strict mechanical rules.

- Compare weapon + equipment + terrain modifiers
- Add a bounded random roll
- LLM picks within the outcome range and writes the story

### Outcome Spectrum

| Result | What Happens |
|--------|-------------|
| **Decisive win** | Loot their inventory, they flee injured |
| **Close win** | You win but take damage, grab one item |
| **Stalemate** | Both take damage, both retreat |
| **Loss** | Heavy damage, drop an item, flee |
| **Death** | Only if loser was already low health. Rare early, real late. |

### Design Principles

- Fighting is never safe — even winning costs health and energy
- No consequence-free hunting of weaker players
- Random element means a well-equipped player can still lose to a desperate underdog
- Death only when already weakened — almost always avoidable unless you push your luck
- Early game: combat is suicidal, the planet is the real threat
- Late game: gloves come off when ship seats are at stake

### Stealth

With the right equipment (spore suit, alien camo), you can choose to **hide** when someone enters your hex. The LLM rolls for detection based on gear and circumstances.

---

## Factions

### Formation

- Any player can create a faction (just a name, no cost)
- Invite other players — they accept or decline
- **Completely secret** — non-members cannot see that a faction exists, its size, or its members

### Mechanical Benefits

- **Shared vision** — faction members see what each other sees on the map
- **Shared stash access** — faction members can access each other's stash at their camps
- **Shared launch seats** — faction members can reserve seats for each other at the launch site

### Betrayal

- You can leave a faction at any time
- Leaving removes shared vision immediately — former allies see that you left
- Raiding a faction-mate's stash before leaving is mechanically possible
- There is no punishment beyond losing faction benefits and your allies knowing what you did

### The Paranoia

Nobody outside a faction knows it exists. The solo player chatting with you on WhatsApp might be part of a 4-person faction that's already collected half the ship parts. Two players on the same hex might be faction-mates or strangers — you can't tell.

---

## The Endgame — Getting Off This Planet

### Ship Parts

Scattered across the map in Scar hexes and deep Ruins. Fixed number per game — roughly 2x what's needed to repair the launch module. Heavy items (multiple inventory slots).

### The Launch Site

The *Meridian*'s main hull is at a fixed, known location (revealed to all players from tick 1). To win:
1. Deliver enough ship parts to the hull
2. Spend actions installing them (multiple ticks at the site)
3. Trigger the launch

### Limited Seats

The repaired module has berths for ~30-40% of players:
- 6-player game = 2 seats
- 10-player game = 3-4 seats
- 15-player game = 5-6 seats
- Seat count is public knowledge from tick 1

### Launch Countdown

Any player at the hull can trigger launch once repairs are complete. A **3-tick countdown** begins, visible to ALL players: "THE LAUNCH MODULE IS ACTIVATING. 3 TICKS REMAIN."

This is the final scramble:
- Rush to the hull to secure a seat
- Attack the hull to stop the launch
- Defend the hull to protect your escape
- Betray your allies and take their seat

### Winning & Losing

- **On the ship when it launches = you win**
- **More players at the hull than seats = vote.** Players at the hull vote on who gets left behind (public vote, one per tick during countdown). The ultimate betrayal moment.
- **Not at the hull = you lose**
- Multiple winners per game is expected and encouraged
- Faction members can reserve seats for each other

### Loser Epilogues

When the ship launches, the LLM writes each stranded player a personalized ending based on their game history — where they are, what they have, what they accomplished. Shareable, memorable, no two the same.

---

## Game Phases

| Phase | Ticks | Focus |
|-------|-------|-------|
| **Early** (~ticks 1-8) | Days 1-4 | Survive alone. Explore your neighborhood. Find resources, build a camp, craft basic gear. The planet is the threat. |
| **Mid** (~ticks 9-18) | Days 5-9 | Map opens up. Factions form secretly. Alliances negotiated on WhatsApp. Territory and resources contested. Ship parts start being found. |
| **Late** (~ticks 19-24) | Days 10-12 | Ship parts hauled to the hull. Factions revealed through action. Combat becomes real. Planet hostility spikes. |
| **Endgame** (~ticks 25-28) | Days 13-14 | Launch countdown. Final scramble. Betrayals. Votes. The planet is trying to kill everyone. Get on the ship or get a good epilogue. |

---

## Technical Approach

### Stack

- **Frontend:** Vanilla JS, HTML Canvas for hex map, responsive for mobile
- **Backend:** Node.js (Express or similar)
- **Real-time:** Colyseus or Socket.io for presence/updates
- **Database:** PostgreSQL or SQLite for game state persistence
- **LLM:** Gemini Flash API for hex event narration + structured outcomes
- **Hosting:** VPS (e.g., Railway, Fly.io, or cheap DigitalOcean droplet)

### Architecture

- Server is authoritative — all game state lives server-side
- Client sends orders, server validates and queues them
- Tick resolution runs server-side on a cron/scheduler
- LLM calls happen during tick resolution (batched for efficiency)
- Client polls or receives push updates for tick reports

### Code Structure (planned)

```
client/
  index.html
  css/style.css
  js/
    main.js          — boot, auth, game selection
    map.js           — hex grid rendering (canvas)
    ui.js            — overlay panels, order queue, reports
    api.js           — server communication
    state.js         — local game state cache

server/
  index.js           — Express app, routes, WebSocket
  game.js            — game lifecycle (create, join, tick)
  tick.js            — tick resolution engine
  map.js             — hex grid generation, fog of war
  combat.js          — combat resolution
  factions.js        — faction management
  llm.js             — LLM integration (event narration)
  db.js              — database access

shared/
  constants.js       — biomes, items, structures, balance numbers
  types.js           — shared type definitions
```

### Authentication

Simple — game codes/links for friend groups. No account system needed for v1. A game creator gets a shareable link, friends join with a display name.

---

## Future Expansion Ideas (Not in v1)

### Extended Hex Types
- Spirit Stones — ancient standing stones, research bonus, extended vision
- Whispering Cave — cryptic hints about other players' actions
- Cursed Bog — dangerous but contains rare herbs
- Ancestor Barrow — morale/combat bonus for claiming it
- Bioluminescent Lake — no-combat zone, trade point with loyalty penalty
- Aurora Ridge — research bonus hilltop
- Petrified Forest — stone trees, defensive bonus
- Beast Den — clearable for prime territory, may respawn
- Ember Fissure — immune to escalation, volcanic risk
- Megafauna Grounds — high-risk hunting
- Obsidian Outcrop — rare weapon material
- Sacred Grove — culture bonus, social consequences for raiding
- Flood Plain — fertile after events, risky to settle

### Other Future Ideas
- Tamed alien creatures as companions
- Underground/cave exploration layer
- Alien tech skill tree (learn to use artifacts better)
- Spectator mode for eliminated players
- Cross-season progression (cosmetics, titles)
- Larger maps with multiple crash sites
- NPC alien factions that react to player activity
