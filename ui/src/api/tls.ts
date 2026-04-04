import { get, post } from "./client";
import type { TlsCert } from "@/lib/types";

export const tlsApi = {
  list: () => get<{ certs: TlsCert[] }>("/tls/certs"),
  rotate: (name: string) =>
    post<{ ok: boolean; cert: TlsCert }>(`/tls/certs/${name}/rotate`),
  inspect: (name: string) => get<TlsCert>(`/tls/certs/${name}`),
  trust: () => post<{ ok: boolean; message: string }>("/tls/trust"),
};
