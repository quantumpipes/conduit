---
title: "QP Conduit Admin Dashboard"
description: "Documentation for the Conduit admin dashboard: React 19 SPA with six views, URL-based routing, interactive blank slate, and rich empty states for managing services, DNS, TLS, servers, and routing."
date_modified: "2026-04-07"
ai_context: |
  Admin dashboard docs for QP Conduit. React 19, TypeScript, Vite 6,
  TailwindCSS 4, Zustand, TanStack Query. OKLCH dark theme with 6 surface
  levels. Six views: Dashboard, Services, DNS, TLS, Servers, Routing.
  URL routing via History API (/, /services, /dns, /tls, /servers, /routing).
  Blank slate topology visualization on first run. Rich per-view empty states.
  225 tests, 97%+ coverage. Served from server.py SPA fallback at port 9999.
related:
  - ./api.md
  - ./development.md
  - ./guide.md
---

# Admin Dashboard

The Conduit admin dashboard is a single-page application that provides a visual interface for managing services, DNS, TLS certificates, server monitoring, and routing. It consumes the [REST API](./api.md) served by `server.py`.

<!-- VERIFIED: repos/conduit/ui/src/app.tsx:1-48 -->

## Overview

```
┌──────────────────────────────────────────────────────────────────┐
│  QP CONDUIT            DNS ● Caddy ● 4/4 up ● 3 certs valid    │
├──────────┬───────────────────────────────────────────────────────┤
│ Overview │                                                       │
│ Dashboard│   ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ │
│          │   │Services  │ │Certs     │ │DNS       │ │Servers │ │
│ Services │   │ 4/4 up   │ │ 3 valid  │ │ 12 total │ │ 2 on   │ │
│  Services│   └──────────┘ └──────────┘ └──────────┘ └────────┘ │
│  DNS     │                                                       │
│  TLS     │   ┌──────────────── Services Health ────────────────┐ │
│          │   │ grafana ● up  12ms  │  core ● up  8ms          │ │
│ Infra    │   └────────────────────────────────────────────────┘ │
│  Servers │                                                       │
│  Routing │   ┌─ Recent Audit ──┐  ┌─ Quick Actions ───────────┐ │
│          │   │ register ● OK   │  │ Register Service          │ │
│ [Collapse│   │ dns.flush ● OK  │  │ Manage Certs              │ │
│          │   └─────────────────┘  └───────────────────────────┘ │
└──────────┴───────────────────────────────────────────────────────┘
```

## URL Routing

The dashboard uses browser-native URL routing. Each view has a dedicated path that supports deep linking, bookmarks, and browser back/forward navigation.

<!-- VERIFIED: repos/conduit/ui/src/stores/app-store.ts:37-56 -->

| Path | View | Document Title |
|---|---|---|
| `/` | Dashboard | QP Conduit |
| `/services` | Services | Services -- QP Conduit |
| `/dns` | DNS | Dns -- QP Conduit |
| `/tls` | TLS | Tls -- QP Conduit |
| `/servers` | Servers | Servers -- QP Conduit |
| `/routing` | Routing | Routing -- QP Conduit |

Implementation: the Zustand store reads `window.location.pathname` on init and pushes new history entries on `setView()`. A `popstate` listener handles back/forward. No react-router dependency needed.

<!-- VERIFIED: repos/conduit/ui/src/stores/app-store.ts:63-79,95-99 -->

The FastAPI server has a catch-all SPA fallback that serves `index.html` for all non-API, non-asset paths.

<!-- VERIFIED: repos/conduit/server.py:445-458 -->

## Blank Slate Experience

When Conduit starts with no registered services, certificates, DNS entries, or servers, the dashboard shows an interactive welcome experience instead of empty stat cards.

<!-- VERIFIED: repos/conduit/ui/src/components/views/dashboard/blank-slate.tsx:1-406 -->

The blank slate includes:

- **Status beacon**: pulsing green dot confirming "Conduit is running"
- **Interactive topology map**: SVG visualization with a central Conduit hub connected to 5 satellite nodes (Services, DNS, TLS, Servers, Routing). Animated data packets flow along connections. Click any node to navigate to that view.
- **Principles strip**: Zero Trust, Air-Gapped, Observable
- **Capability cards**: 5 expandable accordion cards, each showing a description, the CLI command, and a navigation button
- **First step CTA**: prominent "Register a Service" button

The blank slate automatically disappears when any data is registered.

<!-- VERIFIED: repos/conduit/ui/src/components/views/dashboard/dashboard-view.tsx:67-74 -->

### Per-View Empty States

Each view shows a rich empty state when it has no data, using the shared `ViewBlankSlate` component:

<!-- VERIFIED: repos/conduit/ui/src/components/shared/view-blank-slate.tsx:1-103 -->

| View | Title | Tagline | Action |
|---|---|---|---|
| Services | No services registered | The service registry is your single source of truth | Register a Service (opens form) |
| DNS | No DNS entries | Every service gets a name, automatically | Register a Service (navigates) |
| TLS | No certificates issued | Internal CA with automatic certificate lifecycle | Register a Service (navigates) |
| Servers | No servers reporting | Full-stack hardware observability | View Dashboard |
| Routing | No routes configured | Caddy reverse proxy, fully automated | Register a Service (navigates) |

Each empty state includes:

- Section-colored icon with glow effect
- 4 feature pills explaining capabilities at a glance
- The exact CLI command to get started
- A "Back to Dashboard" link

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | React | 19 |
| Language | TypeScript | strict mode |
| Build tool | Vite | 6 |
| Styling | TailwindCSS | 4 |
| State management | Zustand | 5 |
| Data fetching | TanStack Query | 5 |
| Icons | Lucide React | latest |
| Code splitting | React.lazy + Suspense | |
| Testing | Vitest + RTL + happy-dom | |

## Design System

The dashboard uses an OKLCH color palette for perceptually uniform rendering. All colors are semantic tokens defined in `ui/src/theme.css`.

<!-- VERIFIED: repos/conduit/ui/src/theme.css:1-130 -->

### Surface Hierarchy

Six levels of surface elevation for visual depth:

| Token | OKLCH Value | Purpose |
|---|---|---|
| `surface-0` | `oklch(0.08 0.02 240)` | Page background |
| `surface-1` | `oklch(0.12 0.025 240)` | Sidebar, cards |
| `surface-2` | `oklch(0.16 0.03 240)` | Elevated panels |
| `surface-3` | `oklch(0.2 0.035 240)` | Hover states |
| `surface-4` | `oklch(0.25 0.04 240)` | Active/selected |
| `surface-5` | `oklch(0.3 0.04 240)` | Highest elevation |

### Text Hierarchy

| Token | Purpose |
|---|---|
| `text-1` | Primary text (headings, labels) |
| `text-2` | Secondary text (descriptions) |
| `text-3` | Tertiary text (metadata) |
| `text-muted` | Disabled/placeholder text |

### Status Colors

| Token | Color | Purpose |
|---|---|---|
| `success` | Green | Healthy, active, valid |
| `warning` | Amber | Expiring, degraded |
| `error` | Red | Down, expired, failed |
| `info` | Blue | Informational |

### Service Colors

Each subsystem has a unique hue for visual identification:

| Token | Hue | Subsystem |
|---|---|---|
| `svc-dns` | 260 (violet) | DNS entries |
| `svc-tls` | 150 (teal) | TLS certificates |
| `svc-routing` | 45 (amber) | Proxy routes |
| `svc-monitor` | 200 (cyan) | Monitoring |

### Animations

<!-- VERIFIED: repos/conduit/ui/src/theme.css:80-129 -->

| Name | Duration | Use Case |
|---|---|---|
| `fade-in` | 0.15s | View entrance |
| `slide-up` | 0.2s | Content reveal |
| `slide-in-right` | 0.25s | Toast notifications |
| `pulse-slow` | 2s (infinite) | Loading state indicators |
| `ping` | 1s (infinite) | Status beacon |

## Views

### Dashboard

Global health overview. Displays:

- 4 stat cards: Services Up, Certs Valid, DNS Entries, Servers Online
- Services health grid (up to 6 service cards with name, domain, response time)
- Recent audit entries with success/failure dots
- Quick actions grid (4 navigation cards)

When all counts are zero, the [blank slate](#blank-slate-experience) replaces the normal dashboard.

**API endpoints:** `GET /api/services`, `GET /api/tls`, `GET /api/dns`, `GET /api/servers`, `GET /api/audit?limit=5`

### Services

Service registry CRUD. Each service card shows name, domain, upstream, health path, TLS badge, response time, and last check timestamp.

- Register via slide-over form (name, host, port, health path, TLS toggle)
- Health check individual services
- Deregister with confirmation dialog
- Refresh data

**API endpoints:** `GET /api/services`, `POST /api/services`, `DELETE /api/services/{name}`, `GET /api/services/{name}/health`

### DNS

DNS entry management. Displays all entries in a table with domain, IP, source badge (conduit/static/system), and creation time.

- Stats row: Total, Conduit, Static, System counts
- Resolve tester (domain input, resolve button, result display)
- Flush DNS cache

**API endpoints:** `GET /api/dns`, `POST /api/dns/resolve`, `POST /api/dns/flush`

### TLS

Certificate management. Title: "TLS Certificates".

- Stats row: Valid, Expiring Soon, Expired, Total
- Internal CA info box (issuer, validity, algorithm, fingerprint)
- Certificate cards with status badge, domain, algorithm, fingerprint
- Inspect slide-over panel with full certificate details and PEM export
- Rotate certificates
- Trust CA in system store

**API endpoints:** `GET /api/tls`, `POST /api/tls/{name}/rotate`, `GET /api/tls/{name}/inspect`, `POST /api/tls/trust`

### Servers

Hardware monitoring with expandable server cards.

- Collapsed: name, host, quick stats (CPU%, Mem%, Disk%, GPU count)
- Expanded: resource cards (CPU, Memory, Disk, Uptime), GPU cards (temp, utilization, VRAM, power), container rows (name, image, state, CPU%, memory)

**API endpoints:** `GET /api/servers`, `GET /api/servers/containers`

### Routing

Caddy reverse proxy routes. Each card shows domain, upstream, TLS badge, response time, last check.

- Stats row: Routes, Up, Degraded, Down
- Reload Caddy configuration

**API endpoints:** `GET /api/routing`, `POST /api/routing/reload`

## Shared Components

<!-- VERIFIED: repos/conduit/ui/src/components/shared/ -->

| Component | File | Purpose |
|---|---|---|
| `EmptyState` | `empty-state.tsx` | Loading spinner, error with retry, empty with icon/title/action |
| `ViewBlankSlate` | `view-blank-slate.tsx` | Rich empty state with icon, features, CLI command, action |
| `HealthDot` | `health-dot.tsx` | Color-coded status indicator (up/degraded/down/checking) |
| `CopyButton` | `copy-button.tsx` | Click-to-copy with success feedback |
| `SlideOver` | `slide-over.tsx` | Right-side panel with Escape close and backdrop |
| `Toast` | `toast.tsx` | Auto-dismiss notifications (success/error) |
| `Chip` | `chip.tsx` | Toggle filter button |
| `StatCard` | `stat-card.tsx` | Stats card with trend indicators |

## State Management

The app uses a single Zustand store (`ui/src/stores/app-store.ts`) for global state:

<!-- VERIFIED: repos/conduit/ui/src/stores/app-store.ts:18-30 -->

| State | Type | Description |
|---|---|---|
| `view` | `View` | Current active view, synced with URL |
| `filters.search` | `string` | Search text filter |
| `filters.status` | `Set<StatusFilter>` | Active status filters (up, degraded, down) |
| `filters.serviceType` | `string` | Service type filter |
| `slideOver` | `string/null` | ID of open slide-over panel |
| `sidebarCollapsed` | `boolean` | Sidebar collapsed state |

The store initializes `view` from the URL path and pushes history entries on navigation, enabling browser back/forward and deep linking.

## Keyboard Shortcuts

<!-- VERIFIED: repos/conduit/ui/src/hooks/use-keyboard.ts:4-11 -->

| Key | Action |
|---|---|
| `1` | Switch to Dashboard view |
| `2` | Switch to Services view |
| `3` | Switch to DNS view |
| `4` | Switch to TLS view |
| `5` | Switch to Servers view |
| `6` | Switch to Routing view |
| `/` | Focus search input |
| `Escape` | Close slide-over panel |

## Testing

<!-- VERIFIED: repos/conduit/ui/vitest.config.ts:1-14 -->

The dashboard has a comprehensive test suite using Vitest, React Testing Library, and happy-dom.

```bash
# Run all tests
make test-ui

# Run with coverage
docker run --rm -v "$(pwd)/ui:/ui" -w /ui node:24-alpine \
  sh -c "npm ci && npx vitest run --coverage"
```

| Metric | Coverage |
|---|---|
| Test files | 17 |
| Tests | 225 |
| Statements | 97.3% |
| Branches | 90.7% |
| Functions | 94.8% |
| Lines | 97.2% |

Test files are colocated with source:

```
src/
  api/client.test.ts           HTTP client (get, post, put, del, ApiError)
  api/tls.test.ts              TLS API paths
  lib/format.test.ts           timeSince, formatBytes, formatDuration, esc, formatLogTime
  stores/app-store.test.ts     URL routing, filters, sidebar, slideOver
  components/shared/
    copy-button.test.tsx       Clipboard, feedback, propagation
    empty-state.test.tsx       Loading, empty, error states
    health-dot.test.tsx        All status variants + sizes
    slide-over.test.tsx        Open/close, Escape, backdrop, footer
    toast.test.tsx             Auto-dismiss, error style, multiple
    view-blank-slate.test.tsx  Rendering, navigation, callbacks
  components/views/
    dashboard/
      blank-slate.test.tsx     Topology, cards, keyboard, expand/collapse
      dashboard-view.test.tsx  Blank slate, populated, stat cards, navigation
    dns/dns-view.test.tsx      Entries, resolve, flush, stats
    routing/routing-view.test.tsx  Routes, stats, reload
    servers/servers-view.test.tsx   Expand, GPU, containers, refresh
    services/services-view.test.tsx Register form, health, deregister
    tls/tls-view.test.tsx      Certs, inspect, rotate, trust CA, CA info
```

## Configuration

### Docker Build

<!-- VERIFIED: repos/conduit/Dockerfile:1-33 -->

The Dockerfile uses a two-stage build:

1. **Stage 1** (node:24-alpine): `npm ci`, `npm run build`, outputs `ui/dist/`
2. **Stage 2** (python:3.14-slim): installs Python deps, copies built UI, runs uvicorn

### Docker UI Development

<!-- VERIFIED: repos/conduit/Makefile:131-136 -->

For UI development with hot reload via Docker (no local Node required):

```bash
make ui
```

This runs Vite inside a Node 24 container with the `ui/` directory mounted, serving on port 5173.

### API Proxy

In development mode, Vite proxies `/api/*` requests to the FastAPI server. Configure the proxy target in `ui/vite.config.ts`:

<!-- VERIFIED: repos/conduit/ui/vite.config.ts:17-21 -->

```typescript
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:9999',
      changeOrigin: true,
    }
  }
}
```

In production, the FastAPI server serves the built UI from `ui/dist/` directly.

## Building for Production

```bash
# Full Docker build (UI + API)
make dev

# Or build and start in background
make go
```

The build produces a single container image at `qp-conduit-app` exposing port 9999.

## Extending the Dashboard

### Adding a New View

<!-- VERIFIED: repos/conduit/ui/src/app.tsx:7-27 -->

1. Create the view component at `ui/src/components/views/<name>/<name>-view.tsx`
2. Export a default function component
3. Add the view name to the `View` type in `ui/src/stores/app-store.ts`
4. Add the URL path mapping in `PATH_TO_VIEW` and `VIEW_TO_PATH`
5. Add a lazy import and entry to the `views` object in `ui/src/app.tsx`
6. Add a sidebar navigation item in `ui/src/components/layout/sidebar.tsx`
7. Add a keyboard shortcut number in `ui/src/hooks/use-keyboard.ts`
8. Write tests in `ui/src/components/views/<name>/<name>-view.test.tsx`

### Adding a New API Module

1. Create `ui/src/api/<name>.ts` with typed fetch functions using the client
2. Add TypeScript interfaces to `ui/src/lib/types.ts`
3. Use TanStack Query hooks in your view component for data fetching
4. Add corresponding backend endpoints in `server.py`

---

## Related Documentation

- [API Reference](./api.md): Backend endpoints consumed by the dashboard
- [Developer Guide](./development.md): Development workflow and testing
- [Guide](./guide.md): Getting started walkthrough
