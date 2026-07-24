-- 0001_init.sql
-- LedgerLock initial schema: documents, document_chunks, queries
-- pgvector, RLS policies, and the RPC used for authorization-scoped similarity search.

create extension if not exists vector;

-- ---------------------------------------------------------------------------
-- documents
-- ---------------------------------------------------------------------------
create table documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  file_name text not null,
  storage_path text not null,
  page_count integer,
  status text not null default 'processing' check (status in ('processing','ready','failed')),
  failure_reason text,
  created_at timestamptz not null default now()
);
create index documents_user_id_idx on documents(user_id);

-- ---------------------------------------------------------------------------
-- document_chunks
-- ---------------------------------------------------------------------------
create table document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  page_number integer not null,
  chunk_index integer not null,
  content text not null,
  token_count integer,
  embedding vector(1536), -- gemini-embedding-001, output_dimensionality: 1536, L2-normalized in app code
  created_at timestamptz not null default now()
);
create index document_chunks_document_id_idx on document_chunks(document_id);
create index document_chunks_embedding_idx
  on document_chunks using hnsw (embedding vector_cosine_ops);

-- ---------------------------------------------------------------------------
-- queries
-- ---------------------------------------------------------------------------
create table queries (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  question text not null,
  status text not null check (status in
    ('answered','refused_out_of_scope','refused_advice_request','insufficient_context','error')),
  answer text,
  citations jsonb not null default '[]',
  confidence text,
  latency_ms integer,
  created_at timestamptz not null default now()
);
create index queries_user_id_idx on queries(user_id);
create index queries_document_id_idx on queries(document_id);
create index queries_status_idx on queries(status);
create index queries_created_at_idx on queries(created_at desc);

-- ---------------------------------------------------------------------------
-- Row-Level Security: the database-layer half of authorization
-- ---------------------------------------------------------------------------
alter table documents enable row level security;
alter table document_chunks enable row level security;
alter table queries enable row level security;

create policy "own documents only" on documents for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "own chunks only" on document_chunks for all
  using (exists (
    select 1 from documents
    where documents.id = document_chunks.document_id
    and documents.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from documents
    where documents.id = document_chunks.document_id
    and documents.user_id = auth.uid()
  ));

create policy "own queries only" on queries for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Vector similarity search, authorization-scoped in the query itself
-- (PostgREST can't run vector operators, so this has to be an RPC function)
-- ---------------------------------------------------------------------------
create or replace function match_document_chunks (
  p_document_id uuid,
  p_user_id uuid,
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
returns table (id uuid, page_number int, content text, similarity float)
language plpgsql security definer as $$
begin
  return query
  select dc.id, dc.page_number, dc.content,
         1 - (dc.embedding <=> query_embedding) as similarity
  from document_chunks dc
  join documents d on d.id = dc.document_id
  where dc.document_id = p_document_id
    and d.user_id = p_user_id  -- ownership re-checked even though RLS already covers it
    and 1 - (dc.embedding <=> query_embedding) > match_threshold
  order by dc.embedding <=> query_embedding
  limit match_count;
end;
$$;

-- Storage bucket for private PDF uploads (idempotent)
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

create policy "own storage objects only" on storage.objects for all
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);
