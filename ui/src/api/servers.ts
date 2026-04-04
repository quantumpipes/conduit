import { get } from "./client";
import type { ServerStats, GpuInfo, ContainerInfo } from "@/lib/types";

export const serversApi = {
  list: () => get<{ servers: ServerStats[] }>("/servers"),
  status: (id: string) => get<ServerStats>(`/servers/${id}`),
  gpu: (id: string) => get<{ gpus: GpuInfo[] }>(`/servers/${id}/gpu`),
  containers: (id: string) =>
    get<{ containers: ContainerInfo[] }>(`/servers/${id}/containers`),
};
