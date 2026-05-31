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

interface GeoState {
  geo: GeoKey;
  setGeo: (g: GeoKey) => void;
  /** Bucketise a free-form `geo` cell into a canonical key. */
  bucket: (raw: string | undefined | null) => Exclude<GeoKey, "all">;
  /** True when a deal's geo passes the active filter. */
  matches: (raw: string | undefined | null) => boolean;
}

const GeoFilterContext = createContext<GeoState | null>(null);

function bucketGeo(raw: string | undefined | null): Exclude<GeoKey, "all"> {
  const v = (raw || "").trim().toLowerCase();
  if (!v) return "Other";
  if (/(^|\b)(us|usa|u\.s\.?|united states|america|north america)\b/.test(v)) return "US";
  if (/(^|\b)(india|in|ind|bharat|apac)\b/.test(v)) return "India";
  return "Other";
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

  const value = useMemo<GeoState>(
    () => ({ geo, setGeo, bucket: bucketGeo, matches }),
    [geo, setGeo, matches],
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
      matches: () => true,
    };
  }
  return ctx;
}

export { bucketGeo };