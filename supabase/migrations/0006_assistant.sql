-- Adminidor — Assistant chat history
-- Persisted AI conversations. Unlike firm data (staff read all), chat history
-- is PRIVATE to the user who created it — owner-only RLS, admins included.

create type public.assistant_role as enum ('user', 'assistant');

create table public.assistant_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index assistant_conversations_user_id_idx
  on public.assistant_conversations (user_id, updated_at desc);

create trigger assistant_conversations_set_updated_at
  before update on public.assistant_conversations
  for each row execute function public.set_updated_at();

create table public.assistant_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null
    references public.assistant_conversations(id) on delete cascade,
  role public.assistant_role not null,
  content text not null,
  created_at timestamptz not null default now()
);

create index assistant_messages_conversation_id_idx
  on public.assistant_messages (conversation_id, created_at);

-- ---------------------------------------------------------------------------
-- RLS: owner-only. A user can only see and write their own conversations and
-- the messages within them.
-- ---------------------------------------------------------------------------
alter table public.assistant_conversations enable row level security;
alter table public.assistant_messages enable row level security;

create policy assistant_conversations_select on public.assistant_conversations
  for select to authenticated using (user_id = auth.uid());
create policy assistant_conversations_insert on public.assistant_conversations
  for insert to authenticated with check (user_id = auth.uid());
create policy assistant_conversations_update on public.assistant_conversations
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy assistant_conversations_delete on public.assistant_conversations
  for delete to authenticated using (user_id = auth.uid());

create policy assistant_messages_select on public.assistant_messages
  for select to authenticated using (
    conversation_id in (
      select id from public.assistant_conversations where user_id = auth.uid()
    )
  );
create policy assistant_messages_insert on public.assistant_messages
  for insert to authenticated with check (
    conversation_id in (
      select id from public.assistant_conversations where user_id = auth.uid()
    )
  );
create policy assistant_messages_delete on public.assistant_messages
  for delete to authenticated using (
    conversation_id in (
      select id from public.assistant_conversations where user_id = auth.uid()
    )
  );
