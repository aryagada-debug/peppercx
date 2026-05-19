/**
 * VSD-filtered slice of `useAppUsersQuery`. Mirrors `useVsdUsers`.
 */
import { useCallback, useMemo } from "react";
import { useAppUsersQuery, nameKey, type AppUser } from "./useAppUsersQuery";

export const VSD_NAMES = [
  "Neema Jayadas",
  "Aditya Shaw",
  "Aamir Khan",
  "Sumit Shekhawat",
  "Sneha Iyer",
] as const;

const VSD_KEYS = new Set(VSD_NAMES.map((n) => nameKey(n)));
const VSD_PARTIALS = VSD_NAMES.map((n) => nameKey(n).split(" "));

function matchesVsd(name: string | null | undefined): string | null {
  const k = nameKey(name || "");
  if (!k) return null;
  if (VSD_KEYS.has(k)) return VSD_NAMES.find((n) => nameKey(n) === k) || null;
  const tokens = k.split(" ");
  for (let i = 0; i < VSD_PARTIALS.length; i++) {
    const canon = VSD_PARTIALS[i];
    const allIn = tokens.every((t) => canon.includes(t));
    const firstMatch = tokens.length === 1 && canon[0] === tokens[0];
    if (allIn || firstMatch) return VSD_NAMES[i];
  }
  return null;
}

export function useVsdUsersQuery() {
  const { users, loading } = useAppUsersQuery();
  const vsdUsers = useMemo<AppUser[]>(
    () =>
      VSD_NAMES.map((canonical) => {
        const found = users.find((u) => matchesVsd(u.displayName) === canonical);
        return (
          found || {
            userId: `vsd:${nameKey(canonical)}`,
            displayName: canonical,
            email: "",
            role: "user",
            staffingPersonId: null,
            source: "directory",
          }
        );
      }),
    [users],
  );

  const isVsdName = useCallback(
    (name: string | null | undefined) => matchesVsd(name) !== null,
    [],
  );
  const canonVsd = useCallback(
    (name: string | null | undefined) => matchesVsd(name),
    [],
  );

  return { vsdUsers, isVsdName, canonVsd, loading };
}