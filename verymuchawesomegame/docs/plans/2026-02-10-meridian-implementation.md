# Meridian Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a playable multiplayer survival strategy game where 3-20 players compete to escape an alien planet via a damaged ship with limited seats.

**Architecture:** Next.js fullstack app with Supabase (PostgreSQL + Realtime + Auth). Phaser.js for hex map game rendering embedded in React. Gemini Flash for LLM-narrated hex events. Tick resolution via Supabase Edge Functions on a cron schedule. Asset generation via nanobanana → fal.ai → Blender pipeline (later phase).

**Tech Stack:** Next.js 15, React, Supabase (PostgreSQL, Realtime, Auth, Edge Functions), Phaser.js 3, Vitest, Gemini Flash API

---

## Phase 1: Project Scaffolding

### Task 1: Initialize Next.js project with Supabase

**Files:**
- Create: project root via `create-next-app`
- Create: `.env.local`

**Step 1: Create Next.js project**

Run: `cd /Users/woutertielemans/Documents/Claude\ VibeCoding/verymuchawesomegame && npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"`

Choose: TypeScript yes, Tailwind yes, App Router yes, src/ dir yes.

**Step 2: Install game dependencies**

Run: `npm install phaser @supabase/supabase-js @supabase/ssr uuid`
Run: `npm install -D vitest @testing-library/react supabase`

**Step 3: Initialize Supabase locally**

Run: `npx supabase init`
Run: `npx supabase start` (requires Docker)

This gives us a local Supabase instance with PostgreSQL, Auth, Realtime, and Edge Functions.

**Step 4: Create .env.local**

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<from supabase start output>
SUPABASE_SERVICE_ROLE_KEY=<from supabase start output>
GEMINI_API_KEY=<your key>
```

**Step 5: Create .gitignore additions**

Add to existing `.gitignore`:
```
.env.local
.env.production
node_modules/
.next/
```

**Step 6: Verify everything runs**

Run: `npm run dev`
Open: `http://localhost:3000` — should see Next.js default page.

**Step 7: Commit**

```bash
git add -A
git commit -m "chore: initialize Next.js + Supabase + Phaser project"
```

---

### Task 2: Supabase database schema

**Files:**
- Create: `supabase/migrations/001_initial_schema.sql`

**Step 1: Write the migration**

```sql
-- Games
create table games (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  status text not null default 'lobby' check (status in ('lobby', 'active', 'finished')),
  tick_number integer not null default 0,
  next_tick_at timestamptz,
  hostility real not null default 0,
  config jsonb not null default '{}',
  hull_q integer,
  hull_r integer,
  parts_installed integer not null default 0,
  parts_required integer not null default 0,
  launch_countdown integer,
  created_at timestamptz not null default now()
);

-- Players
create table players (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  user_id uuid references auth.users(id),
  name text not null,
  avatar text not null default 'default',
  health integer not null default 100,
  energy integer not null default 3,
  max_energy integer not null default 3,
  inventory jsonb not null default '[]',
  equipment jsonb not null default '{}',
  discoveries jsonb not null default '[]',
  position_q integer,
  position_r integer,
  camp_q integer,
  camp_r integer,
  structures jsonb not null default '[]',
  stash jsonb not null default '[]',
  buffs jsonb not null default '{}',
  is_alive boolean not null default true,
  is_winner boolean,
  created_at timestamptz not null default now(),
  unique(game_id, name)
);

-- Hexes
create table hexes (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  q integer not null,
  r integer not null,
  biome text not null,
  features jsonb not null default '{}',
  history jsonb not null default '[]',
  ship_part boolean not null default false,
  ruins_loot jsonb,
  unique(game_id, q, r)
);

-- Actions (queued per tick)
create table actions (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  tick_number integer not null,
  action_type text not null,
  params jsonb not null default '{}',
  energy_cost integer not null default 1,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

-- Factions
create table factions (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  name text not null,
  created_by uuid not null references players(id),
  created_at timestamptz not null default now()
);

create table faction_members (
  faction_id uuid not null references factions(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (faction_id, player_id)
);

create table faction_invites (
  id uuid primary key default gen_random_uuid(),
  faction_id uuid not null references factions(id) on delete cascade,
  invited_player_id uuid not null references players(id) on delete cascade,
  invited_by uuid not null references players(id),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now()
);

-- Tick Reports
create table tick_reports (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  tick_number integer not null,
  report_type text not null default 'tick' check (report_type in ('tick', 'epilogue')),
  narrative text,
  outcomes jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- Launch votes
create table launch_votes (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  voter_id uuid not null references players(id),
  target_id uuid not null references players(id),
  tick_number integer not null,
  created_at timestamptz not null default now(),
  unique(game_id, voter_id, tick_number)
);

-- Enable Realtime for key tables
alter publication supabase_realtime add table games;
alter publication supabase_realtime add table players;
alter publication supabase_realtime add table tick_reports;
alter publication supabase_realtime add table actions;

-- Row Level Security
alter table games enable row level security;
alter table players enable row level security;
alter table hexes enable row level security;
alter table actions enable row level security;
alter table factions enable row level security;
alter table faction_members enable row level security;
alter table faction_invites enable row level security;
alter table tick_reports enable row level security;
alter table launch_votes enable row level security;

-- Basic RLS policies (players can read their own game data)
create policy "Players can read their game" on games for select using (true);
create policy "Players can read players in their game" on players for select using (true);
create policy "Players can read their tick reports" on tick_reports for select
  using (player_id in (select id from players where user_id = auth.uid()));
create policy "Players can read their actions" on actions for select
  using (player_id in (select id from players where user_id = auth.uid()));
```

**Step 2: Apply migration**

Run: `npx supabase db reset`

**Step 3: Verify tables exist**

Run: `npx supabase db lint`

**Step 4: Commit**

```bash
git add supabase/
git commit -m "feat: Supabase database schema — games, players, hexes, actions, factions, reports"
```

---

### Task 3: Shared constants and game balance

**Files:**
- Create: `src/lib/constants.ts`
- Create: `src/lib/types.ts`
- Create: `tests/lib/constants.test.ts`

**Step 1: Write the test**

```ts
import { describe, it, expect } from 'vitest';
import { BIOMES, RESOURCES, STRUCTURES, EQUIPMENT_SLOTS, ITEMS, ACTIONS, GAME_DEFAULTS } from '@/lib/constants';

describe('constants', () => {
  it('defines all 7 biome types plus chasm', () => {
    const biomeIds = Object.keys(BIOMES);
    expect(biomeIds).toContain('flats');
    expect(biomeIds).toContain('biolume_forest');
    expect(biomeIds).toContain('fungal_marsh');
    expect(biomeIds).toContain('crystal_ridge');
    expect(biomeIds).toContain('ruin');
    expect(biomeIds).toContain('vent_fields');
    expect(biomeIds).toContain('scar');
    expect(biomeIds).toContain('chasm');
    expect(biomeIds).toHaveLength(8);
  });

  it('each biome has yield ranges and risk level', () => {
    for (const [id, biome] of Object.entries(BIOMES)) {
      if (id === 'chasm') continue;
      expect(biome.risk).toBeGreaterThanOrEqual(0);
      expect(biome.risk).toBeLessThanOrEqual(1);
      expect(biome.yields).toBeDefined();
    }
  });

  it('defines 4 resource types plus ship_parts', () => {
    expect(Object.keys(RESOURCES)).toEqual(
      expect.arrayContaining(['rations', 'salvage', 'biostock', 'energy_cells', 'ship_parts'])
    );
  });

  it('defines 7 structures each with cost and build time', () => {
    expect(Object.keys(STRUCTURES)).toHaveLength(7);
    for (const structure of Object.values(STRUCTURES)) {
      expect(structure.cost).toBeDefined();
      expect(structure.buildActions).toBeGreaterThanOrEqual(1);
    }
  });

  it('defines 4 equipment slots', () => {
    expect(EQUIPMENT_SLOTS).toEqual(['tool', 'weapon', 'suit', 'device']);
  });

  it('game defaults are sensible', () => {
    expect(GAME_DEFAULTS.tickIntervalHours).toBe(12);
    expect(GAME_DEFAULTS.maxEnergy).toBe(9);
    expect(GAME_DEFAULTS.baseEnergyPerTick).toBe(3);
    expect(GAME_DEFAULTS.inventorySlots).toBe(6);
    expect(GAME_DEFAULTS.maxStructures).toBe(6);
    expect(GAME_DEFAULTS.stashSlots).toBe(8);
    expect(GAME_DEFAULTS.maxHealth).toBe(100);
    expect(GAME_DEFAULTS.seatPercentage).toBeCloseTo(0.35);
    expect(GAME_DEFAULTS.launchCountdownTicks).toBe(3);
    expect(GAME_DEFAULTS.shipPartsMultiplier).toBe(2);
  });
});
```

**Step 2: Run test, verify fail**

Run: `npx vitest run tests/lib/constants.test.ts`

**Step 3: Implement constants.ts and types.ts**

`src/lib/types.ts` — TypeScript interfaces:
- `Game`, `Player`, `Hex`, `Action`, `Faction`, `TickReport`
- `Biome`, `Resource`, `Structure`, `Item`
- `ActionType`, `BiomeType`, `GameStatus`

`src/lib/constants.ts` — all balance numbers:
- `BIOMES` — each with: name, description, passable, risk (0-1), yields (min/max per resource), color (hex code for Phaser rendering)
- `RESOURCES` — id, name, description
- `STRUCTURES` — id, name, cost (Record<resource, amount>), buildActions, effect description
- `ITEMS` — id, name, slot, materials, effects
- `ACTIONS` — id, name, energyCost, description
- `GAME_DEFAULTS` — tick interval, energy, inventory, health, seats, etc.

**Step 4: Run test, verify pass**

Run: `npx vitest run tests/lib/constants.test.ts`

**Step 5: Commit**

```bash
git add src/lib/ tests/
git commit -m "feat: shared TypeScript constants — biomes, resources, structures, items, balance"
```

---

### Task 4: Supabase client helpers

**Files:**
- Create: `src/lib/supabase/client.ts` — browser client
- Create: `src/lib/supabase/server.ts` — server client (for API routes/server actions)
- Create: `src/lib/supabase/middleware.ts` — auth middleware

**Step 1: Implement browser client**

```ts
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

**Step 2: Implement server client**

```ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createServerSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: (cs) => cs.forEach(c => cookieStore.set(c)) } }
  );
}
```

**Step 3: Implement middleware for auth session refresh**

Standard Supabase + Next.js middleware pattern to refresh auth tokens.

**Step 4: Commit**

```bash
git add src/lib/supabase/
git commit -m "feat: Supabase client helpers — browser, server, middleware"
```

---

## Phase 2: Game Lifecycle (Server Actions)

### Task 5: Create and join game — server actions

**Files:**
- Create: `src/app/actions/game.ts`
- Create: `tests/actions/game.test.ts`

**Step 1: Write the test**

```ts
import { describe, it, expect } from 'vitest';
// Test the core logic functions that the server actions wrap

describe('game lifecycle', () => {
  it('creates a game with a 6-char code', async () => {
    const game = await createGameLogic('Test Game');
    expect(game.code).toHaveLength(6);
    expect(game.status).toBe('lobby');
  });

  it('joins a player to a game', async () => {
    const game = await createGameLogic('Test Game');
    const player = await joinGameLogic(game.code, 'Alice', 'avatar_1');
    expect(player.name).toBe('Alice');
    expect(player.health).toBe(100);
  });

  it('rejects duplicate names', async () => {
    const game = await createGameLogic('Test Game');
    await joinGameLogic(game.code, 'Alice', 'avatar_1');
    await expect(joinGameLogic(game.code, 'Alice', 'avatar_2')).rejects.toThrow();
  });

  it('starts a game with 3+ players', async () => {
    const game = await createGameLogic('Test Game');
    await joinGameLogic(game.code, 'Alice', 'avatar_1');
    await joinGameLogic(game.code, 'Bob', 'avatar_2');
    await joinGameLogic(game.code, 'Charlie', 'avatar_3');
    const started = await startGameLogic(game.id);
    expect(started.status).toBe('active');
  });

  it('rejects starting with < 3 players', async () => {
    const game = await createGameLogic('Test Game');
    await joinGameLogic(game.code, 'Alice', 'avatar_1');
    await expect(startGameLogic(game.id)).rejects.toThrow();
  });
});
```

**Step 2: Run, fail.**

**Step 3: Implement server actions**

`src/app/actions/game.ts` using `"use server"`:
- `createGame(name)` — generate 6-char alphanumeric code, insert game, return game
- `joinGame(code, name, avatar)` — anonymous Supabase auth (auto-create user), insert player linked to user_id, return player + game
- `startGame(gameId)` — validate 3+ players, generate map (Task 7), assign spawn positions, set status='active', set next_tick_at
- `getGameState(gameId, playerId)` — return game + player + visible hexes + queued actions + latest report

**Step 4: Run, pass.**

**Step 5: Commit**

```bash
git add src/app/actions/ tests/actions/
git commit -m "feat: game lifecycle server actions — create, join, start"
```

---

### Task 6: Action queue — server actions

**Files:**
- Create: `src/app/actions/player.ts`
- Create: `tests/actions/player.test.ts`

**Step 1: Write the test**

```ts
describe('action queue', () => {
  it('submits a valid move action', async () => { ... });
  it('rejects actions exceeding energy', async () => { ... });
  it('cancels a queued action', async () => { ... });
  it('validates move target is adjacent', async () => { ... });
  it('validates sleep requires bed structure', async () => { ... });
  it('validates build requires resources', async () => { ... });
});
```

**Step 2: Run, fail. Step 3: Implement. Step 4: Run, pass.**

`src/app/actions/player.ts`:
- `submitAction(gameId, playerId, actionType, params)` — validate energy, validate action rules, insert into actions table
- `cancelAction(actionId, playerId)` — delete from actions table
- `getMyActions(gameId, playerId)` — list queued actions for current tick

**Step 5: Commit**

```bash
git add src/app/actions/player.ts tests/actions/player.test.ts
git commit -m "feat: action queue server actions — submit, validate, cancel"
```

---

## Phase 3: Hex Map Generation

### Task 7: Procedural hex map generator

**Files:**
- Create: `src/lib/game/map.ts`
- Create: `tests/lib/map.test.ts`

**Step 1: Write the test**

```ts
describe('map generation', () => {
  it('generates correct hex count for player count', () => {
    const hexes = generateMap(6); // ~50-60 hexes
    expect(hexes.length).toBeGreaterThanOrEqual(40);
    expect(hexes.length).toBeLessThanOrEqual(70);
  });

  it('all hexes have valid biome types', () => { ... });
  it('contains scar hexes near center', () => { ... });
  it('contains ruin hexes in mid-ring', () => { ... });
  it('places ship parts in scars and ruins', () => { ... });
  it('chasm hexes form outer border', () => { ... });
  it('spawn points are spread apart (min 3 hex distance)', () => { ... });
  it('designates a hull hex (known Meridian crash site)', () => { ... });
});
```

**Step 2: Run, fail.**

**Step 3: Implement map.ts**

Pure function (no DB dependency) — returns array of hex objects.

Algorithm:
1. Calculate target count: `~9 * playerCount`
2. Use axial coordinates (q, r). Start at (0,0), expand in concentric rings.
3. Ring 0 (center): Scar biomes (Meridian crash). Mark one as hull.
4. Ring 1-2: Mixed biomes weighted toward safer types (flats, biolume forest).
5. Ring 3+: Full biome distribution, more ruins and dangerous types.
6. Outer ring: Chasm border.
7. Biome weights: flats 25%, biolume_forest 20%, crystal_ridge 15%, vent_fields 10%, fungal_marsh 10%, ruin 8%, scar 7%, chasm 5% (inner only; outer ring all chasm).
8. Ship parts: `ceil(playerCount * seatPercentage) * shipPartsMultiplier` parts placed in scar/ruin hexes.
9. Spawn points: select hexes in ring 2-3, maximize spacing between them (greedy algorithm), ensure each is on a passable biome.

Hex math utilities (also export these):
- `hexDistance(a, b)` — axial distance
- `hexNeighbors(q, r)` — 6 adjacent hexes
- `hexRing(center, radius)` — all hexes at exact distance
- `axialToPixel(q, r)` — convert to screen coords (for Phaser)
- `pixelToAxial(x, y)` — convert back (for click detection)

**Step 4: Run, pass.**

**Step 5: Commit**

```bash
git add src/lib/game/map.ts tests/lib/map.test.ts
git commit -m "feat: procedural hex map generation with biomes, spawns, ship parts"
```

---

### Task 8: Fog of war

**Files:**
- Create: `src/lib/game/fog.ts`
- Create: `tests/lib/fog.test.ts`

**Step 1: Write the test**

```ts
describe('fog of war', () => {
  it('base vision is 1 hex radius', () => { ... });
  it('scanner array extends vision by 1', () => { ... });
  it('faction members share vision', () => { ... });
  it('does not reveal beyond vision range', () => { ... });
});
```

**Step 2: Run, fail. Step 3: Implement.**

`getVisibleHexes(playerPosition, scannerRange, factionMemberPositions, allHexes)`:
- Pure function — takes positions, returns filtered hex array
- Collects all hexes within range of player + faction members
- Default range 1, +1 per scanner_array

**Step 4: Run, pass.**

**Step 5: Commit**

```bash
git add src/lib/game/fog.ts tests/lib/fog.test.ts
git commit -m "feat: fog of war with scanner and faction vision sharing"
```

---

## Phase 4: Tick Resolution Engine

### Task 9: Core tick resolution

**Files:**
- Create: `src/lib/game/tick.ts`
- Create: `tests/lib/tick.test.ts`

**Step 1: Write the test**

```ts
describe('tick resolution', () => {
  it('advances tick number', () => { ... });
  it('resolves move actions', () => { ... });
  it('resolves gather — adds resources within biome range', () => { ... });
  it('consumes 1 ration per player', () => { ... });
  it('starvation causes health loss', () => { ... });
  it('restores energy based on shelter', () => { ... });
  it('rested buff grants +1 energy', () => { ... });
  it('escalates planet hostility', () => { ... });
});
```

**Step 2: Run, fail.**

**Step 3: Implement tick.ts**

`resolveTick(gameState)` — takes full game state (game + players + hexes + actions), returns mutation list (what changed).

Resolution order:
1. **Movement** — apply all move actions simultaneously
2. **Actions** — gather, explore, build, craft, sleep, install_part
3. **Combat** — attack/hide for players on same hex (delegates to combat.ts)
4. **Survival** — consume rations, apply weather damage
5. **Recovery** — restore energy (3 base, -1 no shelter, +1 rested)
6. **Planet** — increment hostility, chance of biome mutation
7. **Reports** — generate placeholder narrative per player (LLM replaces this later)

Returns: `{ playerUpdates, hexUpdates, reports, gameUpdates }` — caller (Edge Function) applies these to the database.

**Step 4: Run, pass.**

**Step 5: Commit**

```bash
git add src/lib/game/tick.ts tests/lib/tick.test.ts
git commit -m "feat: core tick resolution — movement, gathering, survival, energy"
```

---

### Task 10: Combat resolution

**Files:**
- Create: `src/lib/game/combat.ts`
- Create: `tests/lib/combat.test.ts`

**Step 1: Write the test**

```ts
describe('combat', () => {
  it('attacker vs idle defender — attacker advantage', () => { ... });
  it('mutual attack — both take damage', () => { ... });
  it('death only at low health', () => { ... });
  it('hide with spore suit in marsh — high stealth', () => { ... });
  it('forest gives defender bonus', () => { ... });
  it('returns damage, loot, and outcome type', () => { ... });
});
```

**Step 2: Run, fail. Step 3: Implement. Step 4: Run, pass.**

Pure function: `resolveCombat(attacker, defender, actions, context)` returns outcome object.

**Step 5: Commit**

```bash
git add src/lib/game/combat.ts tests/lib/combat.test.ts
git commit -m "feat: combat resolution — attack, defend, hide, stealth, death"
```

---

### Task 11: Build, craft, and death resolution

**Files:**
- Modify: `src/lib/game/tick.ts`
- Create: `tests/lib/build-craft.test.ts`
- Create: `tests/lib/death.test.ts`

**Step 1: Write build/craft tests**

```ts
describe('building', () => {
  it('adds structure to player camp', () => { ... });
  it('fails if missing materials', () => { ... });
  it('sets camp location if none exists', () => { ... });
  it('rejects beyond max structures', () => { ... });
});

describe('crafting', () => {
  it('creates item and adds to inventory', () => { ... });
  it('requires workbench', () => { ... });
  it('auto-equips to empty slot', () => { ... });
});
```

**Step 2: Write death/respawn tests**

```ts
describe('death and respawn', () => {
  it('triggers death at 0 health', () => { ... });
  it('respawn clears inventory and stash', () => { ... });
  it('old camp becomes lootable ruins', () => { ... });
  it('keeps discoveries', () => { ... });
  it('respawn position is far from others', () => { ... });
});
```

**Step 3: Run, fail. Step 4: Implement in tick.ts. Step 5: Run, pass.**

**Step 6: Commit**

```bash
git add src/lib/game/tick.ts tests/lib/build-craft.test.ts tests/lib/death.test.ts
git commit -m "feat: build, craft, death and respawn resolution"
```

---

### Task 12: Faction system

**Files:**
- Create: `src/lib/game/factions.ts`
- Create: `src/app/actions/factions.ts`
- Create: `tests/lib/factions.test.ts`

**Step 1: Write the test**

```ts
describe('factions', () => {
  it('creates a faction', () => { ... });
  it('invites and accepts', () => { ... });
  it('one faction per player', () => { ... });
  it('leaving removes access', () => { ... });
  it('invisible to non-members', () => { ... });
});
```

**Step 2: Run, fail. Step 3: Implement. Step 4: Run, pass.**

Server actions in `src/app/actions/factions.ts`:
- `createFaction(gameId, name)`
- `inviteToFaction(factionId, targetPlayerId)`
- `acceptInvite(inviteId)` / `declineInvite(inviteId)`
- `leaveFaction(factionId)`

Queries filter by user_id via Supabase auth to ensure only faction members see faction data.

**Step 5: Commit**

```bash
git add src/lib/game/factions.ts src/app/actions/factions.ts tests/lib/factions.test.ts
git commit -m "feat: secret faction system — create, invite, join, leave"
```

---

## Phase 5: Tick Scheduler (Edge Function)

### Task 13: Supabase Edge Function for tick resolution

**Files:**
- Create: `supabase/functions/resolve-tick/index.ts`

**Step 1: Implement the edge function**

```ts
import { createClient } from '@supabase/supabase-js';
import { resolveTick } from '../../../src/lib/game/tick.ts';

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Find games that need ticking
  const { data: games } = await supabase
    .from('games')
    .select('*')
    .eq('status', 'active')
    .lte('next_tick_at', new Date().toISOString());

  for (const game of games ?? []) {
    // Load full game state
    const players = await supabase.from('players').select('*').eq('game_id', game.id);
    const hexes = await supabase.from('hexes').select('*').eq('game_id', game.id);
    const actions = await supabase.from('actions').select('*')
      .eq('game_id', game.id).eq('tick_number', game.tick_number).eq('resolved', false);

    // Resolve tick (pure function)
    const result = resolveTick({ game, players: players.data, hexes: hexes.data, actions: actions.data });

    // Apply mutations to database
    // Update players, hexes, game, insert tick reports
    // Mark actions as resolved
    // Set next_tick_at
  }

  return new Response(JSON.stringify({ resolved: games?.length ?? 0 }));
});
```

**Step 2: Set up cron trigger**

Use Supabase `pg_cron` or an external cron (e.g., `cron-job.org`) to call the edge function every 60 seconds.

Alternative: use `pg_cron` extension in Supabase:
```sql
select cron.schedule('tick-resolver', '* * * * *', $$
  select net.http_post(
    url := '<SUPABASE_URL>/functions/v1/resolve-tick',
    headers := '{"Authorization": "Bearer <SERVICE_ROLE_KEY>"}'::jsonb
  );
$$);
```

**Step 3: Test locally**

Run: `npx supabase functions serve resolve-tick`
Create a test game with 1-minute ticks. Verify tick resolves.

**Step 4: Commit**

```bash
git add supabase/functions/
git commit -m "feat: Supabase Edge Function for automatic tick resolution"
```

---

## Phase 6: Client — Lobby & Join Pages

### Task 14: Lobby and join flow (Next.js pages)

**Files:**
- Create: `src/app/page.tsx` — home/lobby
- Create: `src/app/create/page.tsx` — create game form
- Create: `src/app/join/[code]/page.tsx` — join game with avatar selection
- Create: `src/app/game/[code]/lobby/page.tsx` — waiting room
- Create: `src/components/AvatarPicker.tsx`

**Step 1: Home page**

Simple landing: game title, "Create Game" button, "Join Game" input (enter code).

**Step 2: Create game page**

Form: game name, tick interval selector (12h default, 1min for testing). Calls `createGame` server action. Redirects to waiting room with game code displayed prominently (for sharing).

**Step 3: Join page**

Enter name, pick avatar (grid of 8-12 simple avatar options). Calls `joinGame` server action. Uses Supabase anonymous auth to create a session. Redirects to waiting room.

**Step 4: Waiting room**

Shows joined players with avatars. Real-time updates via Supabase Realtime subscription on `players` table. Game creator sees "Start Game" button (enabled at 3+ players). On game start, all players redirected to game view.

**Step 5: Test manually**

Open 3 browser tabs, create game, join with 3 different names, start game.

**Step 6: Commit**

```bash
git add src/app/ src/components/
git commit -m "feat: lobby, create, join, and waiting room pages"
```

---

## Phase 7: Client — Phaser Game View

### Task 15: Phaser.js hex map scene

**Files:**
- Create: `src/components/GameCanvas.tsx` — React wrapper for Phaser
- Create: `src/game/config.ts` — Phaser game config
- Create: `src/game/scenes/MapScene.ts` — main game scene
- Create: `src/game/hex.ts` — hex rendering utilities

**Step 1: React-Phaser bridge**

`GameCanvas.tsx` — a React component that mounts a Phaser game instance into a div. Uses `useEffect` for lifecycle. Passes game state down via Phaser's registry or events.

**Step 2: Phaser config**

```ts
const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  backgroundColor: '#0a0a0a',
  scene: [MapScene],
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
};
```

**Step 3: MapScene — hex rendering**

- On `create()`: render all visible hexes as colored polygons (pointy-top hexagons)
- Biome colors from constants
- Fog hexes rendered as dark semi-transparent
- Player position marker (avatar circle with glow)
- Other visible players as smaller markers
- Meridian hull hex with distinct pulsing indicator
- Camp icons on hexes with player structures
- Ship part indicators on hexes

**Step 4: Camera controls**

- Drag to pan (mouse + touch)
- Scroll/pinch to zoom
- Center on player position on load
- Smooth follow

**Step 5: Hex interaction**

- Click/tap a hex to select it
- Emit event to React UI layer with hex data
- Highlight selected hex with outline glow

**Step 6: Test manually**

Start a game, verify hex map renders with correct biome colors, can pan/zoom, can tap hexes.

**Step 7: Commit**

```bash
git add src/components/GameCanvas.tsx src/game/
git commit -m "feat: Phaser.js hex map rendering with camera and interaction"
```

---

### Task 16: Game UI panels (React overlay)

**Files:**
- Create: `src/app/game/[code]/page.tsx` — game view page
- Create: `src/components/game/ActionPanel.tsx`
- Create: `src/components/game/TickReport.tsx`
- Create: `src/components/game/InventoryPanel.tsx`
- Create: `src/components/game/HexInfo.tsx`
- Create: `src/components/game/StatusBar.tsx`

**Step 1: Game view page**

Layout: Phaser canvas fills the screen. React panels overlay on top (absolute positioned). Status bar at top (health, energy, tick timer). Action panel at bottom. Side panels for inventory and hex info.

**Step 2: StatusBar**

- Health bar (red)
- Energy dots (blue)
- Tick countdown timer ("Next tick in 5h 23m")
- Game phase indicator

**Step 3: ActionPanel**

- Grid of action buttons: Move, Gather, Explore, Build, Craft, Sleep, Attack, Hide
- Queued actions list with cancel (X) buttons
- Energy cost shown per action
- Move mode: tap hex on map to set target
- Build/Craft: dropdown selector for structure/item

**Step 4: TickReport**

- Slide-up panel triggered by "New Report" notification
- Narrative text (from LLM)
- Resource changes with +/- indicators
- Events and discoveries
- Dismissable

**Step 5: InventoryPanel**

- 6-slot grid for inventory
- 4 equipment slots (tool, weapon, suit, device)
- Tap item to equip/unequip/drop
- Stash section (when at camp)

**Step 6: HexInfo**

- Triggered by tapping a hex on the map
- Shows biome name, description, risk level
- Players visible on hex
- Structures if it's your camp
- "Move here" shortcut button

**Step 7: Supabase Realtime subscriptions**

Subscribe to:
- `games` table (tick resolved, launch countdown)
- `players` table (other players' positions in vision)
- `tick_reports` table (new report for you)

On update, refresh local state and Phaser scene.

**Step 8: Test manually**

Full flow: create game with 3 players (1-minute ticks), explore, queue actions, wait for tick, read report.

**Step 9: Commit**

```bash
git add src/app/game/ src/components/game/
git commit -m "feat: game UI — action panel, tick reports, inventory, hex info, status bar"
```

---

## Phase 8: LLM Integration

### Task 17: Gemini Flash integration

**Files:**
- Create: `src/lib/llm.ts`
- Create: `tests/lib/llm.test.ts`

**Step 1: Write the test**

```ts
describe('LLM integration', () => {
  it('builds prompt with full context', () => {
    const prompt = buildHexEventPrompt({ biome: 'biolume_forest', action: 'gather', ... });
    expect(prompt).toContain('biolume_forest');
    expect(prompt).toContain('gather');
  });

  it('parses structured JSON from response', () => {
    const parsed = parseEventResponse('{"narrative":"...","outcomes":{"rations":4}}');
    expect(parsed.outcomes.rations).toBe(4);
  });

  it('clamps outcomes to biome yield ranges', () => {
    const parsed = parseEventResponse('{"narrative":"...","outcomes":{"rations":999}}', 'flats');
    expect(parsed.outcomes.rations).toBeLessThanOrEqual(BIOMES.flats.yields.rations.max);
  });

  it('falls back gracefully on LLM failure', () => {
    const result = generateFallbackEvent('biolume_forest', 'gather');
    expect(result.narrative).toBeTruthy();
    expect(result.outcomes).toBeDefined();
  });
});
```

**Step 2: Run, fail. Step 3: Implement.**

`src/lib/llm.ts`:
- `buildHexEventPrompt(context)` — system prompt defining the game world + constraints, user prompt with specific context. Includes JSON schema for response. Includes yield ranges so LLM stays in bounds.
- `callGemini(prompt)` — fetch to Gemini Flash API. Returns text.
- `parseEventResponse(text, biomeType)` — extract JSON, validate, clamp to ranges.
- `generateHexEvent(context)` — orchestrate: prompt → call → parse. Fallback on error.
- `generateEpilogue(playerContext)` — special prompt for loser epilogues.

**Step 4: Run, pass.**

**Step 5: Commit**

```bash
git add src/lib/llm.ts tests/lib/llm.test.ts
git commit -m "feat: Gemini Flash LLM integration with guardrails and fallback"
```

---

### Task 18: Wire LLM into tick resolution

**Files:**
- Modify: `src/lib/game/tick.ts` — call LLM for hex events
- Modify: `supabase/functions/resolve-tick/index.ts` — pass LLM context

**Step 1: Update tick.ts**

In the action resolution phase, for gather/explore actions:
1. Build context (biome, player state, hex history, hostility)
2. Call `generateHexEvent(context)`
3. Apply outcomes from LLM to player/hex state
4. Store narrative in tick report

Batch with `Promise.all` for all players (independent).

Add to hex history: append short summary of event (capped at 5 entries).

**Step 2: Update edge function to include GEMINI_API_KEY**

**Step 3: Test manually**

Set API key, run game with 1-min ticks, queue gather, verify LLM narrative in tick report.

**Step 4: Commit**

```bash
git add src/lib/game/tick.ts supabase/functions/
git commit -m "feat: LLM-narrated hex events in tick resolution"
```

---

## Phase 9: Endgame

### Task 19: Ship repair and launch sequence

**Files:**
- Create: `src/lib/game/launch.ts`
- Create: `tests/lib/launch.test.ts`
- Modify: `src/lib/game/tick.ts` — handle install_part and launch logic

**Step 1: Write the test**

```ts
describe('launch sequence', () => {
  it('installing part at hull increases progress', () => { ... });
  it('launch requires enough parts', () => { ... });
  it('trigger starts 3-tick countdown', () => { ... });
  it('vote to eject player during countdown', () => { ... });
  it('launch resolves — players at hull win', () => { ... });
  it('losers get epilogues', () => { ... });
});
```

**Step 2: Run, fail. Step 3: Implement. Step 4: Run, pass.**

**Step 5: Commit**

```bash
git add src/lib/game/launch.ts tests/lib/launch.test.ts src/lib/game/tick.ts
git commit -m "feat: ship repair, launch countdown, voting, epilogues"
```

---

### Task 20: Launch UI

**Files:**
- Create: `src/components/game/LaunchPanel.tsx`
- Create: `src/components/game/EpilogueScreen.tsx`

**Step 1: LaunchPanel**

Shown during countdown:
- Big countdown timer ("LAUNCH IN 2 TICKS")
- List of players at hull
- Available seats count
- Vote buttons (if more players than seats)
- Vote results per tick

**Step 2: EpilogueScreen**

Shown at game end:
- Winners list with "ESCAPED" badge
- Each loser's personalized LLM epilogue
- Share button (copy epilogue text)
- "Play Again" button

**Step 3: Commit**

```bash
git add src/components/game/
git commit -m "feat: launch countdown UI and epilogue screen"
```

---

## Phase 10: Planet Escalation

### Task 21: Hostility escalation and biome mutation

**Files:**
- Modify: `src/lib/game/tick.ts`
- Create: `tests/lib/escalation.test.ts`

**Step 1: Write the test**

```ts
describe('escalation', () => {
  it('hostility increases each tick', () => { ... });
  it('weather damage scales with hostility', () => { ... });
  it('biomes can mutate at high hostility', () => { ... });
  it('late game is significantly more dangerous', () => { ... });
});
```

**Step 2: Run, fail. Step 3: Implement. Step 4: Run, pass.**

- Hostility: `tick_number / (GAME_DEFAULTS.totalTicks)` → 0 to 1
- Weather damage: `floor(hostility * 15)` unsheltered, `floor(hostility * 5)` sheltered
- Biome mutation: `hostility * 0.1` probability per hex per tick
- Mutations: forest→marsh, flats→chasm, vent eruptions (damage)

**Step 5: Commit**

```bash
git add src/lib/game/tick.ts tests/lib/escalation.test.ts
git commit -m "feat: planet escalation — weather, biome mutation, rising danger"
```

---

## Phase 11: Polish & Deploy

### Task 22: Visual polish

**Files:**
- Modify: `src/game/scenes/MapScene.ts`
- Modify: `src/components/game/*.tsx`
- Modify: `src/app/globals.css`

**Step 1: Phaser visual improvements**

- Hex biome patterns (simple procedural patterns, not sprites)
- Smooth hex transitions on new visibility
- Player avatar rendering (colored circle + initial letter)
- Animated markers (pulsing hull, glowing ship parts)
- Particle effects for weather (rain, spores, crystal shimmer)

**Step 2: UI polish**

- Dark sci-fi theme (Tailwind)
- Mobile-first (touch-friendly 44px targets)
- Slide transitions for panels
- Notification badges for new reports
- Smooth animations

**Step 3: Commit**

```bash
git add src/
git commit -m "feat: visual polish — hex patterns, animations, sci-fi theme"
```

---

### Task 23: End-to-end test

**Files:**
- Create: `tests/e2e/full-game.test.ts`

**Step 1: Write integration test**

Simulate a complete mini-game:
1. Create game
2. Join 3 players
3. Start (map generated, spawns assigned)
4. Queue actions for several ticks
5. Resolve ticks
6. Find and install ship parts
7. Trigger launch
8. Countdown resolves
9. Winners and losers determined
10. Epilogues generated

**Step 2: Run, verify full flow.**

**Step 3: Commit**

```bash
git add tests/e2e/
git commit -m "test: end-to-end full game flow"
```

---

### Task 24: Deployment

**Files:**
- Modify: `package.json` — build/start scripts
- Create deployment config

**Step 1: Supabase production project**

- Create Supabase project at supabase.com
- Run migrations against production
- Set up Edge Function deployment
- Configure `pg_cron` for tick resolution

**Step 2: Deploy Next.js**

Options (choose one):
- **Vercel** — zero config for Next.js. Set env vars in dashboard.
- **Railway** — if you want more control

**Step 3: Environment variables**

Set in deployment platform:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GEMINI_API_KEY`

**Step 4: Verify production deployment**

Create a test game, invite friends, play a few ticks.

**Step 5: Commit**

```bash
git add .
git commit -m "chore: deployment configuration"
```

---

## Phase 12: Asset Pipeline (Future)

### Task 25: Asset generation pipeline (design only)

**Not implemented in v1.** Document the pipeline for future work:

1. **nanobanana** — generate concept art prompts for hex biomes, avatars, items
2. **fal.ai** — run image generation models (Stable Diffusion, SDXL) to create 2D assets
3. **Blender** — (optional) create 3D hex tiles, render to 2D sprite sheets for Phaser
4. **Integration** — Phaser loads sprite sheets, replaces colored polygons with textured hexes

For v1, colored hexes with simple patterns are sufficient. Asset pipeline is a polish phase.

---

## Summary

| Phase | Tasks | What You Get |
|-------|-------|-------------|
| 1. Scaffolding | 1-4 | Project structure, DB schema, constants, Supabase clients |
| 2. Game Lifecycle | 5-6 | Create/join games, action queue |
| 3. Hex Map | 7-8 | Procedural maps, fog of war |
| 4. Tick Engine | 9-12 | Core game loop, combat, build/craft, death, factions |
| 5. Tick Scheduler | 13 | Auto-ticking games via Edge Function |
| 6. Client Lobby | 14 | Create/join in browser |
| 7. Client Game | 15-16 | Phaser hex map + React UI panels |
| 8. LLM | 17-18 | Narrated hex events |
| 9. Endgame | 19-20 | Ship repair, launch, epilogues |
| 10. Escalation | 21 | Rising planetary danger |
| 11. Polish & Deploy | 22-24 | Visual polish, testing, live deployment |
| 12. Assets | 25 | Asset pipeline design (future) |

**First playable milestone:** After Phase 7 (Task 16) — working game with hex map, actions, tick resolution, and basic UI. Playable with friends using 1-minute ticks for testing.

**First fun milestone:** After Phase 8 (Task 18) — LLM narratives make every tick report a story worth sharing on WhatsApp.
