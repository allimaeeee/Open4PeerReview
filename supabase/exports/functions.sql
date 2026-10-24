-- Function export, schema: public (17 functions)
-- Source: live production Supabase project, read-only query via pg_get_functiondef(), 2026-10-24
-- REFERENCE ONLY, not a migration. Line endings normalized to LF.
-- Known advisor findings for these functions (see docs/technical-reqs.md 2.4):
--   * No pinned search_path: touch_review_last_saved, set_review_score_document_id, update_updated_at,
--     set_submitted_at, current_user_role, guard_preset_rubrics, handle_new_user,
--     enforce_all_criteria_scored, lock_submitted_review_scores, lock_submitted_annotations
--   * SECURITY DEFINER and executable by anon/authenticated via /rest/v1/rpc: auto_decline_other_assignments,
--     current_user_role, handle_new_user, is_org_coordinator_for_document, review_approved_for_author,
--     review_has_submission, rls_auto_enable, rubric_submitted_for_review, update_torus_document_pages

CREATE OR REPLACE FUNCTION public.auto_decline_other_assignments()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  WITH declined AS (
    UPDATE document_assignments
    SET declined_at = now(),
        decline_note = 'Automatically declined — another reviewer accepted this document'
    WHERE document_id = NEW.document_id
      AND reviewer_id != NEW.reviewer_id
      AND declined_at IS NULL
    RETURNING reviewer_id
  )
  INSERT INTO review_declines (document_id, reviewer_id, note)
  SELECT NEW.document_id, declined.reviewer_id,
         'Automatically declined — another reviewer accepted this document'
  FROM declined;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.current_user_role()
 RETURNS user_role
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  SELECT role FROM public.users WHERE id = auth.uid();
$function$
;

CREATE OR REPLACE FUNCTION public.enforce_all_criteria_scored()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  total_criteria   INT;
  scored_criteria  INT;
  missing_labels   TEXT;
BEGIN
  -- Only run when transitioning to 'submitted'
  IF NEW.status <> 'submitted' OR OLD.status = 'submitted' THEN
    RETURN NEW;
  END IF;

  -- Count how many criteria this rubric has
  SELECT COUNT(*) INTO total_criteria
  FROM public.rubric_items
  WHERE rubric_id = NEW.rubric_id;

  -- Count how many have been scored in this review
  SELECT COUNT(*) INTO scored_criteria
  FROM public.review_scores
  WHERE review_id = NEW.id;

  IF scored_criteria < total_criteria THEN
    -- Collect the labels of unscored criteria for a helpful error message
    SELECT string_agg(ri.label, ', ' ORDER BY ri.sort_order)
    INTO missing_labels
    FROM public.rubric_items ri
    WHERE ri.rubric_id = NEW.rubric_id
      AND NOT EXISTS (
        SELECT 1 FROM public.review_scores rs
        WHERE rs.review_id = NEW.id
          AND rs.rubric_item_id = ri.id
      );

    RAISE EXCEPTION
      'Cannot submit: % of % criteria are unscored. Missing: %',
      (total_criteria - scored_criteria), total_criteria, missing_labels;
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.guard_preset_rubrics()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF OLD.is_preset = TRUE AND NEW.is_preset = FALSE THEN
    RAISE EXCEPTION 'Cannot remove preset status from a preset rubric.';
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO public.users (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.is_org_coordinator_for_document(p_document_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from documents d
    join users author on author.id = d.author_id
    join users coord  on coord.id  = auth.uid()
    where d.id = p_document_id
      and coord.roles @> array['coordinator']::text[]
      and coord.institution is not null
      and coord.institution = author.institution
  );
$function$
;

CREATE OR REPLACE FUNCTION public.lock_submitted_annotations()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.reviews r
    WHERE r.id = OLD.review_id AND r.status = 'submitted'
  ) THEN
    RAISE EXCEPTION 'Cannot modify annotations on a submitted review.';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.lock_submitted_review_scores()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.reviews
    WHERE id = OLD.review_id AND status = 'submitted'
  ) THEN
    RAISE EXCEPTION 'Cannot modify scores on a submitted review.';
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.review_approved_for_author(p_review_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from reviews r
    join documents d on d.id = r.document_id
    where r.id = p_review_id
      and (
        not (coalesce(d.submission_scope, '{}'::text[]) @> array['organization']::text[])
        or r.coordinator_approval = 'approved'
      )
  );
$function$
;

CREATE OR REPLACE FUNCTION public.review_has_submission(p_review_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.review_rubric_submissions where review_id = p_review_id
  );
$function$
;

CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.rubric_submitted_for_review(p_review_id uuid, p_rubric_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.review_rubric_submissions
    where review_id = p_review_id and rubric_id = p_rubric_id
  );
$function$
;

CREATE OR REPLACE FUNCTION public.set_review_score_document_id()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- Only derive when not explicitly provided; keep any caller-supplied value.
  IF NEW.document_id IS NULL THEN
    SELECT r.document_id INTO NEW.document_id
    FROM public.reviews r
    WHERE r.id = NEW.review_id;
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.set_submitted_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.status = 'submitted' AND OLD.status <> 'submitted' THEN
    NEW.submitted_at = now();
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.touch_review_last_saved()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  UPDATE public.reviews
  SET last_saved_at = now()
  WHERE id = NEW.review_id;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_torus_document_pages(p_document_id uuid, p_storage_path text, p_page_entry jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Verify the caller has an active review for this document
  IF NOT EXISTS (
    SELECT 1 FROM reviews
    WHERE document_id = p_document_id
      AND reviewer_id = auth.uid()
      AND status IN ('assigned', 'in_progress')
  ) THEN
    RAISE EXCEPTION 'Access denied: no active review for this document';
  END IF;

  -- Initialize storage_path if not yet set, then upsert the page entry by URL
  UPDATE documents
  SET
    storage_path = COALESCE(storage_path, p_storage_path),
    pages = (
      -- Remove existing entry for this URL (if any), then append updated entry
      COALESCE(
        (SELECT jsonb_agg(p)
         FROM jsonb_array_elements(COALESCE(pages, '[]'::jsonb)) AS p
         WHERE p->>'url' != (p_page_entry->>'url')),
        '[]'::jsonb
      ) || jsonb_build_array(p_page_entry)
    )
  WHERE id = p_document_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;
