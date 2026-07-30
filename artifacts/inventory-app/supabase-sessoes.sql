-- Execute este script no SQL Editor do seu projeto Supabase.
-- Ele cria as salas e vincula os lançamentos existentes a uma sala opcional.

create table if not exists public.inventario_sessoes (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  titulo text not null,
  status text not null default 'em_andamento'
    check (status in ('em_andamento', 'finalizado')),
  created_at timestamptz not null default now(),
  finalizado_at timestamptz
);

-- Compatibilidade com instalações que já tinham a tabela criada sem esta coluna.
alter table public.inventario_sessoes
  add column if not exists finalizado_at timestamptz;

alter table public.inventario_lancamentos
  add column if not exists sessao_id uuid references public.inventario_sessoes(id) on delete set null;

alter table public.inventario_lancamentos
  add column if not exists usuario text;

update public.inventario_lancamentos
set usuario = 'Usuário não identificado'
where usuario is null or btrim(usuario) = '';

alter table public.inventario_lancamentos
  alter column usuario set default 'Usuário não identificado',
  alter column usuario set not null;

create index if not exists inventario_lancamentos_sessao_id_idx
  on public.inventario_lancamentos(sessao_id);

alter table public.inventario_sessoes enable row level security;

drop policy if exists "inventario_sessoes_select" on public.inventario_sessoes;
create policy "inventario_sessoes_select"
  on public.inventario_sessoes for select using (true);

drop policy if exists "inventario_sessoes_insert" on public.inventario_sessoes;
create policy "inventario_sessoes_insert"
  on public.inventario_sessoes for insert with check (true);

drop policy if exists "inventario_sessoes_update" on public.inventario_sessoes;
create policy "inventario_sessoes_update"
  on public.inventario_sessoes for update using (true) with check (true);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'inventario_sessoes'
  ) then
    alter publication supabase_realtime add table public.inventario_sessoes;
  end if;
end
$$;