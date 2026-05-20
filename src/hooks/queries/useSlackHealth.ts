import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type SlackHealthRow = {
  channelId: string;
  channelName: string;
  dealId: string;
  dealCode: string;
  dealName: string;
  score: number;
  staffMatch: string;
  daily: string;
  weeklyInt: string;
  weeklyCust: string;
};

function clamp(n: number, max: number) {
  return Math.min(Math.max(n, 0), max);
}

async function fetchSlackHealth(): Promise<SlackHealthRow[]> {
  const sinceIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: deals, error: dealsErr } = await supabase
    .from("staffing_deals")
    .select("id, deal_id, deal_name, slack_channel_id")
    .not("slack_channel_id", "is", null)
    .neq("slack_channel_id", "");
  if (dealsErr) throw dealsErr;
  if (!deals?.length) return [];

  const dealIds = deals.map((d) => d.id);

  const [assignRes, msgRes, peopleRes, channelsRes] = await Promise.all([
    supabase
      .from("staffing_assignments")
      .select("deal_id, person_id")
      .in("deal_id", dealIds),
    supabase
      .from("slack_messages")
      .select("deal_id, user_id, created_at")
      .in("deal_id", dealIds)
      .gte("created_at", sinceIso),
    supabase
      .from("staffing_people")
      .select("id, slack_user_id"),
    supabase.functions.invoke("slack-list-channels").catch(() => ({ data: null, error: null })),
  ]);
  if (assignRes.error) throw assignRes.error;
  if (msgRes.error) throw msgRes.error;
  if (peopleRes.error) throw peopleRes.error;

  const channelNameById = new Map<string, string>();
  const channelList = (channelsRes as any)?.data?.channels as Array<{ id: string; name: string }> | undefined;
  if (Array.isArray(channelList)) {
    for (const c of channelList) channelNameById.set(c.id, c.name);
  }

  const personBySlack = new Map<string, string>();
  const slackIdByPerson = new Map<string, string>();
  for (const p of peopleRes.data ?? []) {
    if (p.slack_user_id) {
      personBySlack.set(p.slack_user_id, p.id);
      slackIdByPerson.set(p.id, p.slack_user_id);
    }
  }

  const assignByDeal = new Map<string, Set<string>>();
  for (const a of assignRes.data ?? []) {
    if (!assignByDeal.has(a.deal_id)) assignByDeal.set(a.deal_id, new Set());
    assignByDeal.get(a.deal_id)!.add(a.person_id);
  }

  const msgsByDeal = new Map<string, typeof msgRes.data>();
  for (const m of msgRes.data ?? []) {
    if (!m.deal_id) continue;
    if (!msgsByDeal.has(m.deal_id)) msgsByDeal.set(m.deal_id, []);
    msgsByDeal.get(m.deal_id)!.push(m);
  }

  return deals.map((d) => {
    const msgs = msgsByDeal.get(d.id) ?? [];
    const assignees = assignByDeal.get(d.id) ?? new Set<string>();
    const expected = Math.max(assignees.size, 1);

    const senders = new Set<string>();
    let internalCount = 0;
    let customerCount = 0;
    const days = new Set<string>();

    for (const m of msgs) {
      const slackUid = m.user_id || "";
      senders.add(slackUid);
      const personId = personBySlack.get(slackUid);
      if (personId) internalCount++;
      else customerCount++;
      days.add(new Date(m.created_at).toISOString().slice(0, 10));
    }

    let matched = 0;
    for (const personId of assignees) {
      const slackUid = slackIdByPerson.get(personId);
      if (slackUid && senders.has(slackUid)) matched++;
    }

    const dailyCount = clamp(days.size, 5);
    const wkInt = clamp(internalCount, 4);
    const wkCust = clamp(customerCount, 4);
    const staffMatchRatio = matched / expected;

    const score = Math.round(
      staffMatchRatio * 25 + dailyCount * 10 + wkInt * 5 + wkCust * 5,
    );

    return {
      channelId: d.slack_channel_id!,
      channelName: `#${channelNameById.get(d.slack_channel_id!) ?? d.slack_channel_id}`,
      dealId: d.id,
      dealCode: d.deal_id || d.id,
      dealName: d.deal_name,
      score: Math.min(score, 100),
      staffMatch: `${matched}/${assignees.size}`,
      daily: `${dailyCount}/5`,
      weeklyInt: `${wkInt}/4`,
      weeklyCust: `${wkCust}/4`,
    };
  });
}

export function useSlackHealth() {
  return useQuery({
    queryKey: ["slack-health"],
    queryFn: fetchSlackHealth,
    staleTime: 60_000,
  });
}