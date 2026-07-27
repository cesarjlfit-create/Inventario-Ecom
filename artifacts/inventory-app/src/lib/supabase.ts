import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

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
