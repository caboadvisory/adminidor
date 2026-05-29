-- Adminidor — document kind
-- Distinguishes generated/approved reports from general uploads.

create type public.document_kind as enum ('general', 'report');

alter table public.documents
  add column kind public.document_kind not null default 'general';
