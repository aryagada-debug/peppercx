import type { Person } from "@/data/staffingData";

/**
 * Revenue Capacity (Target MRR / Target Deal Value) per person.
 *
 * Single source of truth — replaces the legacy
 * (department, designation) → targetDealValuePerPerson table.
 *
 * Rule:
 *   Senior BOPM / SEO Growth Lead / Content Lead
 *     US    → ₹60,00,000
 *     India → ₹30,00,000
 *   Group BOPM
 *     India → ₹40,00,000
 *   VSD (region R)                      = (# Senior BOPM in R)        × base(Senior BOPM, R)
 *   Content Capability Leader (R)       = (# Content Lead in R)       × base(Content Lead, R)
 *   SEO Capability Leader (R)           = (# SEO Growth Lead in R)    × base(SEO Growth Lead, R)
 *   Everyone else → 0
 */

export type CapacityRegion = "US" | "India";

const BASE_BY_ROLE_REGION: Record<string, Record<CapacityRegion, number>> = {
  "Senior BOPM":     { US: 60_00_000, India: 30_00_000 },
  "SEO Growth Lead": { US: 60_00_000, India: 30_00_000 },
  "Content Lead":    { US: 60_00_000, India: 30_00_000 },
  "Group BOPM":      { US: 0,         India: 40_00_000 },
};

const LEADER_TO_BASE_ROLE: Record<string, string> = {
  "VSD": "Senior BOPM",
  "Content Capability Leader": "Content Lead",
  "SEO Capability Leader": "SEO Growth Lead",
};

export function normalizeCapacityRegion(region: string | undefined | null): CapacityRegion | null {
  const r = (region || "").trim().toLowerCase();
  if (["us", "u.s.", "u.s", "usa", "united states"].includes(r)) return "US";
  if (["in", "india"].includes(r)) return "India";
  return null;
}

function isActive(p: Person): boolean {
  return !p.leaving && !p.tbh;
}

/**
 * Returns the revenue capacity (target deal value, in INR) for a person.
 * `allPeople` is required to compute VSD / Capability Leader sums across the region.
 */
export function getPersonRevenueCapacity(person: Person, allPeople: Person[]): number {
  const region = normalizeCapacityRegion(person.region);
  if (!region) return 0;
  const designation = (person.designation || "").trim();

  // Direct base roles
  if (BASE_BY_ROLE_REGION[designation]) {
    return BASE_BY_ROLE_REGION[designation][region];
  }

  // Aggregated leader roles
  const baseRole = LEADER_TO_BASE_ROLE[designation];
  if (baseRole) {
    const base = BASE_BY_ROLE_REGION[baseRole][region];
    const count = allPeople.filter(
      (p) =>
        isActive(p) &&
        (p.designation || "").trim() === baseRole &&
        normalizeCapacityRegion(p.region) === region,
    ).length;
    return base * count;
  }

  return 0;
}