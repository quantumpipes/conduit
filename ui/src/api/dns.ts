import { get, post } from "./client";
import type { DnsEntry } from "@/lib/types";

export const dnsApi = {
  list: () => get<{ entries: DnsEntry[] }>("/dns"),
  resolve: (domain: string) =>
    get<{ domain: string; ip: string; source: string }>(
      `/dns/resolve?domain=${encodeURIComponent(domain)}`,
    ),
  flush: () => post<{ ok: boolean; message: string }>("/dns/flush"),
};
