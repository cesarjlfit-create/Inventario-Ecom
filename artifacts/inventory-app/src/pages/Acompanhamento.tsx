import { useState, useEffect, useMemo } from 'react'
import * as XLSX from 'xlsx'
import { supabase, type InventarioLancamento } from '@/lib/supabase'
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

// ─── Componente principal ─────────────────────────────────────────────────────
export default function Acompanhamento() {
  // Dados
  const [lancamentos, setLancamentos] = useState<InventarioLancamento[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRealtimeOn, setIsRealtimeOn] = useState(false)

  // Filtros
  const [searchTerm, setSearchTerm] = useState('')
  const [loteFilter, setLoteFilter] = useState('all')

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

  // ─── Lotes únicos para o dropdown ────────────────────────────────────────────
  const lotesUnicos = useMemo(() => {
    const set = new Set(lancamentos.map((l) => l.lote).filter(Boolean))
    return Array.from(set).sort()
  }, [lancamentos])

  // ─── Filtragem ────────────────────────────────────────────────────────────────
  const filtrados = useMemo(() => {
    const termo = searchTerm.toLowerCase()
    return lancamentos.filter((l) => {
      const matchSearch =
        !termo ||
        l.ean.toLowerCase().includes(termo) ||
        l.sku.toLowerCase().includes(termo) ||
        l.descricao.toLowerCase().includes(termo)
      const matchLote = loteFilter === 'all' || l.lote === loteFilter
      return matchSearch && matchLote
    })
  }, [lancamentos, searchTerm, loteFilter])

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
      EAN: l.ean,
      SKU: l.sku || '',
      Descrição: l.descricao || '',
      Lote: l.lote,
      Quantidade: Number(l.quantidade),
    }))

    const ws = XLSX.utils.json_to_sheet(dadosExport)

    // Larguras das colunas
    ws['!cols'] = [
      { wch: 20 }, // Data/Hora
      { wch: 16 }, // EAN
      { wch: 14 }, // SKU
      { wch: 36 }, // Descrição
      { wch: 14 }, // Lote
      { wch: 12 }, // Quantidade
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Inventário')

    const nomeArquivo = `inventario_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`
    XLSX.writeFile(wb, nomeArquivo)
    toast.success(`Arquivo "${nomeArquivo}" baixado com sucesso`)
  }

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-[calc(100vh-4rem)] p-3 pb-10">
      <div className="max-w-7xl mx-auto space-y-4">

        {/* ── Cards de totais ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-card border border-card-border rounded-xl p-4" data-testid="card-total-itens">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Itens Contados</p>
            <p className="text-3xl font-bold">{totalItens}</p>
          </div>
          <div className="bg-card border border-primary/20 rounded-xl p-4" data-testid="card-soma-qtd">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Soma das Qtd.</p>
            <p className="text-3xl font-bold text-primary">{somaQuantidades}</p>
          </div>
          <div className="col-span-2 bg-card border border-card-border rounded-xl p-4 flex items-center justify-between" data-testid="card-realtime">
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
          {(searchTerm || loteFilter !== 'all') && (
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
              {(searchTerm || loteFilter !== 'all') && (
                <button
                  className="text-xs text-primary hover:underline mt-1"
                  onClick={() => { setSearchTerm(''); setLoteFilter('all') }}
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
                          className={`transition-colors ${isEditing ? 'bg-primary/5 border-l-2 border-l-primary' : 'hover:bg-muted/20'}`}
                          data-testid={`row-${lanc.id}`}
                        >
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
                      className={`border rounded-xl p-4 space-y-3 ${isEditing ? 'border-primary bg-primary/5' : 'border-border bg-muted/20'}`}
                      data-testid={`card-mobile-${lanc.id}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
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
