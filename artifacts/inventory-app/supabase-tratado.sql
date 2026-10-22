-- Execute este script no SQL Editor do seu projeto Supabase.
-- Adiciona a marcação de "tratado" aos lançamentos do inventário,
-- registrando quem marcou e quando.

alter table public.inventario_lancamentos
  add column if not exists tratado boolean not null default false,
  add column if not exists tratado_por text,
  add column if not exists tratado_at timestamptz;

create index if not exists inventario_lancamentos_tratado_idx
  on public.inventario_lancamentos(sessao_id, tratado);

-- Força o Supabase a reconhecer as novas colunas imediatamente
notify pgrst, 'reload schema';
