-- Trigger export, schema: public
-- Source: live production Supabase project, read-only query of pg_trigger, 2026-10-24
-- REFERENCE ONLY, not a migration. The functions these call are in functions.sql.
-- Not captured here: the trigger on auth.users that calls public.handle_new_user() (auth schema),
-- and the event trigger that calls public.rls_auto_enable(). Export those separately.

CREATE TRIGGER trg_annotations_updated_at BEFORE UPDATE ON public.annotations FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_lock_submitted_annotations BEFORE DELETE OR UPDATE ON public.annotations FOR EACH ROW EXECUTE FUNCTION lock_submitted_annotations();

CREATE TRIGGER trg_auto_decline_other_assignments AFTER INSERT ON public.document_acceptances FOR EACH ROW EXECUTE FUNCTION auto_decline_other_assignments();

CREATE TRIGGER trg_lock_submitted_scores BEFORE DELETE OR UPDATE ON public.review_scores FOR EACH ROW EXECUTE FUNCTION lock_submitted_review_scores();

CREATE TRIGGER trg_review_scores_updated_at BEFORE UPDATE ON public.review_scores FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_set_review_score_document_id BEFORE INSERT ON public.review_scores FOR EACH ROW EXECUTE FUNCTION set_review_score_document_id();

CREATE TRIGGER trg_touch_review_last_saved AFTER INSERT OR UPDATE ON public.review_scores FOR EACH ROW EXECUTE FUNCTION touch_review_last_saved();

CREATE TRIGGER trg_enforce_all_criteria_scored BEFORE UPDATE ON public.reviews FOR EACH ROW EXECUTE FUNCTION enforce_all_criteria_scored();

CREATE TRIGGER trg_reviews_submitted_at BEFORE UPDATE ON public.reviews FOR EACH ROW EXECUTE FUNCTION set_submitted_at();

CREATE TRIGGER trg_reviews_updated_at BEFORE UPDATE ON public.reviews FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_guard_preset_rubrics BEFORE UPDATE ON public.rubrics FOR EACH ROW EXECUTE FUNCTION guard_preset_rubrics();
