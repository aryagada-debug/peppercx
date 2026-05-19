/**
 * Central registry of all React Query keys.
 *
 * Every `useQuery` / `useMutation` / `invalidateQueries` / `setQueryData`
 * call in the app must reference a key built by one of these factories.
 * No inline arrays anywhere else in the codebase.
 *
 * Why: this is the only way to guarantee that `invalidateQueries` from one
 * mutation actually flushes the cache used by another component's query —
 * any typo or shape mismatch silently no-ops.
 */
export const qk = {
  // staffing tables
  people: () => ["staffing-people"] as const,
  person: (id: string) => ["staffing-people", id] as const,
  deals: () => ["staffing-deals"] as const,
  deal: (id: string) => ["staffing-deals", id] as const,
  dealsUnified: () => ["deals-unified"] as const,
  assignments: () => ["staffing-assignments"] as const,
  assignmentsByDeal: (dealId: string) => ["staffing-assignments", "by-deal", dealId] as const,
  hiringNeeds: () => ["staffing-hiring-needs"] as const,
  revenueTargets: () => ["staffing-revenue-targets"] as const,
  bwRules: () => ["staffing-bw-rules"] as const,

  // clients
  clients: () => ["clients"] as const,

  // user directories (replaces useAppUsers pubsub)
  appUsers: () => ["app-users"] as const,
  vsdHierarchy: () => ["vsd-hierarchy"] as const,
  bopmDirectory: () => ["bopm-directory"] as const,

  // approvals
  approvals: () => ["approval-requests"] as const,
  openApprovalForDeal: (dealId: string) => ["approval-requests", "open", dealId] as const,

  // deal detail slices
  dealDetail: (dealId: string, slice: string) => ["deal-detail", dealId, slice] as const,

  // home dashboard
  homeTasks: (userId: string) => ["home", "tasks", userId] as const,
  homeFlags: (userId: string) => ["home", "flags", userId] as const,
  homeMyDeals: (userId: string) => ["home", "my-deals", userId] as const,
  homeTodos: (userId: string) => ["home", "todos", userId] as const,
  homeNudges: (userId: string) => ["home", "nudges", userId] as const,
  homeNotifications: (userId: string) => ["home", "notifications", userId] as const,
  homeQuota: (userId: string, period: string) => ["home", "quota", userId, period] as const,
  homeRecents: (userId: string) => ["home", "recents", userId] as const,
  homePins: (userId: string) => ["home", "pins", userId] as const,
  homeMentions: (slackUserId: string) => ["home", "mentions", slackUserId] as const,

  // account activity feed
  accountActivity: (aliasKey: string, limit: number, allAccounts: boolean) =>
    ["account-activity", aliasKey, limit, allAccounts] as const,
} as const;