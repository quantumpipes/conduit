import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, ClipboardList, RefreshCw, Trash2 } from "lucide-react";
import { servicesApi } from "@/api/services";
import { HealthDot } from "@/components/shared/health-dot";
import { SlideOver } from "@/components/shared/slide-over";
import { EmptyState } from "@/components/shared/empty-state";
import { useToast } from "@/components/shared/toast";
import { timeSince } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { Service } from "@/lib/types";

export default function ServicesView() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [formOpen, setFormOpen] = useState(false);

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ["services"],
    queryFn: servicesApi.list,
    refetchInterval: 15_000,
  });

  const services = data?.services ?? [];

  const registerMut = useMutation({
    mutationFn: (svc: {
      name: string;
      host: string;
      port: number;
      health_path: string;
      tls_enabled: boolean;
    }) => servicesApi.register(svc),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["services"] });
      setFormOpen(false);
      toast("Service registered");
    },
    onError: (e: Error) => toast(e.message, "error"),
  });

  const deregisterMut = useMutation({
    mutationFn: (name: string) => servicesApi.deregister(name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["services"] });
      toast("Service deregistered");
    },
    onError: (e: Error) => toast(e.message, "error"),
  });

  const healthCheckMut = useMutation({
    mutationFn: (name: string) => servicesApi.healthCheck(name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["services"] });
    },
    onError: (e: Error) => toast(e.message, "error"),
  });

  function handleDeregister(svc: Service) {
    if (confirm(`Deregister service "${svc.name}"? This marks it inactive.`)) {
      deregisterMut.mutate(svc.name);
    }
  }

  function handleRegister(formData: FormData) {
    const name = (formData.get("name") as string)?.trim() ?? "";
    const host = (formData.get("host") as string)?.trim() ?? "";
    const port = parseInt((formData.get("port") as string) ?? "0", 10);
    const health_path = (formData.get("health_path") as string)?.trim() || "/healthz";
    const tls_enabled = formData.get("tls_enabled") === "on";

    if (!name || !host || !port) {
      toast("Name, host, and port are required", "error");
      return;
    }

    registerMut.mutate({ name, host, port, health_path, tls_enabled });
  }

  return (
    <div className="h-full overflow-y-auto bg-surface-0 p-6">
      <div className="mx-auto max-w-5xl animate-fade-in">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="mb-1 text-xl font-bold">Services</h1>
            <p className="text-sm text-text-3">
              {services.length} service{services.length !== 1 ? "s" : ""} registered
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => void refetch()}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-text-3 transition-colors hover:bg-surface-2"
            >
              <RefreshCw size={14} /> Refresh
            </button>
            <button
              onClick={() => setFormOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90"
            >
              <Plus size={16} /> Register Service
            </button>
          </div>
        </div>

        {/* Loading */}
        {isPending && <EmptyState loading title="Loading services..." className="py-16" />}

        {/* Error */}
        {isError && !isPending && (
          <EmptyState
            title="Could not load services"
            description={error instanceof Error ? error.message : "Request failed"}
            action={
              <button
                onClick={() => void refetch()}
                className="rounded-md border border-border bg-surface-2 px-3 py-1.5 text-xs font-medium text-text-2 hover:bg-surface-3"
              >
                Retry
              </button>
            }
            className="py-16"
          />
        )}

        {/* Empty */}
        {!isPending && !isError && services.length === 0 && (
          <EmptyState
            icon={<ClipboardList size={40} />}
            title="No services registered"
            description="Register your first service to start routing traffic through Conduit."
            action={
              <button
                onClick={() => setFormOpen(true)}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
              >
                Register your first service
              </button>
            }
            className="py-16"
          />
        )}

        {/* Service cards */}
        {!isPending && !isError && services.length > 0 && (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {services.map((svc) => (
              <div
                key={svc.name}
                className="group rounded-xl border border-border bg-surface-1 p-4 transition-colors hover:border-surface-4"
              >
                {/* Name + status */}
                <div className="mb-3 flex items-center gap-2.5">
                  <HealthDot status={svc.health_status} size="sm" />
                  <h3 className="truncate text-[15px] font-semibold text-text-1">
                    {svc.name}
                  </h3>
                  <span
                    className={cn(
                      "ml-auto shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase",
                      svc.tls_enabled
                        ? "border-success/30 bg-success/8 text-success"
                        : "border-border bg-surface-2 text-text-muted",
                    )}
                  >
                    {svc.tls_enabled ? "TLS" : "Plain"}
                  </span>
                </div>

                {/* Details */}
                <div className="mb-3 space-y-1.5 text-xs text-text-3">
                  <p>
                    <span className="text-text-muted">Domain: </span>
                    <span className="font-mono">{svc.name}.internal</span>
                  </p>
                  <p>
                    <span className="text-text-muted">Upstream: </span>
                    <span className="font-mono">
                      {svc.host}:{svc.port}
                    </span>
                  </p>
                  <p>
                    <span className="text-text-muted">Health: </span>
                    <span className="font-mono">{svc.health_path}</span>
                  </p>
                  {svc.response_time != null && (
                    <p>
                      <span className="text-text-muted">Response: </span>
                      <span className="font-mono">{svc.response_time}ms</span>
                    </p>
                  )}
                  {svc.last_health_check && (
                    <p>
                      <span className="text-text-muted">Last check: </span>
                      {timeSince(svc.last_health_check)}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 border-t border-border pt-3">
                  <button
                    onClick={() => healthCheckMut.mutate(svc.name)}
                    className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-medium text-text-3 transition-colors hover:bg-surface-2"
                  >
                    <RefreshCw size={11} /> Check
                  </button>
                  <button
                    onClick={() => handleDeregister(svc)}
                    className="ml-auto flex items-center gap-1 rounded-md border border-error/30 px-2 py-1 text-[11px] font-medium text-error transition-colors hover:bg-error/10"
                  >
                    <Trash2 size={11} /> Deregister
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Register form */}
      <SlideOver
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title="Register Service"
        footer={
          <>
            <button
              onClick={() => setFormOpen(false)}
              className="rounded-lg bg-surface-2 px-4 py-2 text-sm font-medium text-text-2 transition-colors hover:bg-surface-3"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                const form = document.getElementById("register-form") as HTMLFormElement;
                if (!form) return;
                handleRegister(new FormData(form));
              }}
              disabled={registerMut.isPending}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {registerMut.isPending ? "Registering..." : "Register"}
            </button>
          </>
        }
      >
        <form id="register-form" className="space-y-4">
          <Field label="Service Name" name="name" placeholder="e.g. qp-core" mono />
          <Field label="Host" name="host" placeholder="e.g. 10.0.1.50" mono />
          <Field label="Port" name="port" placeholder="e.g. 8000" mono type="number" />
          <Field label="Health Path" name="health_path" placeholder="/healthz" mono />
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              name="tls_enabled"
              id="tls_enabled"
              defaultChecked
              className="h-4 w-4 rounded border-border accent-primary"
            />
            <label htmlFor="tls_enabled" className="text-sm font-medium text-text-2">
              Enable TLS
            </label>
          </div>
        </form>
      </SlideOver>
    </div>
  );
}

function Field({
  label,
  name,
  placeholder,
  mono,
  type = "text",
}: {
  label: string;
  name: string;
  placeholder: string;
  mono?: boolean;
  type?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-text-2">{label}</label>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        className={cn(
          "w-full rounded-lg border border-border bg-surface-0 px-3 py-2 text-sm text-text-1 placeholder:text-text-muted focus:border-primary focus:outline-none",
          mono && "font-mono",
        )}
      />
    </div>
  );
}
