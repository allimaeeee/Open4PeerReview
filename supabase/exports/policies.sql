-- RLS policy export, schemas: public, storage
-- Source: live production Supabase project, read-only query of pg_policies, 2026-10-24
-- REFERENCE ONLY. This is a snapshot for version control, not a migration. Do not apply
-- it to a database that already has these policies. Re-export before relying on it.
-- 66 policies. "to public" means the policy applies to every role.

create policy "Users can insert their own chat events" on public.ai_chat_events as permissive for insert to public
  with check ((auth.uid() = user_id));

create policy "Users can manage messages in their own sessions" on public.ai_chat_messages as permissive for all to public
  using ((EXISTS ( SELECT 1
   FROM ai_chat_sessions s
  WHERE ((s.id = ai_chat_messages.session_id) AND (s.user_id = auth.uid())))))
  with check ((EXISTS ( SELECT 1
   FROM ai_chat_sessions s
  WHERE ((s.id = ai_chat_messages.session_id) AND (s.user_id = auth.uid())))));

create policy "Users can manage their own chat sessions" on public.ai_chat_sessions as permissive for all to public
  using ((auth.uid() = user_id))
  with check ((auth.uid() = user_id));

create policy annotations_delete_own on public.annotations as permissive for delete to public
  using ((EXISTS ( SELECT 1
   FROM reviews r
  WHERE ((r.id = annotations.review_id) AND (r.reviewer_id = auth.uid()) AND (r.status = 'in_progress'::review_status)))));

create policy annotations_insert_own on public.annotations as permissive for insert to public
  with check ((EXISTS ( SELECT 1
   FROM reviews r
  WHERE ((r.id = annotations.review_id) AND (r.reviewer_id = auth.uid()) AND (r.status = 'in_progress'::review_status)))));

create policy annotations_select_document_author on public.annotations as permissive for select to public
  using (((EXISTS ( SELECT 1
   FROM (reviews r
     JOIN documents d ON ((d.id = r.document_id)))
  WHERE ((r.id = annotations.review_id) AND (d.author_id = auth.uid()) AND (((annotations.rubric_item_id IS NOT NULL) AND (EXISTS ( SELECT 1
           FROM rubric_items ri
          WHERE ((ri.id = annotations.rubric_item_id) AND rubric_submitted_for_review(r.id, ri.rubric_id))))) OR ((annotations.rubric_item_id IS NULL) AND review_has_submission(r.id)))))) AND review_approved_for_author(review_id)));

create policy annotations_select_org_coordinator on public.annotations as permissive for select to public
  using ((EXISTS ( SELECT 1
   FROM reviews r
  WHERE ((r.id = annotations.review_id) AND is_org_coordinator_for_document(r.document_id) AND review_has_submission(r.id)))));

create policy annotations_select_own on public.annotations as permissive for select to public
  using ((EXISTS ( SELECT 1
   FROM reviews r
  WHERE ((r.id = annotations.review_id) AND (r.reviewer_id = auth.uid())))));

create policy annotations_update_own on public.annotations as permissive for update to public
  using ((EXISTS ( SELECT 1
   FROM reviews r
  WHERE ((r.id = annotations.review_id) AND (r.reviewer_id = auth.uid()) AND (r.status = 'in_progress'::review_status)))))
  with check ((EXISTS ( SELECT 1
   FROM reviews r
  WHERE ((r.id = annotations.review_id) AND (r.reviewer_id = auth.uid()) AND (r.status = 'in_progress'::review_status)))));

create policy afc_author_all on public.author_feedback_comments as permissive for all to public
  using (((author_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM documents d
  WHERE ((d.id = author_feedback_comments.document_id) AND (d.author_id = auth.uid()))))))
  with check (((author_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM documents d
  WHERE ((d.id = author_feedback_comments.document_id) AND (d.author_id = auth.uid()))))));

create policy afr_author_all on public.author_feedback_responses as permissive for all to public
  using (((author_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM documents d
  WHERE ((d.id = author_feedback_responses.document_id) AND (d.author_id = auth.uid()))))))
  with check (((author_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM documents d
  WHERE ((d.id = author_feedback_responses.document_id) AND (d.author_id = auth.uid()))))));

create policy reviewer_own_acceptances on public.document_acceptances as permissive for all to authenticated
  using ((reviewer_id = auth.uid()))
  with check ((reviewer_id = auth.uid()));

create policy coordinators_manage_assignments on public.document_assignments as permissive for all to public
  using ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = auth.uid()) AND (('coordinator'::text = ANY (u.roles)) OR (u.role = 'admin'::user_role))))))
  with check ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = auth.uid()) AND (('coordinator'::text = ANY (u.roles)) OR (u.role = 'admin'::user_role))))));

create policy reviewers_view_own_assignments on public.document_assignments as permissive for select to authenticated
  using ((reviewer_id = auth.uid()));

create policy "document_rubrics: authenticated read" on public.document_rubrics as permissive for select to public
  using ((auth.role() = 'authenticated'::text));

create policy "document_rubrics: author delete" on public.document_rubrics as permissive for delete to public
  using ((EXISTS ( SELECT 1
   FROM documents
  WHERE ((documents.id = document_rubrics.document_id) AND (documents.author_id = auth.uid())))));

create policy "document_rubrics: author insert" on public.document_rubrics as permissive for insert to public
  with check ((EXISTS ( SELECT 1
   FROM documents
  WHERE ((documents.id = document_rubrics.document_id) AND (documents.author_id = auth.uid())))));

create policy "documents: authenticated read" on public.documents as permissive for select to public
  using ((auth.role() = 'authenticated'::text));

create policy "documents: author delete" on public.documents as permissive for delete to public
  using ((author_id = auth.uid()));

create policy "documents: author insert" on public.documents as permissive for insert to public
  with check ((author_id = auth.uid()));

create policy "documents: author select own" on public.documents as permissive for select to public
  using ((author_id = auth.uid()));

create policy "documents: author update" on public.documents as permissive for update to public
  using ((author_id = auth.uid()))
  with check ((author_id = auth.uid()));

create policy "institutions: insert authenticated" on public.institutions as permissive for insert to authenticated
  with check (true);

create policy "institutions: read all" on public.institutions as permissive for select to authenticated
  using (true);

create policy reviewer_own_declines on public.review_declines as permissive for all to authenticated
  using ((reviewer_id = auth.uid()))
  with check ((reviewer_id = auth.uid()));

create policy "Reviewers can insert their own events" on public.review_events as permissive for insert to public
  with check ((reviewer_id = auth.uid()));

create policy "Reviewers can view their own events" on public.review_events as permissive for select to public
  using ((reviewer_id = auth.uid()));

create policy review_rubric_submissions_insert_own on public.review_rubric_submissions as permissive for insert to authenticated
  with check ((EXISTS ( SELECT 1
   FROM reviews r
  WHERE ((r.id = review_rubric_submissions.review_id) AND (r.reviewer_id = auth.uid())))));

create policy review_rubric_submissions_select_document_author on public.review_rubric_submissions as permissive for select to public
  using ((EXISTS ( SELECT 1
   FROM (reviews r
     JOIN documents d ON ((d.id = r.document_id)))
  WHERE ((r.id = review_rubric_submissions.review_id) AND (d.author_id = auth.uid())))));

create policy review_rubric_submissions_select_own on public.review_rubric_submissions as permissive for select to authenticated
  using ((EXISTS ( SELECT 1
   FROM reviews r
  WHERE ((r.id = review_rubric_submissions.review_id) AND (r.reviewer_id = auth.uid())))));

create policy rrs_delete_org_coordinator on public.review_rubric_submissions as permissive for delete to public
  using ((EXISTS ( SELECT 1
   FROM reviews r
  WHERE ((r.id = review_rubric_submissions.review_id) AND is_org_coordinator_for_document(r.document_id)))));

create policy rrs_select_org_coordinator on public.review_rubric_submissions as permissive for select to public
  using ((EXISTS ( SELECT 1
   FROM reviews r
  WHERE ((r.id = review_rubric_submissions.review_id) AND is_org_coordinator_for_document(r.document_id)))));

create policy review_scores_delete_own on public.review_scores as permissive for delete to authenticated
  using ((EXISTS ( SELECT 1
   FROM reviews r
  WHERE ((r.id = review_scores.review_id) AND (r.reviewer_id = auth.uid()) AND (r.status = 'in_progress'::review_status)))));

create policy review_scores_insert_own on public.review_scores as permissive for insert to authenticated
  with check ((EXISTS ( SELECT 1
   FROM reviews r
  WHERE ((r.id = review_scores.review_id) AND (r.reviewer_id = auth.uid()) AND (r.status = 'in_progress'::review_status)))));

create policy review_scores_select_document_author on public.review_scores as permissive for select to public
  using (((EXISTS ( SELECT 1
   FROM ((reviews r
     JOIN documents d ON ((d.id = r.document_id)))
     JOIN rubric_items ri ON ((ri.id = review_scores.rubric_item_id)))
  WHERE ((r.id = review_scores.review_id) AND (d.author_id = auth.uid()) AND rubric_submitted_for_review(r.id, ri.rubric_id)))) AND review_approved_for_author(review_id)));

create policy review_scores_select_org_coordinator on public.review_scores as permissive for select to public
  using ((EXISTS ( SELECT 1
   FROM reviews r
  WHERE ((r.id = review_scores.review_id) AND is_org_coordinator_for_document(r.document_id) AND review_has_submission(r.id)))));

create policy review_scores_select_own on public.review_scores as permissive for select to authenticated
  using ((EXISTS ( SELECT 1
   FROM reviews r
  WHERE ((r.id = review_scores.review_id) AND (r.reviewer_id = auth.uid())))));

create policy review_scores_update_own on public.review_scores as permissive for update to authenticated
  using ((EXISTS ( SELECT 1
   FROM reviews r
  WHERE ((r.id = review_scores.review_id) AND (r.reviewer_id = auth.uid()) AND (r.status = 'in_progress'::review_status)))))
  with check ((EXISTS ( SELECT 1
   FROM reviews r
  WHERE ((r.id = review_scores.review_id) AND (r.reviewer_id = auth.uid()) AND (r.status = 'in_progress'::review_status)))));

create policy reviews_insert_own on public.reviews as permissive for insert to authenticated
  with check ((reviewer_id = auth.uid()));

create policy reviews_select_document_author on public.reviews as permissive for select to public
  using (((EXISTS ( SELECT 1
   FROM documents d
  WHERE ((d.id = reviews.document_id) AND (d.author_id = auth.uid())))) AND review_has_submission(id) AND review_approved_for_author(id)));

create policy reviews_select_org_coordinator on public.reviews as permissive for select to public
  using (is_org_coordinator_for_document(document_id));

create policy reviews_select_own on public.reviews as permissive for select to authenticated
  using ((reviewer_id = auth.uid()));

create policy reviews_update_org_coordinator on public.reviews as permissive for update to public
  using (is_org_coordinator_for_document(document_id))
  with check (is_org_coordinator_for_document(document_id));

create policy reviews_update_own on public.reviews as permissive for update to public
  using (((reviewer_id = auth.uid()) AND (status = ANY (ARRAY['assigned'::review_status, 'in_progress'::review_status]))))
  with check ((reviewer_id = auth.uid()));

create policy revision_notes_author_all on public.revision_notes as permissive for all to public
  using (((author_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM documents d
  WHERE ((d.id = revision_notes.document_id) AND (d.author_id = auth.uid()))))))
  with check (((author_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM documents d
  WHERE ((d.id = revision_notes.document_id) AND (d.author_id = auth.uid()))))));

create policy "rubric_items: admin write" on public.rubric_items as permissive for all to public
  using ((current_user_role() = 'admin'::user_role))
  with check ((current_user_role() = 'admin'::user_role));

create policy "rubric_items: authenticated read" on public.rubric_items as permissive for select to public
  using ((auth.role() = 'authenticated'::text));

create policy rubric_items_select on public.rubric_items as permissive for select to authenticated
  using ((EXISTS ( SELECT 1
   FROM rubrics r
  WHERE ((r.id = rubric_items.rubric_id) AND (r.is_preset = true)))));

create policy "rubrics: admin write" on public.rubrics as permissive for all to public
  using ((current_user_role() = 'admin'::user_role))
  with check ((current_user_role() = 'admin'::user_role));

create policy "rubrics: authenticated read" on public.rubrics as permissive for select to public
  using ((auth.role() = 'authenticated'::text));

create policy rubrics_select_preset on public.rubrics as permissive for select to authenticated
  using ((is_preset = true));

create policy reviewer_own_score_comments on public.score_comments as permissive for all to authenticated
  using ((EXISTS ( SELECT 1
   FROM reviews
  WHERE ((reviews.id = score_comments.review_id) AND (reviews.reviewer_id = auth.uid())))))
  with check ((EXISTS ( SELECT 1
   FROM reviews
  WHERE ((reviews.id = score_comments.review_id) AND (reviews.reviewer_id = auth.uid())))));

create policy score_comments_select_org_coordinator on public.score_comments as permissive for select to public
  using ((EXISTS ( SELECT 1
   FROM reviews r
  WHERE ((r.id = score_comments.review_id) AND is_org_coordinator_for_document(r.document_id) AND review_has_submission(r.id)))));

create policy "users: admin select all" on public.users as permissive for select to public
  using ((current_user_role() = 'admin'::user_role));

create policy "users: authenticated read profile" on public.users as permissive for select to public
  using ((auth.role() = 'authenticated'::text));

create policy "users: insert own" on public.users as permissive for insert to public
  with check ((id = auth.uid()));

create policy "users: select own" on public.users as permissive for select to public
  using ((id = auth.uid()));

create policy "users: update own" on public.users as permissive for update to public
  using ((id = auth.uid()))
  with check ((id = auth.uid()));

create policy "Authenticated users can read screenshots 1ym93gt_0" on storage.objects as permissive for select to authenticated
  using ((bucket_id = 'screenshots'::text));

create policy "Authenticated users can read snapshots" on storage.objects as permissive for select to authenticated
  using ((bucket_id = 'openstax-snapshots'::text));

create policy "Authenticated users can upload screenshots 1ym93gt_0" on storage.objects as permissive for insert to authenticated
  with check ((bucket_id = 'screenshots'::text));

create policy "Authenticated users can upload snapshots" on storage.objects as permissive for insert to authenticated
  with check ((bucket_id = 'openstax-snapshots'::text));

create policy "storage: authenticated read" on storage.objects as permissive for select to authenticated
  using ((bucket_id = 'documents'::text));

create policy "storage: authenticated upload" on storage.objects as permissive for insert to authenticated
  with check (((bucket_id = 'documents'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

create policy "storage: owner delete" on storage.objects as permissive for delete to authenticated
  using (((bucket_id = 'documents'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

create policy "storage: owner update" on storage.objects as permissive for update to authenticated
  using (((bucket_id = 'documents'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
