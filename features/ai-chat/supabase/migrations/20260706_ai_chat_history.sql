-- AI chat history: sessions + messages.
--
-- Sessions are scoped by document_id (present for both reviewer and author
-- pages) rather than review_id alone — the author's feedback view aggregates
-- across potentially multiple reviews for a document, so there is no single
-- review row to attach an author-side chat session to. review_id is kept as
-- a nullable FK, populated only for reviewer-role sessions where a single
-- active review exists (see loadReviewerData in
-- features/ai-chat/shortcuts/reviewDataLoader.ts).
--
-- This repo has no existing supabase/migrations directory (schema changes
-- appear to be applied directly via the Supabase dashboard/SQL editor), so
-- run this file manually against the project's SQL editor, then regenerate
-- types/database.types.ts.

create table if not exists ai_chat_sessions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  review_id uuid references reviews(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('reviewer', 'author')),
  rubric_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_chat_sessions_document_user_idx
  on ai_chat_sessions (document_id, user_id, updated_at desc);

create table if not exists ai_chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references ai_chat_sessions(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  shortcut_type text,
  created_at timestamptz not null default now()
);

create index if not exists ai_chat_messages_session_idx
  on ai_chat_messages (session_id, created_at asc);

alter table ai_chat_sessions enable row level security;
alter table ai_chat_messages enable row level security;

create policy "Users can manage their own chat sessions"
  on ai_chat_sessions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can manage messages in their own sessions"
  on ai_chat_messages for all
  using (exists (
    select 1 from ai_chat_sessions s
    where s.id = ai_chat_messages.session_id and s.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from ai_chat_sessions s
    where s.id = ai_chat_messages.session_id and s.user_id = auth.uid()
  ));
