import { get } from "./client";
import type { AuditEntry } from "@/lib/types";

export const auditApi = {
  read: (limit: number = 20) =>
    get<{ entries: AuditEntry[] }>(`/audit?limit=${limit}`),
};
