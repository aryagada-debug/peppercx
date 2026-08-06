CREATE OR REPLACE FUNCTION public.mcp_list_tables()
RETURNS TABLE(table_name text, column_name text, data_type text, is_nullable boolean, ordinal_position integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    c.table_name::text,
    c.column_name::text,
    c.data_type::text,
    (c.is_nullable = 'YES') AS is_nullable,
    c.ordinal_position::integer
  FROM information_schema.columns c
  JOIN information_schema.tables t
    ON t.table_schema = c.table_schema AND t.table_name = c.table_name
  WHERE c.table_schema = 'public'
    AND t.table_type = 'BASE TABLE'
  ORDER BY c.table_name, c.ordinal_position
$$;

REVOKE ALL ON FUNCTION public.mcp_list_tables() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mcp_list_tables() TO authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_list_tables() TO service_role;