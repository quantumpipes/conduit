---
title: "QP Conduit Admin Dashboard"
description: "Documentation for the Conduit admin dashboard: React 19 SPA with six views for managing services, DNS, TLS, servers, and routing."
date_modified: "2026-04-04"
ai_context: |
  Admin dashboard docs for QP Conduit. React 19, TypeScript, Vite 6,
  TailwindCSS 4, Zustand, TanStack Query. OKLCH dark theme with 6 surface
  levels. Six views: Dashboard, Services, DNS, TLS, Servers, Routing.
  Served from server.py SPA fallback at port 9999.
related:
  - ./API.md
  - ./DEVELOPMENT.md
  - ./GUIDE.md
---

# Admin Dashboard

The Conduit admin dashboard is a single-page application that provides a visual interface for managing services, DNS, TLS certificates, server monitoring, and routing. It consumes the [REST API](./API.md) served by `server.py`.

## Overview

```
┌──────────────────────────────────────────────────────────────────┐
│  QP CONDUIT                                        [ search ]   │
├──────────┬───────────────────────────────────────────────────────┤
│          │                                                       │
│ Dashboard│   ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│ Services │   │ DNS: OK  │ │ Caddy:OK │ │ Svcs: 4  │            │
│ DNS      │   └──────────┘ └──────────┘ └──────────┘            │
│ TLS      │                                                       │
│ Servers  │   ┌──────────────────────────────────────────┐       │
│ Routing  │   │ SERVICE TABLE                            │       │
│          │   │ name  host       port  health  tls  dns  │       │
│          │   │ core  127.0.0.1  8000  up      ok   ok   │       │
│          │   │ hub   127.0.0.1  8090  up      ok   ok   │       │
│          │   │ ollama 10.0.1.20 11434 down    ok   ok   │       │
│          │   └──────────────────────────────────────────┘       │
│          │                                                       │
│          │   ┌──────────────────────────────────────────┐       │
│          │   │ RECENT AUDIT ENTRIES                     │       │
│          │   │ 12:00  service_register  core    success │       │
│          │   │ 11:55  dns_flush                success │       │
│          │   └──────────────────────────────────────────┘       │
└──────────┴───────────────────────────────────────────────────────┘
```

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | React | 19 |
| Language | TypeScript | strict mode |
| Build tool | Vite | 6 |
| Styling | TailwindCSS | 4 |
| State management | Zustand | 5 |
| Data fetching | TanStack Query | 5 |
| Code splitting | React.lazy + Suspense | |

## Design System

The dashboard uses an OKLCH color palette for perceptually uniform rendering. All colors are semantic tokens defined in `ui/src/theme.css`.

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

## Views

### Dashboard

Global health overview. Displays:

- DNS status (dnsmasq running or not)
- Caddy status (admin API reachable or not)
- Service counts by health status (up, degraded, down)
- Certificate counts by validity (valid, expiring, expired)
- Server status (online count)
- Recent audit entries

**API endpoints:** `GET /api/status`, `GET /api/audit?limit=10`

### Services

List of all registered services with health status, upstream address, port, protocol, and timestamps. Supports:

- Search filtering by name
- Status filtering (up, degraded, down)
- Service registration (POST to API)
- Service deregistration (DELETE from API)
- Slide-over panel for service details

**API endpoints:** `GET /api/services`, `POST /api/services`, `DELETE /api/services/{name}`, `GET /api/services/{name}/health`

### DNS

DNS entry management. Displays all entries from the Conduit hosts file with hostname-to-IP mappings.

- List all DNS entries
- Resolve a specific domain
- Flush the DNS cache

**API endpoints:** `GET /api/dns`, `POST /api/dns/resolve`, `POST /api/dns/flush`

### TLS

Certificate management. Displays all active certificates with expiry dates, domains, and algorithms.

- List certificates with expiry status
- Rotate a certificate (revoke + reissue)
- Inspect certificate details
- Install the CA in the system trust store

**API endpoints:** `GET /api/tls`, `POST /api/tls/{name}/rotate`, `GET /api/tls/{name}/inspect`, `POST /api/tls/trust`

### Servers

Hardware monitoring. Displays CPU, memory, disk usage, GPU statistics, and Docker container status.

- System metrics (CPU cores, load average, memory, disk)
- GPU metrics (temperature, VRAM, utilization)
- Docker container stats (CPU%, memory, network I/O)

**API endpoints:** `GET /api/servers`, `GET /api/servers/containers`

### Routing

Proxy route management. Displays all Caddy reverse proxy routes with upstream addresses, TLS status, and health.

- List all active routes
- Reload Caddy configuration

**API endpoints:** `GET /api/routing`, `POST /api/routing/reload`

## State Management

The app uses a single Zustand store (`ui/src/stores/app-store.ts`) for global state:

| State | Type | Description |
|---|---|---|
| `view` | `View` | Current active view (dashboard, services, dns, tls, servers, routing) |
| `filters.search` | `string` | Search text filter |
| `filters.status` | `Set<StatusFilter>` | Active status filters (up, degraded, down) |
| `filters.serviceType` | `string` | Service type filter |
| `slideOver` | `string/null` | ID of open slide-over panel |
| `sidebarCollapsed` | `boolean` | Sidebar collapsed state |

## Keyboard Shortcuts

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
| `[` | Toggle sidebar |

## Configuration

### API Proxy

In development mode, Vite proxies `/api/*` requests to the FastAPI server. Configure the proxy target in `ui/vite.config.ts`:

```typescript
server: {
  proxy: {
    '/api': 'http://localhost:9999'
  }
}
```

In production, the FastAPI server serves the built UI from `ui/dist/` directly.

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `VITE_API_BASE` | `/api` | Base path for API requests |

## Building for Production

```bash
# Install dependencies
make ui-install

# Build (outputs to ui/dist/)
make ui-build

# Type-check
make ui-typecheck
```

The Dockerfile handles this automatically in the multi-stage build. The Node 22 Alpine stage builds the UI, and the output is copied into the Python runtime stage.

## Extending the Dashboard

### Adding a New View

1. Create the view component at `ui/src/components/views/<name>/<name>-view.tsx`
2. Export a default function component
3. Add the view name to the `View` type in `ui/src/stores/app-store.ts`
4. Add a lazy import and entry to the `views` object in `ui/src/app.tsx`:
   ```typescript
   const NewView = lazy(() => import("@/components/views/<name>/<name>-view"));
   // Add to views object:
   <name>: NewView,
   ```
5. Add a sidebar navigation item in the app shell component
6. Add a keyboard shortcut number

### Adding a New API Module

1. Create `ui/src/lib/api/<name>.ts` with fetch functions
2. Add TypeScript interfaces to `ui/src/lib/types.ts`
3. Use TanStack Query hooks in your view component for data fetching
4. Add corresponding backend endpoints in `server.py`

---

## Related Documentation

- [API Reference](./API.md): Backend endpoints consumed by the dashboard
- [Developer Guide](./DEVELOPMENT.md): Development workflow and testing
- [Guide](./GUIDE.md): Getting started walkthrough
