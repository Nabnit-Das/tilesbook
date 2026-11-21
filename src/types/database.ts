/** RPC payloads shared by the hosted and embedded PostgreSQL transports. */
export type Json =
  string | number | boolean | null | Json[] | { [key: string]: Json };
export interface Row {
  id: string;
  businessId: string;
  createdAt: string;
  updatedAt: string;
  [key: string]: Json;
}
export type Role = "Owner" | "Manager" | "Counter" | "Godown" | "Accountant";
export interface Business {
  id: string;
  name: string;
  [key: string]: Json;
}
export interface Snapshot {
  entitlements: {
    plan: "trial" | "pro" | "basic";
    premium: boolean;
    trialEnds: string;
  };
  business: Business;
  businesses: { id: string; name: string; role: Role }[];
  role: Role;
  userId: string;
  records: Record<string, Row[]>;
}
export interface MutationResult {
  row: Row;
}
