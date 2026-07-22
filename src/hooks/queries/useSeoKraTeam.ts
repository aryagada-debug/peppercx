import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { scorecardByKey } from "@/components/seo-kras/scorecards";

export interface SeoKraMember {
  person_id: string;
  name: string;
  email: string | null;
  role_category: string | null;
  role_title: string | null;
  designation: string | null;
  user_id: string | null;
}

export function useSeoKraTeam(scorecardKey: string) {
  const scorecard = scorecardByKey(scorecardKey);
  return useQuery({
    queryKey: ["seo-kra-team", scorecardKey],
    queryFn: async (): Promise<SeoKraMember[]> => {
      const { data: people } = await supabase
        .from("staffing_people")
        .select("id, name, email, role_category, role_title, designation, leaving, tbh")
        .eq("leaving", false)
        .eq("tbh", false);
      const filtered = (people || []).filter((p: any) => {
        const hay = `${p.role_category || ""} ${p.role_title || ""} ${p.designation || ""}`;
        return scorecard.roleCategoryMatch.test(hay);
      });
      const ids = filtered.map((p: any) => p.id);
      const { data: profs } = ids.length
        ? await supabase.from("profiles").select("user_id, staffing_person_id").in("staffing_person_id", ids)
        : { data: [] as any[] };
      const userByPerson = new Map<string, string>();
      (profs || []).forEach((p: any) => { if (p.staffing_person_id) userByPerson.set(p.staffing_person_id, p.user_id); });
      return filtered
        .map((p: any) => ({
          person_id: p.id,
          name: p.name || p.email || p.id,
          email: p.email,
          role_category: p.role_category,
          role_title: p.role_title,
          designation: p.designation,
          user_id: userByPerson.get(p.id) ?? null,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
    },
    staleTime: 5 * 60 * 1000,
  });
}