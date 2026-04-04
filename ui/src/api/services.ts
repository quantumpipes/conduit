import { get, post, del } from "./client";
import type { Service } from "@/lib/types";

export const servicesApi = {
  list: () => get<{ services: Service[] }>("/services"),
  register: (data: Partial<Service>) =>
    post<{ ok: boolean; service: Service }>("/services", data),
  deregister: (name: string) => del<{ ok: boolean }>(`/services/${name}`),
  health: (name: string) =>
    get<{ ok: boolean; status: string; response_time: number | null }>(
      `/services/${name}/health`,
    ),
};
