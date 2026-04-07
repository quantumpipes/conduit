import { useState } from "react";
import {
  Layers,
  Globe,
  ShieldCheck,
  Server,
  ArrowLeftRight,
  Network,
  ChevronRight,
  Terminal,
  Zap,
  Lock,
  Eye,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { useAppStore, type View } from "@/stores/app-store";

/* ─── Capability Card Data ───────────────────────────────────────────────── */

interface Capability {
  id: View;
  icon: typeof Layers;
  label: string;
  tagline: string;
  description: string;
  command: string;
  color: string;
  glowColor: string;
  bgColor: string;
  step: number;
}

const capabilities: Capability[] = [
  {
    id: "services",
    icon: Layers,
    label: "Services",
    tagline: "Register and monitor",
    description:
      "Register backend services with health checks, auto-discovery, and real-time status. Conduit watches them so you don't have to.",
    command: "make conduit-register NAME=grafana HOST=10.0.1.50:3000",
    color: "text-tab-services-text",
    glowColor: "shadow-[0_0_24px_oklch(0.55_0.14_230/0.3)]",
    bgColor: "bg-tab-services",
    step: 1,
  },
  {
    id: "dns",
    icon: Globe,
    label: "DNS",
    tagline: "Name everything",
    description:
      "Automatic .internal DNS for every registered service. No more IP addresses. grafana.internal just works.",
    command: "make conduit-dns-resolve DOMAIN=grafana.internal",
    color: "text-tab-dns-text",
    glowColor: "shadow-[0_0_24px_oklch(0.55_0.14_260/0.3)]",
    bgColor: "bg-tab-dns",
    step: 2,
  },
  {
    id: "tls",
    icon: ShieldCheck,
    label: "TLS",
    tagline: "Encrypt everything",
    description:
      "Internal CA issues and rotates certificates automatically. mTLS between services with zero manual configuration.",
    command: "make conduit-certs",
    color: "text-tab-tls-text",
    glowColor: "shadow-[0_0_24px_oklch(0.55_0.14_150/0.3)]",
    bgColor: "bg-tab-tls",
    step: 3,
  },
  {
    id: "servers",
    icon: Server,
    label: "Servers",
    tagline: "See everything",
    description:
      "CPU, memory, disk, GPU utilization, and container health across your fleet. One pane of glass for your entire infrastructure.",
    command: "make conduit-monitor",
    color: "text-tab-servers-text",
    glowColor: "shadow-[0_0_24px_oklch(0.55_0.14_25/0.3)]",
    bgColor: "bg-tab-servers",
    step: 4,
  },
  {
    id: "routing",
    icon: ArrowLeftRight,
    label: "Routing",
    tagline: "Connect everything",
    description:
      "Caddy reverse proxy manages all traffic. TLS termination, load balancing, and health-aware routing out of the box.",
    command: "make conduit-status",
    color: "text-tab-routing-text",
    glowColor: "shadow-[0_0_24px_oklch(0.55_0.14_45/0.3)]",
    bgColor: "bg-tab-routing",
    step: 5,
  },
];

/* ─── Topology Visualization ─────────────────────────────────────────────── */

function TopologyMap({ onNodeClick }: { onNodeClick: (view: View) => void }) {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  const nodes = [
    { id: "services", cx: 140, cy: 80, icon: Layers, label: "Services", color: "tab-services-text" },
    { id: "dns", cx: 400, cy: 50, icon: Globe, label: "DNS", color: "tab-dns-text" },
    { id: "tls", cx: 560, cy: 140, icon: ShieldCheck, label: "TLS", color: "tab-tls-text" },
    { id: "servers", cx: 160, cy: 240, icon: Server, label: "Servers", color: "tab-servers-text" },
    { id: "routing", cx: 420, cy: 260, icon: ArrowLeftRight, label: "Routing", color: "tab-routing-text" },
  ];

  const center = { cx: 340, cy: 155 };

  const edges = nodes.map((n) => ({
    from: center,
    to: n,
    id: n.id,
  }));

  return (
    <div className="relative mx-auto w-full max-w-[700px]">
      <svg
        viewBox="0 0 700 310"
        className="w-full"
        style={{ filter: "drop-shadow(0 0 40px oklch(0.55 0.14 230 / 0.08))" }}
      >
        {/* Connection lines */}
        {edges.map((edge) => (
          <g key={edge.id}>
            <line
              x1={center.cx}
              y1={center.cy}
              x2={edge.to.cx}
              y2={edge.to.cy}
              stroke="oklch(0.3 0.04 230)"
              strokeWidth="1"
              strokeDasharray="4 4"
              className={cn(
                "transition-all duration-300",
                hoveredNode === edge.id && "!stroke-[oklch(0.5_0.1_230)]",
              )}
            />
            {/* Animated data packet */}
            <circle r="2" fill="oklch(0.7 0.15 230)" opacity="0.6">
              <animateMotion
                dur={`${2.5 + Math.random()}s`}
                repeatCount="indefinite"
                path={`M${center.cx},${center.cy} L${edge.to.cx},${edge.to.cy}`}
              />
            </circle>
            <circle r="2" fill="oklch(0.7 0.15 230)" opacity="0.4">
              <animateMotion
                dur={`${3 + Math.random()}s`}
                repeatCount="indefinite"
                begin={`${1 + Math.random()}s`}
                path={`M${edge.to.cx},${edge.to.cy} L${center.cx},${center.cy}`}
              />
            </circle>
          </g>
        ))}

        {/* Center node (Conduit) */}
        <g>
          <circle
            cx={center.cx}
            cy={center.cy}
            r="32"
            fill="oklch(0.12 0.04 230)"
            stroke="oklch(0.55 0.14 230)"
            strokeWidth="1.5"
            className="animate-pulse-slow"
          />
          <circle
            cx={center.cx}
            cy={center.cy}
            r="40"
            fill="none"
            stroke="oklch(0.55 0.14 230)"
            strokeWidth="0.5"
            opacity="0.3"
            className="animate-pulse-slow"
            style={{ animationDelay: "0.5s" }}
          />
          {/* Network icon placeholder (SVG native) */}
          <g transform={`translate(${center.cx - 10}, ${center.cy - 10})`}>
            <path
              d="M10 2a2 2 0 100 4 2 2 0 000-4zM2 10a2 2 0 100 4 2 2 0 000-4zM18 10a2 2 0 100 4 2 2 0 000-4zM10 14a2 2 0 100 4 2 2 0 000-4zM10 6v8M4.5 11.5L8 14M15.5 11.5L12 14"
              stroke="oklch(0.8 0.12 230)"
              strokeWidth="1.5"
              fill="none"
              strokeLinecap="round"
            />
          </g>
        </g>

        {/* Satellite nodes */}
        {nodes.map((node) => {
          const isHovered = hoveredNode === node.id;
          return (
            <g
              key={node.id}
              className="cursor-pointer"
              onMouseEnter={() => setHoveredNode(node.id)}
              onMouseLeave={() => setHoveredNode(null)}
              onClick={() => onNodeClick(node.id as View)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onNodeClick(node.id as View);
                }
              }}
            >
              {/* Hover glow */}
              <circle
                cx={node.cx}
                cy={node.cy}
                r="28"
                fill="none"
                stroke={`var(--color-${node.color})`}
                strokeWidth={isHovered ? "1.5" : "0"}
                opacity={isHovered ? "0.4" : "0"}
                className="transition-all duration-200"
              />
              {/* Node circle */}
              <circle
                cx={node.cx}
                cy={node.cy}
                r="22"
                fill={isHovered ? "oklch(0.16 0.05 230)" : "oklch(0.12 0.03 230)"}
                stroke="oklch(0.25 0.04 230)"
                strokeWidth="1"
                className="transition-all duration-200"
              />
              {/* Waiting pulse */}
              <circle
                cx={node.cx}
                cy={node.cy}
                r="3"
                fill={`var(--color-${node.color})`}
                opacity="0.5"
                className="animate-pulse-slow"
                style={{ animationDelay: `${Math.random() * 2}s` }}
              />
              {/* Label */}
              <text
                x={node.cx}
                y={node.cy + 36}
                textAnchor="middle"
                fill={isHovered ? `var(--color-${node.color})` : "oklch(0.5 0.02 200)"}
                fontSize="11"
                fontWeight="500"
                fontFamily="var(--font-family-sans)"
                className="transition-all duration-200"
              >
                {node.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ─── Capability Card ────────────────────────────────────────────────────── */

function CapabilityCard({
  cap,
  isExpanded,
  onToggle,
  onNavigate,
}: {
  cap: Capability;
  isExpanded: boolean;
  onToggle: () => void;
  onNavigate: () => void;
}) {
  const Icon = cap.icon;

  return (
    <div
      className={cn(
        "group relative rounded-xl border transition-all duration-200",
        isExpanded
          ? `border-surface-4 bg-surface-1 ${cap.glowColor}`
          : "border-border bg-surface-1 hover:border-surface-4",
      )}
    >
      {/* Header (always visible) */}
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
      >
        <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", cap.bgColor)}>
          <Icon size={18} className={cap.color} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-text-1">{cap.label}</span>
            <span className="rounded-full bg-surface-3 px-2 py-0.5 text-[10px] font-mono text-text-muted">
              Step {cap.step}
            </span>
          </div>
          <p className="text-xs text-text-3">{cap.tagline}</p>
        </div>
        <ChevronRight
          size={14}
          className={cn(
            "shrink-0 text-text-muted transition-transform duration-200",
            isExpanded && "rotate-90",
          )}
        />
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="animate-fade-in border-t border-border px-4 pb-4 pt-3">
          <p className="mb-3 text-[13px] leading-relaxed text-text-2">
            {cap.description}
          </p>

          {/* Command preview */}
          <div className="mb-3 flex items-center gap-2 rounded-lg bg-surface-0 px-3 py-2">
            <Terminal size={12} className="shrink-0 text-text-muted" />
            <code className="flex-1 truncate font-mono text-xs text-text-3">
              {cap.command}
            </code>
          </div>

          <button
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-all",
              cap.bgColor,
              cap.color,
              "hover:brightness-125",
            )}
          >
            Open {cap.label}
            <ArrowRight size={12} />
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── Principles Strip ───────────────────────────────────────────────────── */

function PrinciplesStrip() {
  const principles = [
    { icon: Lock, label: "Zero Trust", desc: "mTLS between all services" },
    { icon: Zap, label: "Air-Gapped", desc: "No external dependencies" },
    { icon: Eye, label: "Observable", desc: "Full audit trail" },
  ];

  return (
    <div className="flex items-center justify-center gap-6">
      {principles.map((p) => (
        <div key={p.label} className="flex items-center gap-2 text-[11px] text-text-muted">
          <p.icon size={12} className="text-text-3" />
          <span className="font-medium text-text-3">{p.label}</span>
          <span className="hidden sm:inline">{p.desc}</span>
        </div>
      ))}
    </div>
  );
}

/* ─── Main Blank Slate ───────────────────────────────────────────────────── */

export function BlankSlate() {
  const setView = useAppStore((s) => s.setView);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);

  return (
    <div className="h-full overflow-y-auto bg-surface-0">
      <div className="mx-auto max-w-3xl px-6 py-8">
        {/* Hero */}
        <div className="mb-2 animate-fade-in text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-surface-1 px-3 py-1.5 text-[11px] text-text-muted">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-40" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
            </span>
            Conduit is running
          </div>

          <h1 className="mb-2 text-2xl font-bold text-text-1">
            Your infrastructure, connected.
          </h1>
          <p className="mx-auto max-w-lg text-sm leading-relaxed text-text-3">
            Conduit is the on-premises mesh that binds your services together with
            automatic DNS, TLS certificates, health monitoring, and traffic routing.
            No cloud. No agents. No dependencies.
          </p>
        </div>

        {/* Topology visualization */}
        <div className="animate-slide-up mb-2">
          <TopologyMap onNodeClick={(view) => setView(view)} />
        </div>

        {/* Principles */}
        <div className="mb-8 animate-fade-in">
          <PrinciplesStrip />
        </div>

        {/* Getting started */}
        <div className="mb-4 animate-slide-up">
          <div className="mb-4 flex items-center gap-2">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs font-semibold uppercase tracking-widest text-text-muted">
              Get Started
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <div className="space-y-2">
            {capabilities.map((cap) => (
              <CapabilityCard
                key={cap.id}
                cap={cap}
                isExpanded={expandedCard === cap.id}
                onToggle={() =>
                  setExpandedCard(expandedCard === cap.id ? null : cap.id)
                }
                onNavigate={() => setView(cap.id)}
              />
            ))}
          </div>
        </div>

        {/* First step prompt */}
        <div className="animate-fade-in rounded-xl border border-primary/20 bg-primary/5 p-4 text-center">
          <p className="mb-2 text-sm font-medium text-text-2">
            Ready? Register your first service.
          </p>
          <div className="mb-3 inline-flex items-center gap-2 rounded-lg bg-surface-0 px-3 py-2">
            <Terminal size={12} className="text-text-muted" />
            <code className="font-mono text-xs text-primary">
              make conduit-register NAME=myapp HOST=10.0.1.10:8080
            </code>
          </div>
          <div>
            <button
              onClick={() => setView("services")}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-all hover:brightness-110"
            >
              <Layers size={14} />
              Register a Service
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 flex items-center justify-center gap-1.5 pb-4 text-[11px] text-text-muted">
          <Network size={12} />
          <span>QP Conduit</span>
          <span className="text-border">·</span>
          <span>On-premises infrastructure mesh</span>
        </div>
      </div>
    </div>
  );
}
