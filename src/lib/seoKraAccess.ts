import { useAuth } from "@/components/auth/AuthProvider";
import { useUserRole } from "@/hooks/useUserRole";

export const SEO_KRA_REVIEWERS: { email: string; name: string }[] = [
  { email: "mayur@peppercontent.io", name: "Mayur" },
  { email: "vedanga@peppercontent.io", name: "Vedanga" },
];

const REVIEWER_EMAIL_SET = new Set(SEO_KRA_REVIEWERS.map(r => r.email.toLowerCase()));

export function isSeoKraReviewerEmail(email: string | null | undefined) {
  return !!email && REVIEWER_EMAIL_SET.has(email.toLowerCase());
}

export function useCanAccessSeoKras() {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, isActuallyAdmin, loading: roleLoading } = useUserRole();
  const email = user?.email ?? null;
  return {
    loading: authLoading || roleLoading,
    allowed: isAdmin || isActuallyAdmin || isSeoKraReviewerEmail(email),
    email,
  };
}