import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type GeoKey = "all" | "US" | "India" | "Other";

const LS_KEY = "vsdos.geoFilter";

/** Minimal deal shape needed for geo bucketing. */
export interface GeoDealShape {
  geo?: string | null;
  vsd?: string | null;
  principalBopm?: string | null;
  seniorBopm?: string | null;
  bopm?: string | null;
}

interface GeoState {
  geo: GeoKey;
  setGeo: (g: GeoKey) => void;
  /** Bucketise a free-form `geo` cell into a canonical key. */
  bucket: (raw: string | undefined | null) => Exclude<GeoKey, "all">;
  /** Bucketise a deal, applying VSD-based overrides (e.g. Neema → US). */
  bucketDeal: (deal: GeoDealShape | null | undefined) => Exclude<GeoKey, "all">;
  /** True when a deal's geo passes the active filter. */
  matches: (raw: string | undefined | null) => boolean;
  /** True when a deal (with VSD overrides) passes the active filter. */
  matchesDeal: (deal: GeoDealShape | null | undefined) => boolean;
}

const GeoFilterContext = createContext<GeoState | null>(null);

function bucketGeo(raw: string | undefined | null): Exclude<GeoKey, "all"> {
  const v = (raw || "").trim().toLowerCase();
  if (!v) return "Other";
  if (/(^|\b)(us|usa|u\.s\.?|united states|america|north america)\b/.test(v)) return "US";
  if (/(^|\b)(india|in|ind|bharat|apac)\b/.test(v)) return "India";
  return "Other";
}

/**
 * Business rule: every deal where "Neema" appears in the VSD / BOPM
 * fields is treated as a US deal by default, regardless of the raw
 * `geo` cell on the deal record.
 */
function hasNeemaOwner(deal: GeoDealShape | null | undefined): boolean {
  if (!deal) return false;
  const blob = [deal.vsd, deal.principalBopm, deal.seniorBopm, deal.bopm]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return /\bneema\b/.test(blob);
}

function bucketDealGeo(deal: GeoDealShape | null | undefined): Exclude<GeoKey, "all"> {
  if (hasNeemaOwner(deal)) return "US";
  return bucketGeo(deal?.geo);
}

export function GeoFilterProvider({ children }: { children: ReactNode }) {
  const [geo, setGeoState] = useState<GeoKey>(() => {
    if (typeof localStorage === "undefined") return "all";
    const v = localStorage.getItem(LS_KEY);
    if (v === "US" || v === "India" || v === "Other" || v === "all") return v;
    return "all";
  });

  const setGeo = useCallback((g: GeoKey) => {
    setGeoState(g);
    try { localStorage.setItem(LS_KEY, g); } catch {}
  }, []);

  const matches = useCallback(
    (raw: string | undefined | null) => {
      if (geo === "all") return true;
      return bucketGeo(raw) === geo;
    },
    [geo],
  );

  const matchesDeal = useCallback(
    (deal: GeoDealShape | null | undefined) => {
      if (geo === "all") return true;
      return bucketDealGeo(deal) === geo;
    },
    [geo],
  );

  const value = useMemo<GeoState>(
    () => ({ geo, setGeo, bucket: bucketGeo, bucketDeal: bucketDealGeo, matches, matchesDeal }),
    [geo, setGeo, matches, matchesDeal],
  );

  return <GeoFilterContext.Provider value={value}>{children}</GeoFilterContext.Provider>;
}

export function useGeoFilter(): GeoState {
  const ctx = useContext(GeoFilterContext);
  if (!ctx) {
    // Safe fallback so tests / out-of-tree mounts don't crash.
    return {
      geo: "all",
      setGeo: () => {},
      bucket: bucketGeo,
      bucketDeal: bucketDealGeo,
      matches: () => true,
      matchesDeal: () => true,
    };
  }
  return ctx;
}

export { bucketGeo, bucketDealGeo };