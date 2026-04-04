import { get, post } from "./client";
import type { Route } from "@/lib/types";

export const routingApi = {
  list: () => get<{ routes: Route[] }>("/routing"),
  health: () =>
    get<Record<string, { status: string; response_time: number | null }>>(
      "/routing/health",
    ),
  reload: () => post<{ ok: boolean; message: string }>("/routing/reload"),
};
