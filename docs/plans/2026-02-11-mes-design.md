# MES System Design — FMCG Manufacturing Execution System

**Date:** 2026-02-11
**Status:** Draft — awaiting approval

---

## 1. Overview

A web-based Manufacturing Execution System (MES) for an FMCG company with three manufacturing department types: **batch manufacturing**, **discrete manufacturing**, and **packaging**. The system is informed by ISA 88 (batch control) and ISA 95 (enterprise-control integration) standards, modernized for IoT-direct-to-cloud architectures.

### MVP Modules
1. **Job Center** — Work order management and production execution
2. **Quality Control** — Quality checks, deviations, holds, batch traceability
3. **Recipe / BOM Management** — ISA 88 recipe lifecycle with versioning and approval
4. **Plant Simulator** — Stochastic simulation engine for testing and demos

### Deferred to Phase 2+
- OEE Management
- IoT Integration (MQTT)
- ERP Integration (SAP/D365)
- Maintenance Operations
- Reporting & Analytics
- 21 CFR Part 11 Compliance
- Digital Twin Visualization

---

## 2. Tech Stack

| Layer | Technology | Rationale |
|---|---|---|
| Frontend | React + Vite (SPA) | Large component ecosystem, fast builds, static deployment |
| Backend | NestJS + TypeScript | Modular architecture, guards/interceptors for cross-cutting concerns, Socket.io support |
| Database | PostgreSQL + TimescaleDB | Single engine for transactional + time-series data, simplest ops |
| Real-time | Socket.io (WebSockets) | Mature, reconnection handling, room-based scoping |
| Cache/Sessions | Redis | Session store, Socket.io adapter, caching |
| Auth | Microsoft Entra ID (OIDC) | O365 SSO, enterprise identity provider |
| i18n | react-i18next + JSON i18n fields | Multi-language UI (EN, NL, ZH, ...) with translatable user-defined data |
| Deployment | Docker Compose on VM | Self-hosted for reliability, runs on plant network |

---

## 3. Deployment Topology

A single VM (or Docker Compose stack) running:

```
┌─────────────────────────────────────────────┐
│  VM / Docker Compose                        │
│                                             │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐ │
│  │  Nginx   │  │  Redis   │  │ PostgreSQL│ │
│  │ (reverse │  │          │  │ +Timescale│ │
│  │  proxy)  │  │          │  │           │ │
│  └────┬─────┘  └──────────┘  └───────────┘ │
│       │                                     │
│  ┌────┴─────┐  ┌──────────┐                 │
│  │  NestJS  │  │Simulator │                 │
│  │  API +   │  │ (engine) │                 │
│  │ Socket.io│  │          │                 │
│  │ + static │  │          │                 │
│  │  SPA     │  │          │                 │
│  └──────────┘  └──────────┘                 │
└─────────────────────────────────────────────┘
```

- Nginx serves the React SPA and reverse-proxies API/WebSocket traffic
- Simulator runs as a separate process, connects to the MES API as a client
- All services on the same network; PostgreSQL and Redis not exposed externally

---

## 4. Authentication & Authorization

### Authentication Flow
1. User navigates to MES → redirected to Microsoft Entra ID (OIDC)
2. Entra ID returns ID token → API validates, looks up user in MES database
3. Users auto-provisioned on first login (Entra ID = identity source, MES manages roles/areas)
4. Local service accounts supported via API keys (for simulator, future IoT gateways)

### Permission Model: Role + Area Matrix

Users have roles scoped to areas. A user can hold different roles in different areas.

**Roles:**
- **Operator** — Start/stop jobs, log production, complete QC checks
- **Supervisor** — All operator permissions + create work orders, manage holds, reassign work
- **QC Inspector** — Complete QC checks, raise deviations, place/release holds
- **Engineer** — Configure recipes, QC templates, reason codes, equipment hierarchy
- **Admin** — User management, site/area configuration, system settings

**Permission check:** Every API endpoint enforces `@RequirePermission('job:start')`. The guard resolves: *does this user have a role in the requested area that includes this permission?*

**Permission strings (examples):**
```
job:view, job:create, job:start, job:complete, job:hold, job:reassign
qc:view, qc:inspect, qc:deviate, qc:hold, qc:release
recipe:view, recipe:edit, recipe:approve, recipe:obsolete
config:view, config:edit
user:view, user:manage
```

---

## 5. ISA 95 Physical Model — Equipment Hierarchy

```
Enterprise (the company)
  └── Site (a factory)
       └── Area (Batch Mfg | Discrete Mfg | Packaging)
            └── Work Center (a production line or cell)
                 └── Work Unit (a machine/station within a line)
```

### Data Model

```sql
sites {
  id            UUID PRIMARY KEY
  enterprise_id UUID
  name_i18n     JSONB        -- { "en": "Plant Amsterdam", "nl": "Fabriek Amsterdam" }
  timezone      TEXT
  locale        TEXT
}

areas {
  id            UUID PRIMARY KEY
  site_id       UUID REFERENCES sites
  name_i18n     JSONB
  area_type     TEXT         -- 'batch' | 'discrete' | 'packaging'
  config        JSONB        -- area-level configuration overrides
}

work_centers {
  id            UUID PRIMARY KEY
  area_id       UUID REFERENCES areas
  name_i18n     JSONB
  description   JSONB
}

work_units {
  id            UUID PRIMARY KEY
  work_center_id UUID REFERENCES work_centers
  name_i18n     JSONB
  unit_type     TEXT
}
```

`area_type` drives behavioral differences: batch areas show recipe scaling and batch records, discrete areas show piece counts, packaging areas show line speeds and format changes.

---

## 6. Configuration Philosophy — Inherit, Override, Don't Duplicate

### Principle
Configure at the highest level possible. Override only where needed. Never duplicate.

### Three-Tier Inheritance
```
Site (defaults)
  └── Area (overrides site defaults)
       └── Work Center (overrides area defaults for line-specific exceptions)
```

**Resolution logic:** merge Site + Area + Work Center configs. Lower levels override upper.

### Data Model

```sql
config_overrides {
  id            UUID PRIMARY KEY
  entity_type   TEXT         -- 'qc_limit', 'reason_codes', 'shift_schedule', ...
  entity_id     UUID
  scope_type    TEXT         -- 'site' | 'area' | 'work_center'
  scope_id      UUID
  key           TEXT
  value         JSONB
}
```

### Efficiency Features
- **Bulk assignment**: Select multiple work centers → assign QC template / reason codes in one action
- **Clone Work Center**: Duplicate a fully configured work center, adjust differences
- **Recipe applicability**: Master recipes target an `area_type` and are available on all compatible work centers by default
- **Config diff view**: When overriding, show inherited vs. customized values

Setting up a new packaging line: clone an existing one, tweak the differences. Minutes, not hours.

---

## 7. Users & Permissions Data Model

```sql
users {
  id              UUID PRIMARY KEY
  entra_id        TEXT UNIQUE
  email           TEXT
  display_name    TEXT
  preferred_locale TEXT        -- 'en', 'nl', 'zh', ...
  is_active       BOOLEAN
}

roles {
  id              UUID PRIMARY KEY
  name            TEXT         -- 'Operator', 'Supervisor', 'QC Inspector', 'Engineer', 'Admin'
  permissions     TEXT[]       -- ['job:start', 'job:complete', 'qc:inspect', ...]
}

user_areas {
  user_id         UUID REFERENCES users
  area_id         UUID REFERENCES areas
  role_id         UUID REFERENCES roles
  PRIMARY KEY (user_id, area_id)
}
```

---

## 8. Internationalization (i18n)

### UI Strings
- `react-i18next` with JSON translation files per locale (`en.json`, `nl.json`, `zh.json`)
- Language preference stored per user in `users.preferred_locale`

### User-Defined Data
Translatable fields use JSONB: `{ "en": "Mixing speed", "nl": "Mengsnelheid", "zh": "搅拌速度" }`

API accepts `Accept-Language` header, returns resolved `name` field with English fallback.

### Dates & Numbers
Locale-aware formatting via `Intl` API (decimal separators, date formats).

---

## 9. Module: Job Center (Production Execution)

### Work Order Lifecycle
```
Draft → Released → Started → In Progress → Completed
                                  ↓
                              On Hold
```

### Data Model

```sql
work_orders {
  id                UUID PRIMARY KEY
  order_number      TEXT UNIQUE
  product_id        UUID REFERENCES products
  area_id           UUID REFERENCES areas
  work_center_id    UUID REFERENCES work_centers
  control_recipe_id UUID REFERENCES control_recipes
  quantity_target   DECIMAL
  quantity_produced DECIMAL
  quantity_rejected DECIMAL
  status            TEXT          -- 'draft', 'released', 'started', 'in_progress', 'completed', 'on_hold'
  priority          INTEGER
  scheduled_start   TIMESTAMPTZ
  actual_start      TIMESTAMPTZ
  actual_end        TIMESTAMPTZ
  created_by        UUID REFERENCES users
}

work_order_steps {
  id                UUID PRIMARY KEY
  work_order_id     UUID REFERENCES work_orders
  sequence          INTEGER
  name_i18n         JSONB
  step_type         TEXT          -- 'setup', 'production', 'changeover', 'cleaning'
  status            TEXT
  started_at        TIMESTAMPTZ
  completed_at      TIMESTAMPTZ
  operator_id       UUID REFERENCES users
}

production_logs {
  id                UUID PRIMARY KEY
  work_order_id     UUID REFERENCES work_orders
  work_unit_id      UUID REFERENCES work_units
  timestamp         TIMESTAMPTZ
  event_type        TEXT          -- 'count', 'reject', 'downtime', 'note'
  value             DECIMAL
  reason_code_id    UUID REFERENCES reason_codes
  operator_id       UUID REFERENCES users
}

reason_codes {
  id                UUID PRIMARY KEY
  area_id           UUID REFERENCES areas   -- nullable for site-level codes
  category          TEXT          -- 'downtime', 'reject', 'hold'
  name_i18n         JSONB
  requires_comment  BOOLEAN
}
```

### Operator Experience
- Filtered list of work orders for their area/work center, sorted by priority and schedule
- Tap a work order → product info, recipe parameters, materials needed, QC checks due
- Touch-friendly buttons: **Start**, **Pause**, **Complete Step**, **Log Downtime**, **Report Reject**
- Real-time counters update via Socket.io (manual in MVP, IoT-fed in Phase 2)

### Supervisor View
- All work orders across the area
- Reassign, reprioritize, override holds

### Changeover Support
When a work order for a different product starts on the same work center, the system auto-inserts a changeover step with an area-specific checklist. Critical for FMCG — fast changeovers on packaging lines, CIP on batch equipment.

### Socket.io Events
```
work-order:status-changed  → { workOrderId, status, workCenterId }
production:count-updated   → { workOrderId, quantity, timestamp }
```

Operators join work center rooms. Supervisors join area rooms.

---

## 10. Module: Quality Control

### QC Template Configuration

```sql
qc_templates {
  id                UUID PRIMARY KEY
  area_id           UUID REFERENCES areas
  product_id        UUID REFERENCES products
  name_i18n         JSONB
  trigger           TEXT          -- 'on_start', 'on_complete', 'timed_interval', 'every_n_units'
  trigger_value     DECIMAL       -- interval minutes or unit count
  is_mandatory      BOOLEAN
}

qc_template_params {
  id                UUID PRIMARY KEY
  template_id       UUID REFERENCES qc_templates
  name_i18n         JSONB
  param_type        TEXT          -- 'numeric', 'boolean', 'text', 'selection'
  unit              TEXT
  target_value      DECIMAL
  lower_limit       DECIMAL
  upper_limit       DECIMAL
  options_i18n      JSONB         -- for selection type
  sequence          INTEGER
}
```

When a work order starts, the system resolves applicable templates (by area + product) and creates check instances on schedule.

### QC Execution

```sql
qc_checks {
  id                UUID PRIMARY KEY
  work_order_id     UUID REFERENCES work_orders
  template_id       UUID REFERENCES qc_templates
  status            TEXT          -- 'pending', 'due', 'passed', 'failed', 'skipped'
  scheduled_at      TIMESTAMPTZ
  completed_at      TIMESTAMPTZ
  operator_id       UUID REFERENCES users
}

qc_results {
  id                UUID PRIMARY KEY
  check_id          UUID REFERENCES qc_checks
  param_id          UUID REFERENCES qc_template_params
  value             TEXT
  is_in_spec        BOOLEAN
  comment           TEXT
}

qc_deviations {
  id                UUID PRIMARY KEY
  check_id          UUID REFERENCES qc_checks
  work_order_id     UUID REFERENCES work_orders
  severity          TEXT          -- 'minor', 'major', 'critical'
  description       TEXT
  action_taken      TEXT
  resolved_by       UUID REFERENCES users
  resolved_at       TIMESTAMPTZ
}

qc_holds {
  id                UUID PRIMARY KEY
  work_order_id     UUID REFERENCES work_orders
  deviation_id      UUID REFERENCES qc_deviations
  hold_type         TEXT          -- 'quality', 'material'
  placed_by         UUID REFERENCES users
  placed_at         TIMESTAMPTZ
  released_by       UUID REFERENCES users
  released_at       TIMESTAMPTZ
  disposition       TEXT          -- 'release', 'rework', 'scrap'
}
```

### Operator Experience
- Notification on Job Center screen: "QC check due — Fill weight"
- Enter measured values → system auto-evaluates against limits (green/red)
- Out-of-spec → deviation created, supervisor notified via Socket.io
- Critical deviations auto-hold the work order until supervisor dispositions

### Batch Traceability
Finished product → work order → materials consumed + quality checks + who/when. Sufficient for most FMCG audits.

### Audit Trail

```sql
audit_log {
  id                UUID PRIMARY KEY
  timestamp         TIMESTAMPTZ
  user_id           UUID REFERENCES users
  action            TEXT          -- 'qc_check_completed', 'hold_placed', 'hold_released', ...
  entity_type       TEXT
  entity_id         UUID
  before_state      JSONB
  after_state       JSONB
}
```

Immutable. All QC actions logged. Foundation for future 21 CFR Part 11.

### Socket.io Events
```
qc:check-due            → { checkId, workOrderId, operatorId }
qc:deviation-raised      → { deviationId, severity, workOrderId }
```

---

## 11. Module: Recipe / BOM Management

### Recipe Lifecycle
```
Draft → In Review → Approved → Active → Obsolete
```

- Only Engineers can create/edit recipes
- Approval requires a different user (four-eyes principle, logged in audit trail)
- Only one version per product can be `Active` at a time

### Data Model

```sql
products {
  id                UUID PRIMARY KEY
  sku               TEXT UNIQUE
  name_i18n         JSONB
  description_i18n  JSONB
  is_active         BOOLEAN
}

materials {
  id                UUID PRIMARY KEY
  code              TEXT UNIQUE
  name_i18n         JSONB
  category          TEXT
  unit_of_measure   TEXT
}

master_recipes {
  id                UUID PRIMARY KEY
  product_id        UUID REFERENCES products
  version           INTEGER
  status            TEXT          -- 'draft', 'in_review', 'approved', 'active', 'obsolete'
  area_type         TEXT          -- 'batch', 'discrete', 'packaging'
  applicable_work_centers UUID[]  -- empty = all compatible
  created_by        UUID REFERENCES users
  approved_by       UUID REFERENCES users
  approved_at       TIMESTAMPTZ
  notes             TEXT
}

recipe_phases {
  id                UUID PRIMARY KEY
  recipe_id         UUID REFERENCES master_recipes
  sequence          INTEGER
  name_i18n         JSONB
  phase_type        TEXT          -- 'preparation', 'processing', 'finishing', 'cleaning'
  duration_target   INTERVAL
  instructions_i18n JSONB
}

recipe_parameters {
  id                UUID PRIMARY KEY
  phase_id          UUID REFERENCES recipe_phases
  name_i18n         JSONB
  param_type        TEXT          -- 'setpoint', 'limit', 'info'
  value             DECIMAL
  unit              TEXT
  lower_limit       DECIMAL
  upper_limit       DECIMAL
}

recipe_materials {
  id                UUID PRIMARY KEY
  recipe_id         UUID REFERENCES master_recipes
  phase_id          UUID REFERENCES recipe_phases
  material_id       UUID REFERENCES materials
  quantity_per_batch DECIMAL
  unit              TEXT
  is_critical       BOOLEAN
  scaling_type      TEXT          -- 'linear', 'fixed'
}
```

### Control Recipe
When a work order starts, the active master recipe is snapshotted into a `control_recipe` (identical structure). This captures exact parameters for that production run. Recipe edits don't affect historical records. Operator adjustments during production are logged in the audit trail.

### Recipe Comparison
Engineers can diff two recipe versions side-by-side: material quantities, parameters, added/removed phases.

### Scaling (Batch Manufacturing)
Recipes define quantities per standard batch size. For different batch sizes:
- `linear` materials scale proportionally
- `fixed` materials stay constant (e.g., a catalyst)

---

## 12. Plant Simulator

A standalone simulation engine that generates realistic production events and feeds them to the MES through the same API interfaces real equipment would use.

### Architecture

```
packages/
  └── simulator/
      └── src/
          ├── engine.ts           # Discrete-event simulation loop
          ├── equipment/          # Virtual machine models
          ├── scenarios/          # Pre-built plant configurations
          ├── distributions.ts    # Stochastic models (Weibull, Poisson, normal)
          └── client.ts           # Connects to MES API + Socket.io
```

Runs as a separate process. Connects as a "machine gateway" via the API — the same integration point real IoT gateways will use in Phase 2.

### Virtual Equipment Model

```typescript
interface SimulatedWorkCenter {
  work_center_id: string;        // Links to real MES work center
  ideal_cycle_time_sec: number;  // e.g., 0.5s (packaging), 2700s (batch)
  speed_variance_pct: number;    // Normal distribution ±%

  // Stochastic events
  breakdown_mtbf_hours: number;  // Weibull distribution
  breakdown_mttr_min: {          // Log-normal distribution
    mean: number;
    std: number;
  };
  minor_stop_rate_per_hour: number;  // Poisson distribution
  reject_rate: number;               // Beta distribution

  // Quality simulation
  quality_params: {
    [paramName: string]: {
      mean: number;
      std: number;
    };
  };
}
```

### Simulation Behavior
1. Picks up released work orders from the MES (via API)
2. Starts work orders, progresses through recipe phases
3. Generates production counts at configured cycle time (with variance)
4. Randomly triggers events based on stochastic models:
   - **Breakdowns**: logs downtime with reason code, pauses production, resumes after MTTR
   - **Minor stops**: brief pauses (starved, jammed)
   - **Quality defects**: rejects with reason codes
   - **QC measurements**: values from normal distributions (mostly in-spec, occasionally out-of-spec)
5. Completes work order when target quantity is reached

### Features
- **Time acceleration**: Run an 8-hour shift in 5 minutes, or real-time for demos
- **Seeded randomness**: Same seed = same sequence of events (reproducible regression testing)
- **Pre-built scenarios**: "Normal day" (95% OEE), "Bad batch", "Unreliable line", "Changeover-heavy"
- **Multi-line**: Simulate entire areas — 5 packaging lines with independent stochastic behavior
- **Operator simulation**: Optionally auto-respond to QC checks and deviations

### Scenario Configuration Example

```json
{
  "name": "Packaging Area - Normal Day",
  "time_scale": 60,
  "seed": 42,
  "lines": [
    {
      "work_center_id": "pkg-line-1",
      "ideal_cycle_time_sec": 0.5,
      "breakdown_mtbf_hours": 8,
      "breakdown_mttr_min": { "mean": 15, "std": 5 },
      "reject_rate": 0.003,
      "minor_stop_rate_per_hour": 2,
      "quality_params": {
        "fill_weight_g": { "mean": 500, "std": 2.1 }
      }
    }
  ]
}
```

OEE validation: with a known seed, expected OEE can be calculated analytically and verified against the system.

---

## 13. API Design Principles

- **RESTful** with consistent patterns: `GET /api/areas/:areaId/work-orders`, `POST /api/quality/checks/:id/complete`
- **Permission enforcement** via NestJS guard on every endpoint: `@RequirePermission('job:start')` — auto-scoped to user's allowed areas
- **Bulk endpoints**: `POST /api/config/qc-templates/:id/assign` with `{ workCenterIds: [...] }`
- **Audit logging** via interceptor — all mutations logged automatically, no module opt-in required
- **i18n**: `Accept-Language` header → resolved `name` fields from `name_i18n` JSONB, English fallback
- **Validation**: NestJS pipes with class-validator for input validation
- **Error handling**: Consistent error response format with error codes

### Socket.io Event Design
Users join rooms by scope:
- Operators → `work-center:{id}`
- Supervisors → `area:{id}`
- Dashboards → both

Events:
```
work-order:status-changed   → { workOrderId, status, workCenterId }
production:count-updated    → { workOrderId, quantity, timestamp }
qc:check-due                → { checkId, workOrderId, operatorId }
qc:deviation-raised         → { deviationId, severity, workOrderId }
```

---

## 14. Project Structure

```
mes-pilot/
├── packages/
│   ├── api/                        # NestJS backend
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   │   ├── auth/           # Entra ID OIDC, session management
│   │   │   │   ├── core/           # Sites, areas, work centers, work units
│   │   │   │   ├── users/          # User management, roles, area assignments
│   │   │   │   ├── recipes/        # Recipe CRUD, versioning, approval workflow
│   │   │   │   ├── jobs/           # Work orders, steps, production logs
│   │   │   │   ├── quality/        # QC templates, checks, deviations, holds
│   │   │   │   ├── config/         # Inherited config, reason codes, shifts
│   │   │   │   └── audit/          # Immutable audit log
│   │   │   ├── common/             # Guards, interceptors, i18n, filters
│   │   │   └── gateway/            # Socket.io gateway for real-time events
│   │   └── migrations/             # Database migrations
│   ├── web/                        # React + Vite SPA
│   │   └── src/
│   │       ├── modules/            # Mirrors API modules
│   │       ├── components/         # Shared UI (tables, forms, buttons)
│   │       ├── hooks/              # Data fetching, socket subscriptions
│   │       ├── i18n/               # Translation files (en, nl, zh, ...)
│   │       └── auth/               # OIDC redirect, session context
│   └── simulator/                  # Plant simulator engine
│       └── src/
│           ├── engine.ts
│           ├── equipment/
│           ├── scenarios/
│           ├── distributions.ts
│           └── client.ts
├── docker-compose.yml              # PostgreSQL+TimescaleDB, Redis, API, Nginx
├── docs/
│   └── plans/
└── README.md
```

---

## 15. Phase 2+ Roadmap

| Module | Description |
|---|---|
| **OEE Management** | Availability/Performance/Quality KPIs, real-time dashboards per line, shift reports, Pareto analysis. Builds on Job Center production logs. |
| **IoT Integration** | MQTT broker (Mosquitto) for equipment data. Machine counters, states, sensor values flow automatically. Edge gateway translates PLC data to MQTT topics. |
| **ERP Integration** | Receive work orders from SAP/D365 via REST API or file import. Report production performance back. B2MML-inspired JSON schemas. |
| **Maintenance** | Maintenance requests from shop floor, maintenance work orders, equipment downtime history. ISA 95: Maintenance Operations. |
| **Reporting & Analytics** | Historical production reports, batch records, quality trend analysis, SPC charting. PDF/Excel export. |
| **21 CFR Part 11** | Electronic signatures on recipe approvals, QC dispositions. Formal validation. |
| **Digital Twin** | Live visualization of line status, equipment states. Builds on IoT + equipment hierarchy. |

---

## 16. Key Design Decisions Summary

| Decision | Choice | Rationale |
|---|---|---|
| Backend framework | NestJS | Modular, guards/interceptors, TypeScript native |
| Frontend framework | React + Vite | Ecosystem, SPA served as static files |
| Database | PostgreSQL + TimescaleDB | One engine for transactional + time-series |
| Real-time | Socket.io | Mature, room-based, auto-reconnect |
| Auth | Entra ID OIDC | O365 SSO requirement |
| Permissions | Role + Area matrix | ISA 95 aligned, granular without ABAC complexity |
| i18n | react-i18next + JSONB fields | UI strings + user-defined data translation |
| Configuration | Three-tier inheritance | Prevent duplication, fast setup of new lines |
| Recipe model | ISA 88 master → control | Immutable production records, version control |
| Work orders (MVP) | Manual creation | No ERP dependency, add integration later |
| QC compliance (MVP) | Basic tracking + audit trail | Sufficient for FMCG, 21 CFR Part 11 later |
| Deployment | Docker Compose on VM | Self-hosted, plant-network reliability |
| Testing | Plant simulator with seeded RNG | Reproducible, realistic, no factory needed |
