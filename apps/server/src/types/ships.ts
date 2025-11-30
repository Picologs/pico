/**
 * Ship-related types for mock data generation
 */

export interface ShipData {
  manufacturer: string;
  name: string;
  displayName: string;
  role:
    | "fighter"
    | "starter"
    | "multi-role"
    | "gunship"
    | "corvette"
    | "luxury"
    | "exploration"
    | "mining"
    | "salvage"
    | "construction"
    | "cargo"
    | "support"
    | "transport"
    | "ground";
}
