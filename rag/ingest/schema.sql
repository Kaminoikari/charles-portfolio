-- Phase 0 schema for the portfolio RAG chatbot.
-- Run against Supabase (SQL editor or `supabase db push`). Idempotent-ish:
-- safe to re-run; drops+recreates the RPCs.

create extension if not exists vector;

-- ── chunks ───────────────────────────────────────────────────────────────
create table if not exists doc_chunks (
  id          text primary key,
  parent_id   text,
  source_type text not null,        -- project|about|experience|skill|changelog|blog|playbook
  project_id  text,
  locale      text not null,        -- en|zh-TW|ja
  title       text,
  content     text not null,
  embedding   vector(1024),         -- voyage-3-large dense (1024-dim)
  fts         tsvector generated always as (to_tsvector('simple', content)) stored
);

create index if not exists doc_chunks_embedding_idx
  on doc_chunks using hnsw (embedding vector_cosine_ops);
create index if not exists doc_chunks_fts_idx
  on doc_chunks using gin (fts);
create index if not exists doc_chunks_locale_idx
  on doc_chunks (locale);

-- ── chat logs (free product insight: what recruiters actually ask) ─────────
create table if not exists chat_logs (
  id         uuid primary key default gen_random_uuid(),
  ts         timestamptz not null default now(),
  question   text,
  language   text,
  route      text,
  loops      int,
  latency_ms int,
  sources    jsonb
);

-- ── retrieval RPCs (called from rag/retrieval.ts) ─────────────────────────

-- Dense: HNSW cosine similarity, locale-filtered. Returns rank (1-based) so the
-- caller can fuse with RRF without re-sorting.
drop function if exists match_chunks_dense(vector, int, text);
create function match_chunks_dense(
  query_embedding vector(1024),
  match_count int,
  filter_locale text
)
returns table (
  id text, parent_id text, source_type text, project_id text,
  locale text, title text, content text, rank int
)
language sql stable as $$
  select c.id, c.parent_id, c.source_type, c.project_id,
         c.locale, c.title, c.content,
         row_number() over (order by c.embedding <=> query_embedding)::int as rank
  from doc_chunks c
  where c.locale = filter_locale
  order by c.embedding <=> query_embedding
  limit match_count;
$$;

-- Sparse: Postgres full-text rank, locale-filtered. `simple` config keeps it
-- language-agnostic (works for EN/zh-TW/ja tokens alike).
drop function if exists match_chunks_fts(text, int, text);
create function match_chunks_fts(
  query_text text,
  match_count int,
  filter_locale text
)
returns table (
  id text, parent_id text, source_type text, project_id text,
  locale text, title text, content text, rank int
)
language sql stable as $$
  select c.id, c.parent_id, c.source_type, c.project_id,
         c.locale, c.title, c.content,
         row_number() over (
           order by ts_rank(c.fts, websearch_to_tsquery('simple', query_text)) desc
         )::int as rank
  from doc_chunks c
  where c.locale = filter_locale
    and c.fts @@ websearch_to_tsquery('simple', query_text)
  order by ts_rank(c.fts, websearch_to_tsquery('simple', query_text)) desc
  limit match_count;
$$;

-- ── row-level security ─────────────────────────────────────────────────────
-- Chunks are public read (the site is public); writes go through the service
-- key only. chat_logs is service-key only (no public read).
alter table doc_chunks enable row level security;
drop policy if exists doc_chunks_public_read on doc_chunks;
create policy doc_chunks_public_read on doc_chunks for select using (true);

alter table chat_logs enable row level security;
-- no public policy: only the service role (which bypasses RLS) can read/write.
