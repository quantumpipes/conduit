import { get } from "./client";
import type { ConduitStatus } from "@/lib/types";

export const statusApi = {
  get: () => get<ConduitStatus>("/status"),
  ping: () => get<{ ok: boolean; error?: string }>("/ping"),
};
