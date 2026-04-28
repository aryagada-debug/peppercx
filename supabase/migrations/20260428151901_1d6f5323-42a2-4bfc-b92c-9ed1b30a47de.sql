-- Approval requests pipeline
CREATE TABLE public.approval_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_type text NOT NULL CHECK (request_type IN (
    'staffing.add','staffing.update','staffing.remove',
    'client.create','deal.create'
  )),
  target_kind text NOT NULL DEFAULT '',
  target_id text NOT NULL DEFAULT '',
  deal_id text NOT NULL DEFAULT '',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  previous jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','under_review','approved','rejected','cancelled')),
  requested_by uuid NOT NULL,
  requested_by_name text NOT NULL DEFAULT '',
  requester_note text NOT NULL DEFAULT '',
  reviewer_id uuid,
  reviewer_name text NOT NULL DEFAULT '',
  reviewer_note text NOT NULL DEFAULT '',
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_approval_requests_status ON public.approval_requests(status);
CREATE INDEX idx_approval_requests_deal ON public.approval_requests(deal_id);
CREATE INDEX idx_approval_requests_requester ON public.approval_requests(requested_by);

-- Only one OPEN (pending or under_review) request per deal at a time
CREATE UNIQUE INDEX uniq_open_request_per_deal
  ON public.approval_requests(deal_id)
  WHERE status IN ('pending','under_review') AND deal_id <> '';

ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Requesters or admins can view"
  ON public.approval_requests FOR SELECT
  TO authenticated
  USING (
    auth.uid() = requested_by
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'member'::app_role)
  );

CREATE POLICY "Authenticated insert own request"
  ON public.approval_requests FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = requested_by);

CREATE POLICY "Requester cancel or admin update"
  ON public.approval_requests FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = requested_by
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'member'::app_role)
  );

CREATE POLICY "Admins delete approval_requests"
  ON public.approval_requests FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER set_approval_requests_updated_at
  BEFORE UPDATE ON public.approval_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Comments thread
CREATE TABLE public.approval_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.approval_requests(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  author_name text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_approval_comments_req ON public.approval_comments(request_id);

ALTER TABLE public.approval_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View comments if can view request"
  ON public.approval_comments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.approval_requests r
      WHERE r.id = request_id AND (
        r.requested_by = auth.uid()
        OR has_role(auth.uid(), 'admin'::app_role)
        OR has_role(auth.uid(), 'member'::app_role)
      )
    )
  );

CREATE POLICY "Authenticated insert own comments"
  ON public.approval_comments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = author_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.approval_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.approval_comments;