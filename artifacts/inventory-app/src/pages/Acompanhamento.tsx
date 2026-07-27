import { useState, useEffect } from 'react'
import { supabase, type Movimentacao } from '@/lib/supabase'
import { Search, Wifi, Clock, AlertCircle } from 'lucide-react'
import { format, startOfDay, subDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import StatusBadge from '@/components/StatusBadge'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type DateRange = 'today' | '7days' | 'all'

export default function Acompanhamento() {
  const [movimentacoes, setMovimentacoes] = useState<Movimentacao[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [tipoFilter, setTipoFilter] = useState<'all' | 'entrada' | 'saida'>('all')
  const [dateRange, setDateRange] = useState<DateRange>('today')
  const [configError, setConfigError] = useState<string | null>(null)
  
  const [stats, setStats] = useState({
    totalMovimentacoes: 0,
    totalEntradas: 0,
    totalSaidas: 0,
  })

  // Check Supabase config
  useEffect(() => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
    
    if (!supabaseUrl || !supabaseAnonKey) {
      setConfigError('Configuração incompleta. Defina as variáveis de ambiente VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.')
      setIsLoading(false)
      return
    }
    
    setConfigError(null)
  }, [])

  // Load movements
  useEffect(() => {
    if (configError) return
    
    const loadMovements = async () => {
      setIsLoading(true)
      try {
        let query = supabase
          .from('movimentacoes')
          .select('*')
          .order('created_at', { ascending: false })
        
        // Apply date range filter
        if (dateRange === 'today') {
          const today = startOfDay(new Date()).toISOString()
          query = query.gte('created_at', today)
        } else if (dateRange === '7days') {
          const sevenDaysAgo = subDays(new Date(), 7).toISOString()
          query = query.gte('created_at', sevenDaysAgo)
        }
        
        const { data, error } = await query
        
        if (error) throw error
        setMovimentacoes(data || [])
      } catch (error: any) {
        console.error('Erro ao carregar movimentações:', error)
      } finally {
        setIsLoading(false)
      }
    }
    
    loadMovements()
    
    // Subscribe to realtime changes
    const channel = supabase
      .channel('acompanhamento-changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'movimentacoes' },
        (payload) => {
          const newMov = payload.new as Movimentacao
          setMovimentacoes((prev) => [newMov, ...prev])
        }
      )
      .subscribe()
    
    return () => {
      supabase.removeChannel(channel)
    }
  }, [dateRange, configError])

  // Calculate stats for today
  useEffect(() => {
    const today = startOfDay(new Date())
    const todayMovements = movimentacoes.filter(
      (mov) => new Date(mov.created_at) >= today
    )
    
    const totalMovimentacoes = todayMovements.length
    const totalEntradas = todayMovements
      .filter((m) => m.tipo === 'entrada')
      .reduce((sum, m) => sum + m.quantidade, 0)
    const totalSaidas = todayMovements
      .filter((m) => m.tipo === 'saida')
      .reduce((sum, m) => sum + m.quantidade, 0)
    
    setStats({ totalMovimentacoes, totalEntradas, totalSaidas })
  }, [movimentacoes])

  // Filter movements
  const filteredMovements = movimentacoes.filter((mov) => {
    const matchesSearch =
      mov.codigo_barras.toLowerCase().includes(searchTerm.toLowerCase()) ||
      mov.nome_produto.toLowerCase().includes(searchTerm.toLowerCase()) ||
      mov.operador.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesTipo = tipoFilter === 'all' || mov.tipo === tipoFilter
    
    return matchesSearch && matchesTipo
  })

  if (configError) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-destructive/10 border border-destructive/20 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
            <div>
              <h3 className="font-semibold text-destructive mb-2">Erro de Configuração</h3>
              <p className="text-sm text-destructive/90">{configError}</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] p-4 pb-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-card border border-card-border rounded-xl p-5" data-testid="card-total">
            <p className="text-sm text-muted-foreground mb-1">Movimentações Hoje</p>
            <p className="text-3xl font-bold">{stats.totalMovimentacoes}</p>
          </div>
          <div className="bg-card border border-green-500/20 rounded-xl p-5" data-testid="card-entradas">
            <p className="text-sm text-muted-foreground mb-1">Entradas Hoje</p>
            <p className="text-3xl font-bold text-green-400">{stats.totalEntradas}</p>
          </div>
          <div className="bg-card border border-red-500/20 rounded-xl p-5" data-testid="card-saidas">
            <p className="text-sm text-muted-foreground mb-1">Saídas Hoje</p>
            <p className="text-3xl font-bold text-red-400">{stats.totalSaidas}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-card border border-card-border rounded-xl p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Buscar código, produto, operador…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-10"
                data-testid="input-search"
              />
            </div>
            
            <Select value={tipoFilter} onValueChange={(v: any) => setTipoFilter(v)}>
              <SelectTrigger className="h-10" data-testid="select-tipo">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Tipos</SelectItem>
                <SelectItem value="entrada">Entrada</SelectItem>
                <SelectItem value="saida">Saída</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={dateRange} onValueChange={(v: any) => setDateRange(v)}>
              <SelectTrigger className="h-10" data-testid="select-period">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Hoje</SelectItem>
                <SelectItem value="7days">Últimos 7 dias</SelectItem>
                <SelectItem value="all">Tudo</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Movements Table/List */}
        <div className="bg-card border border-card-border rounded-xl overflow-hidden">
          <div className="p-4 border-b border-card-border flex items-center justify-between">
            <h2 className="text-lg font-bold">Movimentações em Tempo Real</h2>
            <div className="flex items-center gap-2 text-xs text-green-400">
              <Wifi className="h-3.5 w-3.5 animate-pulse" />
              <span>Atualizado ao vivo</span>
            </div>
          </div>
          
          {isLoading ? (
            <div className="p-4 space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 bg-muted/50 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : filteredMovements.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">Nenhuma movimentação encontrada</p>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/30 border-b border-card-border">
                    <tr className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      <th className="px-4 py-3">Data/Hora</th>
                      <th className="px-4 py-3">Código de Barras</th>
                      <th className="px-4 py-3">Produto</th>
                      <th className="px-4 py-3">Tipo</th>
                      <th className="px-4 py-3">Qtd</th>
                      <th className="px-4 py-3">Operador</th>
                      <th className="px-4 py-3">Observação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-card-border">
                    {filteredMovements.map((mov) => (
                      <tr key={mov.id} className="hover:bg-muted/20 transition-colors" data-testid={`row-${mov.id}`}>
                        <td className="px-4 py-3 text-sm whitespace-nowrap">
                          {format(new Date(mov.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </td>
                        <td className="px-4 py-3 text-sm font-mono">{mov.codigo_barras}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {mov.nome_produto || '—'}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge tipo={mov.tipo} />
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold">{mov.quantidade}</td>
                        <td className="px-4 py-3 text-sm">{mov.operador}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {mov.observacao || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden p-4 space-y-3">
                {filteredMovements.map((mov) => (
                  <div
                    key={mov.id}
                    className="bg-muted/30 border border-border rounded-lg p-4 space-y-2"
                    data-testid={`card-${mov.id}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-mono text-sm font-semibold">{mov.codigo_barras}</p>
                      <StatusBadge tipo={mov.tipo} />
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground">Quantidade:</span>{' '}
                        <span className="font-semibold">{mov.quantidade}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Operador:</span>{' '}
                        <span>{mov.operador}</span>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(mov.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                    {mov.observacao && (
                      <p className="text-xs text-muted-foreground italic">{mov.observacao}</p>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
