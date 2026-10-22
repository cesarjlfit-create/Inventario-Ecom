import { useState, useEffect, useMemo } from 'react'
import * as XLSX from 'xlsx'
import { supabase, type InventarioLancamento, type InventarioSessao } from '@/lib/supabase'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { toast } from 'sonner'
import {
  Search,
  Wifi,
  WifiOff,
  Clock,
  Download,
  Pencil,
  Trash2,
  Check,
  X,
  Package,
  Hash,
  Loader2,
  AlertTriangle,
  History,
  DoorOpen,
  CircleCheck,
  Trophy,
  UserRound,
  CheckCheck,
  ListChecks,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

// ─── Tipos ────────────────────────────────────────────────────────────────────
type EditingState = {
  lote: string
  quantidade: string
}

type AcompanhamentoMode = 'sala' | 'historico'

type TratadoFilter = 'all' | 'pendentes' | 'tratados'

interface AcompanhamentoProps {
  activeSession: InventarioSessao
  userName?: string
  onSessionSelected: (session: InventarioSessao) => void
  onSessionUpdated: (session: InventarioSessao) => void
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function Acompanhamento({
  activeSession,
  userName = '',
  onSessionSelected,
  onSessionUpdated,
}: AcompanhamentoProps) {
  // Dados
  const [lancamentos, setLancamentos] = useState<InventarioLancamento[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRealtimeOn, setIsRealtimeOn] = useState(false)
  const [mode, setMode] = useState<AcompanhamentoMode>('sala')
  const [sessoes, setSessoes] = useState<InventarioSessao[]>([])
  const [sessionSearch, setSessionSearch] = useState('')
  const [isLoadingSessoes, setIsLoadingSessoes] = useState(false)
  const [finishingId, setFinishingId] = useState<string | null>(null)

  // Filtros
  const [searchTerm, setSearchTerm] = useState('')
  const [loteFilter, setLoteFilter] = useState('all')
  const [tratadoFilter, setTratadoFilter] = useState<TratadoFilter>('all')

  // Marcação de tratado
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set())

  // Edição inline
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingValues, setEditingValues] = useState<EditingState>({ lote: '', quantidade: '' })
  const [isSaving, setIsSaving] = useState(false)

  // Exclusão com confirmação
  const [deletingItem, setDeletingItem] = useState<InventarioLancamento | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // ─── Carregar dados iniciais ─────────────────────────────────────────────────
  useEffect(() => {
    const carregar = async () => {
      setIsLoading(true)
      try {
        const { data, error } = await supabase
          .from('inventario_lancamentos')
          .select('*')
          .order('created_at', { ascending: false })
        if (error) throw error
        setLancamentos(data || [])
      } catch (err: any) {
        toast.error('Erro ao carregar lançamentos: ' + (err.message || 'Tente novamente'))
      } finally {
        setIsLoading(false)
      }
    }

    carregar()
  }, [])

  useEffect(() => {
    const carregarSessoes = async () => {
      setIsLoadingSessoes(true)
      try {
        const { data, error } = await supabase
          .from('inventario_sessoes')
          .select('*')
          .order('created_at', { ascending: false })
        if (error) throw error
        setSessoes((data || []) as InventarioSessao[])
      } catch (err: any) {
        toast.error('Erro ao carregar histórico: ' + (err.message || 'Tente novamente'))
      } finally {
        setIsLoadingSessoes(false)
      }
    }

    void carregarSessoes()
  }, [])

  // ─── Realtime: INSERT, UPDATE, DELETE ────────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel('acompanhamento-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'inventario_lancamentos' },
        (payload) => {
          setLancamentos((prev) => [payload.new as InventarioLancamento, ...prev])
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'inventario_lancamentos' },
        (payload) => {
          setLancamentos((prev) =>
            prev.map((l) =>
              l.id === (payload.new as InventarioLancamento).id
                ? (payload.new as InventarioLancamento)
                : l
            )
          )
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'inventario_lancamentos' },
        (payload) => {
          setLancamentos((prev) =>
            prev.filter((l) => l.id !== (payload.old as { id: string }).id)
          )
        }
      )
      .subscribe((status) => {
        setIsRealtimeOn(status === 'SUBSCRIBED')
      })

    return () => {
      supabase.removeChannel(channel)
      setIsRealtimeOn(false)
    }
  }, [])

  const lancamentosDaSala = useMemo(
    () => lancamentos.filter((lancamento) => lancamento.sessao_id === activeSession.id),
    [lancamentos, activeSession.id],
  )

  const desempenhoUsuarios = useMemo(() => {
    const porUsuario = new Map<string, {
      usuario: string
      lotes: Set<string>
      unidades: number
      lancamentos: number
    }>()

    for (const lancamento of lancamentosDaSala) {
      const usuario = lancamento.usuario?.trim() || 'Usuário não identificado'
      const atual = porUsuario.get(usuario) || {
        usuario,
        lotes: new Set<string>(),
        unidades: 0,
        lancamentos: 0,
      }
      if (lancamento.lote.trim()) atual.lotes.add(lancamento.lote.trim())
      atual.unidades += Number(lancamento.quantidade) || 0
      atual.lancamentos += 1
      porUsuario.set(usuario, atual)
    }

    const totalLotes = new Set(
      lancamentosDaSala.map((lancamento) => lancamento.lote.trim()).filter(Boolean),
    ).size

    return Array.from(porUsuario.values())
      .map((item) => ({
        ...item,
        lotesConferidos: item.lotes.size,
        percentualLotes: totalLotes > 0 ? (item.lotes.size / totalLotes) * 100 : 0,
      }))
      .sort((a, b) => b.unidades - a.unidades || b.lancamentos - a.lancamentos || a.usuario.localeCompare(b.usuario))
  }, [lancamentosDaSala])

  const sessoesFiltradas = useMemo(() => {
    const termo = sessionSearch.trim().toLowerCase()
    if (!termo) return sessoes
    return sessoes.filter(
      (sessao) =>
        sessao.codigo.toLowerCase().includes(termo) ||
        sessao.titulo.toLowerCase().includes(termo),
    )
  }, [sessoes, sessionSearch])

  const exportarSessao = (sessao: InventarioSessao) => {
    const itens = lancamentos.filter((lancamento) => lancamento.sessao_id === sessao.id)
    if (itens.length === 0) {
      toast.error('Este inventário ainda não possui itens para exportar')
      return
    }

    const dadosExport = itens.map((item) => ({
      'Código da Sala': sessao.codigo,
      'Título do Inventário': sessao.titulo,
      'Data/Hora': format(new Date(item.created_at), 'dd/MM/yyyy HH:mm:ss', { locale: ptBR }),
      'Usuário / Operador': item.usuario || 'Usuário não identificado',
      EAN: item.ean,
      SKU: item.sku || '',
      Descrição: item.descricao || '',
      Lote: item.lote,
      Quantidade: Number(item.quantidade),
      Tratado: item.tratado ? 'Sim' : 'Não',
      'Tratado por': item.tratado_por || '',
    }))
    const ws = XLSX.utils.json_to_sheet(dadosExport)
    ws['!cols'] = [
      { wch: 18 }, { wch: 32 }, { wch: 20 }, { wch: 24 }, { wch: 16 },
      { wch: 14 }, { wch: 42 }, { wch: 14 }, { wch: 12 }, { wch: 10 }, { wch: 24 },
    ]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Inventário')
    const nomeArquivo = `${sessao.codigo.toLowerCase()}_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`
    XLSX.writeFile(wb, nomeArquivo)
    toast.success(`Arquivo "${nomeArquivo}" baixado com sucesso`)
  }

  const finalizarInventario = async (sessao: InventarioSessao) => {
    if (sessao.status === 'finalizado') return
    setFinishingId(sessao.id)
    try {
      const finalizadoAt = new Date().toISOString()
      let { data, error } = await supabase
        .from('inventario_sessoes')
        .update({ status: 'finalizado', finalizado_at: finalizadoAt })
        .eq('id', sessao.id)
        .select('*')
        .single()

      // Instalações antigas podem ainda estar com o schema cache do Supabase
      // sem a coluna finalizado_at. Nesse caso, finaliza o status mesmo assim;
      // a migração SQL adiciona a coluna para as próximas operações.
      if (
        error &&
        /finalizado_at|schema cache|column/i.test(error.message || '')
      ) {
        const fallback = await supabase
          .from('inventario_sessoes')
          .update({ status: 'finalizado' })
          .eq('id', sessao.id)
          .select('*')
          .single()
        data = fallback.data
        error = fallback.error
      }

      if (error) throw error
      const atualizada = data as InventarioSessao
      setSessoes((prev) => prev.map((item) => item.id === atualizada.id ? atualizada : item))
      toast.success(`Inventário ${atualizada.codigo} finalizado`)
      if (atualizada.id === activeSession.id) onSessionUpdated(atualizada)
    } catch (err: any) {
      toast.error('Erro ao finalizar inventário: ' + (err.message || 'Tente novamente'))
    } finally {
      setFinishingId(null)
    }
  }

  // ─── Lotes únicos para o dropdown ────────────────────────────────────────────
  const lotesUnicos = useMemo(() => {
    const set = new Set(lancamentosDaSala.map((l) => l.lote).filter(Boolean))
    return Array.from(set).sort()
  }, [lancamentosDaSala])

  // ─── Filtragem ────────────────────────────────────────────────────────────────
  const filtrados = useMemo(() => {
    const termo = searchTerm.toLowerCase()
    return lancamentosDaSala.filter((l) => {
      const matchSearch =
        !termo ||
        l.ean.toLowerCase().includes(termo) ||
        l.sku.toLowerCase().includes(termo) ||
        l.descricao.toLowerCase().includes(termo)
      const matchLote = loteFilter === 'all' || l.lote === loteFilter
      const matchTratado =
        tratadoFilter === 'all' ||
        (tratadoFilter === 'tratados' ? !!l.tratado : !l.tratado)
      return matchSearch && matchLote && matchTratado
    })
  }, [lancamentosDaSala, searchTerm, loteFilter, tratadoFilter])

  const totalTratadosSala = useMemo(
    () => lancamentosDaSala.filter((l) => l.tratado).length,
    [lancamentosDaSala]
  )
  const percentualTratados =
    lancamentosDaSala.length > 0 ? (totalTratadosSala / lancamentosDaSala.length) * 100 : 0

  // ─── Marcar / desmarcar como tratado ─────────────────────────────────────────
  const alternarTratado = async (lancamento: InventarioLancamento) => {
    if (togglingIds.has(lancamento.id)) return
    const novoValor = !lancamento.tratado
    const alteracao = {
      tratado: novoValor,
      tratado_por: novoValor ? (userName.trim() || 'Usuário não identificado') : null,
      tratado_at: novoValor ? new Date().toISOString() : null,
    }
    const anterior = {
      tratado: lancamento.tratado ?? false,
      tratado_por: lancamento.tratado_por ?? null,
      tratado_at: lancamento.tratado_at ?? null,
    }

    // Atualização otimista: o check aparece na hora
    setTogglingIds((prev) => new Set(prev).add(lancamento.id))
    setLancamentos((prev) => prev.map((l) => (l.id === lancamento.id ? { ...l, ...alteracao } : l)))

    try {
      const { error } = await supabase
        .from('inventario_lancamentos')
        .update(alteracao)
        .eq('id', lancamento.id)
      if (error) throw error
    } catch (err: any) {
      setLancamentos((prev) => prev.map((l) => (l.id === lancamento.id ? { ...l, ...anterior } : l)))
      const msg = err?.message || ''
      if (/tratado|schema cache|column/i.test(msg)) {
        toast.error('A coluna "tratado" ainda não existe no banco. Execute o script supabase-tratado.sql no Supabase.')
      } else {
        toast.error('Erro ao marcar lançamento: ' + (msg || 'Tente novamente'))
      }
    } finally {
      setTogglingIds((prev) => {
        const next = new Set(prev)
        next.delete(lancamento.id)
        return next
      })
    }
  }

  const tituloTratado = (l: InventarioLancamento) =>
    l.tratado
      ? `Tratado${l.tratado_por ? ` por ${l.tratado_por}` : ''}${
          l.tratado_at ? ` em ${format(new Date(l.tratado_at), 'dd/MM HH:mm', { locale: ptBR })}` : ''
        } — clique para desmarcar`
      : 'Marcar como tratado'

  // ─── Totais dos filtrados ────────────────────────────────────────────────────
  const totalItens = filtrados.length
  const somaQuantidades = useMemo(
    () => filtrados.reduce((acc, l) => acc + Number(l.quantidade), 0),
    [filtrados]
  )

  // ─── Edição inline ───────────────────────────────────────────────────────────
  const iniciarEdicao = (lancamento: InventarioLancamento) => {
    setEditingId(lancamento.id)
    setEditingValues({
      lote: lancamento.lote,
      quantidade: String(lancamento.quantidade),
    })
  }

  const cancelarEdicao = () => {
    setEditingId(null)
    setEditingValues({ lote: '', quantidade: '' })
  }

  const salvarEdicao = async (id: string) => {
    const qtd = Number(editingValues.quantidade)
    if (!editingValues.lote.trim()) {
      toast.error('Lote não pode estar vazio')
      return
    }
    if (isNaN(qtd) || qtd <= 0) {
      toast.error('Quantidade deve ser maior que zero')
      return
    }

    setIsSaving(true)
    try {
      const { error } = await supabase
        .from('inventario_lancamentos')
        .update({ lote: editingValues.lote.trim(), quantidade: qtd })
        .eq('id', id)

      if (error) throw error

      toast.success('Lançamento atualizado com sucesso')
      setEditingId(null)
    } catch (err: any) {
      toast.error('Erro ao atualizar: ' + (err.message || 'Tente novamente'))
    } finally {
      setIsSaving(false)
    }
  }

  // ─── Exclusão ────────────────────────────────────────────────────────────────
  const confirmarExclusao = async () => {
    if (!deletingItem) return
    setIsDeleting(true)
    try {
      const { error } = await supabase
        .from('inventario_lancamentos')
        .delete()
        .eq('id', deletingItem.id)

      if (error) throw error

      toast.success('Lançamento excluído')
      setDeletingItem(null)
    } catch (err: any) {
      toast.error('Erro ao excluir: ' + (err.message || 'Tente novamente'))
    } finally {
      setIsDeleting(false)
    }
  }

  // ─── Exportação Excel ────────────────────────────────────────────────────────
  const exportarExcel = () => {
    if (filtrados.length === 0) {
      toast.error('Nenhum dado para exportar')
      return
    }

    const dadosExport = filtrados.map((l) => ({
      'Data/Hora': format(new Date(l.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR }),
      'Usuário / Operador': l.usuario || 'Usuário não identificado',
      EAN: l.ean,
      SKU: l.sku || '',
      Descrição: l.descricao || '',
      Lote: l.lote,
      Quantidade: Number(l.quantidade),
      Tratado: l.tratado ? 'Sim' : 'Não',
      'Tratado por': l.tratado_por || '',
      'Tratado em': l.tratado_at ? format(new Date(l.tratado_at), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : '',
    }))

    const ws = XLSX.utils.json_to_sheet(dadosExport)

    // Larguras das colunas
    ws['!cols'] = [
      { wch: 20 }, // Data/Hora
      { wch: 24 }, // Usuário / Operador
      { wch: 16 }, // EAN
      { wch: 14 }, // SKU
      { wch: 36 }, // Descrição
      { wch: 14 }, // Lote
      { wch: 12 }, // Quantidade
      { wch: 10 }, // Tratado
      { wch: 24 }, // Tratado por
      { wch: 18 }, // Tratado em
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Inventário')

    const nomeArquivo = `inventario_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`
    XLSX.writeFile(wb, nomeArquivo)
    toast.success(`Arquivo "${nomeArquivo}" baixado com sucesso`)
  }

  const seletorVisao = (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-card-border bg-card p-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Acompanhamento</p>
        <p className="mt-1 text-sm text-foreground">
          {mode === 'sala' ? `Itens da sala ${activeSession.codigo}` : 'Histórico de inventários'}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-zinc-950 p-1">
        <button
          type="button"
          onClick={() => setMode('sala')}
          className={`flex items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold transition-colors ${
            mode === 'sala' ? 'bg-[#e50914] text-white' : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Package className="h-3.5 w-3.5" />
          Sala selecionada
        </button>
        <button
          type="button"
          onClick={() => setMode('historico')}
          className={`flex items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold transition-colors ${
            mode === 'historico' ? 'bg-[#e50914] text-white' : 'text-zinc-400 hover:text-white'
          }`}
        >
          <History className="h-3.5 w-3.5" />
          Histórico
        </button>
      </div>
    </div>
  )

  if (mode === 'historico') {
    return (
      <div className="min-h-[calc(100vh-4rem)] p-3 pb-10">
        <div className="mx-auto max-w-7xl space-y-4">
          {seletorVisao}
          <div className="rounded-xl border border-card-border bg-card p-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={sessionSearch}
                onChange={(event) => setSessionSearch(event.target.value)}
                placeholder="Buscar por código ATV-XXXX ou título do inventário…"
                className="h-10 pl-9"
              />
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-card-border bg-card">
            <div className="flex items-center justify-between border-b border-card-border px-4 py-3">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
                  Histórico de Inventários
                </h2>
                <p className="mt-1 text-xs text-zinc-500">{sessoesFiltradas.length} sala(s) encontrada(s)</p>
              </div>
              {isLoadingSessoes && <Loader2 className="h-4 w-4 animate-spin text-[#e50914]" />}
            </div>

            {sessoesFiltradas.length === 0 ? (
              <div className="py-16 text-center text-sm text-muted-foreground">
                <History className="mx-auto mb-3 h-10 w-10 opacity-30" />
                Nenhum inventário encontrado.
              </div>
            ) : (
              <div className="divide-y divide-card-border/60">
                {sessoesFiltradas.map((sessao) => {
                  const itens = lancamentos.filter((item) => item.sessao_id === sessao.id)
                  const quantidadeTotal = itens.reduce((total, item) => total + Number(item.quantidade), 0)
                  const isCurrent = sessao.id === activeSession.id

                  return (
                    <div key={sessao.id} className="p-4 transition-colors hover:bg-muted/10">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-sm font-bold text-[#e50914]">{sessao.codigo}</span>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                              sessao.status === 'em_andamento'
                                ? 'bg-green-500/10 text-green-400'
                                : 'bg-zinc-700/50 text-zinc-400'
                            }`}>
                              {sessao.status === 'em_andamento' ? 'Em andamento' : 'Finalizado'}
                            </span>
                            {isCurrent && (
                              <span className="rounded-full bg-[#e50914]/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-[#e50914]">
                                Sala atual
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-base font-semibold text-white">{sessao.titulo}</p>
                          <p className="mt-1 text-xs text-zinc-500">
                            Criado em {format(new Date(sessao.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                            {' · '}
                            <span className="text-zinc-300">{itens.length} itens bipados</span>
                            {' · '}
                            <span className="text-zinc-300">{quantidadeTotal} unidades</span>
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {sessao.status === 'em_andamento' && !isCurrent && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => onSessionSelected(sessao)}
                              className="gap-1.5 border-[#e50914]/40 text-[#e50914] hover:bg-[#e50914]/10"
                            >
                              <DoorOpen className="h-3.5 w-3.5" />
                              Entrar na Sala
                            </Button>
                          )}
                          {sessao.status === 'em_andamento' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => void finalizarInventario(sessao)}
                              disabled={finishingId === sessao.id}
                              className="gap-1.5 border-green-500/30 text-green-400 hover:bg-green-500/10"
                            >
                              {finishingId === sessao.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <CircleCheck className="h-3.5 w-3.5" />
                              )}
                              Finalizar Inventário
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => exportarSessao(sessao)}
                            className="gap-1.5 border-zinc-700 text-zinc-300 hover:border-[#e50914]/50 hover:text-white"
                          >
                            <Download className="h-3.5 w-3.5" />
                            Exportar .xlsx
                          </Button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-[calc(100vh-4rem)] p-3 pb-10">
      <div className="max-w-7xl mx-auto space-y-4">
        {seletorVisao}

        {/* ── Desempenho da equipe ─────────────────────────────────────────── */}
        <section className="overflow-hidden rounded-xl border border-[#e50914]/20 bg-card" aria-labelledby="desempenho-equipe">
          <div className="flex flex-col gap-2 border-b border-card-border bg-[#e50914]/5 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 id="desempenho-equipe" className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-white">
                <Trophy className="h-4 w-4 text-[#e50914]" />
                Desempenho da Equipe / Produtividade
              </h2>
              <p className="mt-1 text-xs text-zinc-500">
                Ranking em tempo real da sala {activeSession.codigo}, ordenado por unidades bipadas.
              </p>
            </div>
            <span className="text-xs text-zinc-400">
              {desempenhoUsuarios.length} operador(es) · {new Set(lancamentosDaSala.map((item) => item.lote.trim()).filter(Boolean)).size} lote(s)
            </span>
          </div>

          {desempenhoUsuarios.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              <UserRound className="mx-auto mb-2 h-8 w-8 opacity-30" />
              As métricas aparecerão assim que a equipe registrar as primeiras bipagens.
            </div>
          ) : (
            <div className="grid gap-3 p-3 md:grid-cols-2 xl:grid-cols-3">
              {desempenhoUsuarios.map((item, index) => (
                <div
                  key={item.usuario}
                  className={`rounded-lg border p-4 ${
                    index === 0
                      ? 'border-[#e50914]/40 bg-[#e50914]/5'
                      : 'border-card-border bg-muted/10'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        index === 0 ? 'bg-[#e50914] text-white' : 'bg-zinc-800 text-zinc-300'
                      }`}>
                        {index === 0 ? <Trophy className="h-4 w-4" /> : index + 1}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white">{item.usuario}</p>
                        <p className="text-[11px] text-zinc-500">{item.lancamentos} lançamento(s)</p>
                      </div>
                    </div>
                    <span className="whitespace-nowrap text-sm font-bold text-[#e50914]">
                      {item.percentualLotes.toFixed(1).replace('.', ',')}% dos lotes
                    </span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <div className="rounded-md bg-zinc-950/70 px-3 py-2">
                      <p className="text-[10px] uppercase tracking-wide text-zinc-500">Lotes únicos</p>
                      <p className="mt-1 text-lg font-bold text-white">{item.lotesConferidos}</p>
                    </div>
                    <div className="rounded-md bg-zinc-950/70 px-3 py-2">
                      <p className="text-[10px] uppercase tracking-wide text-zinc-500">Itens / Unidades</p>
                      <p className="mt-1 text-lg font-bold text-white">{item.unidades}</p>
                    </div>
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-zinc-800">
                    <div
                      className="h-full rounded-full bg-[#e50914] transition-all duration-500"
                      style={{ width: `${Math.min(item.percentualLotes, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Cards de totais ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-card border border-card-border rounded-xl p-4" data-testid="card-total-itens">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Itens Contados</p>
            <p className="text-3xl font-bold">{totalItens}</p>
          </div>
          <div className="bg-card border border-primary/20 rounded-xl p-4" data-testid="card-soma-qtd">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Soma das Qtd.</p>
            <p className="text-3xl font-bold text-primary">{somaQuantidades}</p>
          </div>
          <div className="bg-card border border-green-500/20 rounded-xl p-4" data-testid="card-tratados">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1 flex items-center gap-1.5">
              <ListChecks className="h-3.5 w-3.5 text-green-400" /> Tratados
            </p>
            <p className="text-3xl font-bold text-green-400">
              {totalTratadosSala}
              <span className="text-base font-medium text-muted-foreground">/{lancamentosDaSala.length}</span>
            </p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full rounded-full bg-green-500 transition-all duration-500"
                style={{ width: `${percentualTratados}%` }}
              />
            </div>
          </div>
          <div className="bg-card border border-card-border rounded-xl p-4 flex items-center justify-between" data-testid="card-realtime">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Status</p>
              <p className="text-sm font-semibold">
                {isRealtimeOn ? 'Tempo Real Ativo' : 'Conectando…'}
              </p>
            </div>
            <div className={`flex items-center gap-1.5 text-xs font-medium ${isRealtimeOn ? 'text-green-400' : 'text-muted-foreground'}`}>
              {isRealtimeOn ? (
                <><Wifi className="h-4 w-4 animate-pulse" /> Ao vivo</>
              ) : (
                <><WifiOff className="h-4 w-4" /> Aguardando</>
              )}
            </div>
          </div>
        </div>

        {/* ── Barra de filtros + exportação ─────────────────────────────────── */}
        <div className="bg-card border border-card-border rounded-xl p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Busca */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                type="search"
                placeholder="Buscar por EAN, SKU ou Descrição…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-10"
                data-testid="input-search"
              />
            </div>

            {/* Filtro por Lote */}
            <Select value={loteFilter} onValueChange={setLoteFilter}>
              <SelectTrigger className="h-10 w-full sm:w-52" data-testid="select-lote">
                <SelectValue placeholder="Filtrar por Lote" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Lotes</SelectItem>
                {lotesUnicos.map((lote) => (
                  <SelectItem key={lote} value={lote}>
                    {lote}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Filtro por status de tratamento */}
            <Select value={tratadoFilter} onValueChange={(v) => setTratadoFilter(v as TratadoFilter)}>
              <SelectTrigger className="h-10 w-full sm:w-44" data-testid="select-tratado">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="pendentes">Pendentes</SelectItem>
                <SelectItem value="tratados">Tratados</SelectItem>
              </SelectContent>
            </Select>

            {/* Exportar */}
            <Button
              variant="outline"
              className="h-10 gap-2 flex-shrink-0 border-[#e50914]/40 text-[#e50914] hover:bg-[#e50914]/10 hover:border-[#e50914] hover:shadow-[0_0_12px_rgba(229,9,20,0.25)] transition-all duration-200"
              onClick={exportarExcel}
              disabled={filtrados.length === 0}
              data-testid="button-exportar"
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Exportar Excel</span>
              <span className="sm:hidden">Excel</span>
            </Button>
          </div>

          {/* Contador filtrado */}
          {(searchTerm || loteFilter !== 'all' || tratadoFilter !== 'all') && (
            <p className="text-xs text-muted-foreground mt-3">
              Exibindo <span className="font-semibold text-foreground">{totalItens}</span> registro(s)
              {' — '}soma de quantidades: <span className="font-semibold text-primary">{somaQuantidades}</span>
            </p>
          )}
        </div>

        {/* ── Tabela ────────────────────────────────────────────────────────── */}
        <div className="bg-card border border-card-border rounded-xl overflow-hidden">
          {/* Cabeçalho */}
          <div className="px-4 py-3 border-b border-card-border flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
              Inventário — Lançamentos
            </h2>
            <div className={`flex items-center gap-1.5 text-xs ${isRealtimeOn ? 'text-green-400' : 'text-muted-foreground'}`}>
              <span className={`h-2 w-2 rounded-full ${isRealtimeOn ? 'bg-green-400 animate-pulse' : 'bg-muted-foreground'}`} />
              {isRealtimeOn ? 'Atualizado ao vivo' : 'Aguardando conexão'}
            </div>
          </div>

          {isLoading ? (
            <div className="p-4 space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-14 bg-muted/40 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : filtrados.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Clock className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Nenhum lançamento encontrado</p>
              {(searchTerm || loteFilter !== 'all' || tratadoFilter !== 'all') && (
                <button
                  className="text-xs text-primary hover:underline mt-1"
                  onClick={() => { setSearchTerm(''); setLoteFilter('all'); setTratadoFilter('all') }}
                >
                  Limpar filtros
                </button>
              )}
            </div>
          ) : (
            <>
              {/* ─── Desktop: tabela ─────────────────────────────────────── */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/20 border-b border-card-border">
                    <tr className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      <th className="px-4 py-3 text-center w-16">Tratado</th>
                      <th className="px-4 py-3 whitespace-nowrap">Data / Hora</th>
                      <th className="px-4 py-3">EAN</th>
                      <th className="px-4 py-3">SKU</th>
                      <th className="px-4 py-3">Descrição</th>
                      <th className="px-4 py-3">Lote</th>
                      <th className="px-4 py-3 text-right">Qtd</th>
                      <th className="px-4 py-3 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-card-border/60">
                    {filtrados.map((lanc) => {
                      const isEditing = editingId === lanc.id
                      return (
                        <tr
                          key={lanc.id}
                          className={`transition-colors ${
                            isEditing
                              ? 'bg-primary/5 border-l-2 border-l-primary'
                              : lanc.tratado
                                ? 'bg-green-500/[0.06] hover:bg-green-500/10'
                                : 'hover:bg-muted/20'
                          }`}
                          data-testid={`row-${lanc.id}`}
                        >
                          {/* Tratado */}
                          <td className="px-4 py-3 text-center">
                            <BotaoTratado
                              lancamento={lanc}
                              loading={togglingIds.has(lanc.id)}
                              title={tituloTratado(lanc)}
                              onToggle={() => void alternarTratado(lanc)}
                            />
                          </td>

                          {/* Data */}
                          <td className="px-4 py-3 whitespace-nowrap text-muted-foreground text-xs">
                            {format(new Date(lanc.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                          </td>

                          {/* EAN */}
                          <td className="px-4 py-3 font-mono text-xs">{lanc.ean}</td>

                          {/* SKU */}
                          <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                            {lanc.sku || '—'}
                          </td>

                          {/* Descrição */}
                          <td className="px-4 py-3 max-w-xs whitespace-normal break-words leading-snug">
                            {lanc.descricao || '—'}
                            {lanc.tratado && lanc.tratado_por && (
                              <p className="mt-0.5 text-[11px] text-green-400/80">
                                ✓ {lanc.tratado_por}
                                {lanc.tratado_at && ` · ${format(new Date(lanc.tratado_at), 'dd/MM HH:mm', { locale: ptBR })}`}
                              </p>
                            )}
                          </td>

                          {/* Lote — editável */}
                          <td className="px-4 py-3">
                            {isEditing ? (
                              <Input
                                value={editingValues.lote}
                                onChange={(e) =>
                                  setEditingValues((v) => ({ ...v, lote: e.target.value }))
                                }
                                className="h-8 w-28 font-mono text-xs"
                                autoFocus
                                data-testid="input-edit-lote"
                              />
                            ) : (
                              <span className="font-mono text-xs bg-muted/40 px-2 py-0.5 rounded">
                                {lanc.lote}
                              </span>
                            )}
                          </td>

                          {/* Quantidade — editável */}
                          <td className="px-4 py-3 text-right">
                            {isEditing ? (
                              <Input
                                type="number"
                                min="1"
                                value={editingValues.quantidade}
                                onChange={(e) =>
                                  setEditingValues((v) => ({ ...v, quantidade: e.target.value }))
                                }
                                className="h-8 w-20 text-center font-semibold text-xs ml-auto"
                                data-testid="input-edit-quantidade"
                              />
                            ) : (
                              <span className="font-semibold">{lanc.quantidade}</span>
                            )}
                          </td>

                          {/* Ações */}
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-center gap-1">
                              {isEditing ? (
                                <>
                                  <button
                                    onClick={() => salvarEdicao(lanc.id)}
                                    disabled={isSaving}
                                    className="h-7 w-7 flex items-center justify-center rounded bg-green-600/20 hover:bg-green-600/40 text-green-400 transition-colors disabled:opacity-50"
                                    title="Salvar"
                                    data-testid="button-salvar-edicao"
                                  >
                                    {isSaving ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <Check className="h-3.5 w-3.5" />
                                    )}
                                  </button>
                                  <button
                                    onClick={cancelarEdicao}
                                    disabled={isSaving}
                                    className="h-7 w-7 flex items-center justify-center rounded bg-muted/40 hover:bg-muted text-muted-foreground transition-colors"
                                    title="Cancelar"
                                    data-testid="button-cancelar-edicao"
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    onClick={() => iniciarEdicao(lanc)}
                                    className="h-7 w-7 flex items-center justify-center rounded bg-[#e50914]/10 hover:bg-[#e50914]/25 text-[#e50914] transition-colors"
                                    title="Editar lote e quantidade"
                                    data-testid={`button-editar-${lanc.id}`}
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    onClick={() => setDeletingItem(lanc)}
                                    className="h-7 w-7 flex items-center justify-center rounded bg-destructive/10 hover:bg-destructive/20 text-destructive transition-colors"
                                    title="Excluir lançamento"
                                    data-testid={`button-excluir-${lanc.id}`}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* ─── Mobile: cards ───────────────────────────────────────── */}
              <div className="md:hidden p-3 space-y-2">
                {filtrados.map((lanc) => {
                  const isEditing = editingId === lanc.id
                  return (
                    <div
                      key={lanc.id}
                      className={`border rounded-xl p-4 space-y-3 ${
                        isEditing
                          ? 'border-primary bg-primary/5'
                          : lanc.tratado
                            ? 'border-green-500/40 bg-green-500/[0.06]'
                            : 'border-border bg-muted/20'
                      }`}
                      data-testid={`card-mobile-${lanc.id}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <BotaoTratado
                          lancamento={lanc}
                          loading={togglingIds.has(lanc.id)}
                          title={tituloTratado(lanc)}
                          onToggle={() => void alternarTratado(lanc)}
                          size="lg"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="font-mono text-xs font-semibold truncate">{lanc.ean}</p>
                          <p className="text-xs text-foreground/90 leading-relaxed break-words">{lanc.descricao || '—'}</p>
                        </div>
                        <p className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
                          {format(new Date(lanc.created_at), "dd/MM HH:mm", { locale: ptBR })}
                        </p>
                      </div>

                      {lanc.sku && (
                        <p className="text-xs text-muted-foreground font-mono">
                          SKU: {lanc.sku}
                        </p>
                      )}

                      {lanc.tratado && (
                        <p className="flex items-center gap-1.5 text-xs font-medium text-green-400">
                          <CheckCheck className="h-3.5 w-3.5" />
                          Tratado{lanc.tratado_por ? ` por ${lanc.tratado_por}` : ''}
                          {lanc.tratado_at && ` · ${format(new Date(lanc.tratado_at), 'dd/MM HH:mm', { locale: ptBR })}`}
                        </p>
                      )}

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Lote</Label>
                          {isEditing ? (
                            <Input
                              value={editingValues.lote}
                              onChange={(e) =>
                                setEditingValues((v) => ({ ...v, lote: e.target.value }))
                              }
                              className="h-9 font-mono text-xs"
                              data-testid={`input-edit-lote-mobile-${lanc.id}`}
                            />
                          ) : (
                            <p className="text-sm font-mono font-semibold">{lanc.lote}</p>
                          )}
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Quantidade</Label>
                          {isEditing ? (
                            <Input
                              type="number"
                              min="1"
                              value={editingValues.quantidade}
                              onChange={(e) =>
                                setEditingValues((v) => ({ ...v, quantidade: e.target.value }))
                              }
                              className="h-9 text-center font-semibold text-sm"
                              data-testid={`input-edit-qtd-mobile-${lanc.id}`}
                            />
                          ) : (
                            <p className="text-xl font-bold">{lanc.quantidade}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        {isEditing ? (
                          <>
                            <Button
                              size="sm"
                              className="flex-1 h-9 bg-green-600 hover:bg-green-700 text-white gap-1"
                              onClick={() => salvarEdicao(lanc.id)}
                              disabled={isSaving}
                            >
                              {isSaving ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Check className="h-3.5 w-3.5" />
                              )}
                              Salvar
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1 h-9 gap-1"
                              onClick={cancelarEdicao}
                              disabled={isSaving}
                            >
                              <X className="h-3.5 w-3.5" />
                              Cancelar
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1 h-9 gap-1 border-[#e50914]/30 text-[#e50914] hover:bg-[#e50914]/10 hover:border-[#e50914]/60"
                              onClick={() => iniciarEdicao(lanc)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Editar
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1 h-9 gap-1 border-destructive/30 text-destructive hover:bg-destructive/10"
                              onClick={() => setDeletingItem(lanc)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Excluir
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Rodapé da tabela com totais */}
              <div className="px-4 py-3 border-t border-card-border bg-muted/10 flex flex-wrap items-center justify-between gap-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Hash className="h-4 w-4" />
                  <span>
                    <span className="font-semibold text-foreground">{totalItens}</span> registro(s)
                  </span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Package className="h-4 w-4" />
                  <span>
                    Total: <span className="font-semibold text-primary">{somaQuantidades}</span> unidades
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Dialog de confirmação de exclusão ────────────────────────────────── */}
      <Dialog open={!!deletingItem} onOpenChange={(open) => !open && setDeletingItem(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Confirmar Exclusão
            </DialogTitle>
            <DialogDescription className="space-y-2 pt-1">
              {deletingItem && (
                <>
                  <p>Tem certeza que deseja excluir este lançamento? Esta ação não pode ser desfeita.</p>
                  <div className="mt-3 bg-muted/40 rounded-lg p-3 space-y-1 text-sm text-foreground">
                    <p><span className="text-muted-foreground">EAN:</span> <span className="font-mono">{deletingItem.ean}</span></p>
                    <p><span className="text-muted-foreground">Descrição:</span> {deletingItem.descricao || '—'}</p>
                    <p><span className="text-muted-foreground">Lote:</span> <span className="font-mono">{deletingItem.lote}</span></p>
                    <p><span className="text-muted-foreground">Quantidade:</span> <span className="font-semibold">{deletingItem.quantidade}</span></p>
                  </div>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setDeletingItem(null)}
              disabled={isDeleting}
              data-testid="button-cancelar-exclusao"
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={confirmarExclusao}
              disabled={isDeleting}
              className="gap-2"
              data-testid="button-confirmar-exclusao"
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Botão de marcação "tratado" ──────────────────────────────────────────────
function BotaoTratado({
  lancamento,
  loading,
  title,
  onToggle,
  size = 'sm',
}: {
  lancamento: InventarioLancamento
  loading: boolean
  title: string
  onToggle: () => void
  size?: 'sm' | 'lg'
}) {
  const marcado = !!lancamento.tratado
  const dim = size === 'lg' ? 'h-9 w-9' : 'h-7 w-7'
  const icon = size === 'lg' ? 'h-5 w-5' : 'h-4 w-4'
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={marcado}
      aria-label={title}
      title={title}
      onClick={onToggle}
      disabled={loading}
      className={`${dim} mx-auto flex flex-shrink-0 items-center justify-center rounded-md border-2 transition-all duration-150 disabled:opacity-60 ${
        marcado
          ? 'border-green-500 bg-green-500 text-white hover:bg-green-600'
          : 'border-zinc-600 bg-transparent text-transparent hover:border-green-500 hover:text-green-500/50'
      }`}
      data-testid={`button-tratado-${lancamento.id}`}
    >
      {loading ? <Loader2 className={`${icon} animate-spin ${marcado ? "text-white" : "text-green-400"}`} /> : <Check className={icon} strokeWidth={3} />}
    </button>
  )
}
