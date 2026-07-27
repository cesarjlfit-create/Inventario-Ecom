import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ─── Tabelas originais ────────────────────────────────────────────────────────
export type Movimentacao = {
  id: string
  codigo_barras: string
  nome_produto: string
  tipo: 'entrada' | 'saida'
  quantidade: number
  operador: string
  observacao: string
  created_at: string
}

export type Produto = {
  id: string
  codigo_barras: string
  nome: string
  descricao: string
  quantidade_atual: number
  unidade: string
  created_at: string
}

// ─── Tabelas de inventário ────────────────────────────────────────────────────
export type ProdutoBase = {
  id?: string
  ean: string
  descricao: string
  sku: string
  created_at?: string
}

export type InventarioLancamento = {
  id: string
  ean: string
  sku: string
  descricao: string
  lote: string
  quantidade: number
  created_at: string
}
