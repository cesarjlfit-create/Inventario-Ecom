import { useEffect, useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { CalendarDays, Check, Download, Loader2, Search } from 'lucide-react'
import { toast } from 'sonner'
import { supabase, type InventarioLancamento, type InventarioSessao } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface ExportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const statusLabel: Record<InventarioSessao['status'], string> = {
  em_andamento: 'Em Andamento',
  finalizado: 'Finalizado',
}

function sanitizarNomeArquivo(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

export default function ExportDialog({ open, onOpenChange }: ExportDialogProps) {
  const [sessoes, setSessoes] = useState<InventarioSessao[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  useEffect(() => {
    if (!open) return

    setSearchTerm('')
    setSelectedSessionId(null)
    setIsLoading(true)

    const carregarSessoes = async () => {
      try {
        const { data, error } = await supabase
          .from('inventario_sessoes')
          .select('*')
          .order('created_at', { ascending: false })

        if (error) throw error
        setSessoes((data || []) as InventarioSessao[])
      } catch (err: any) {
        toast.error('Não foi possível carregar os inventários: ' + (err.message || 'Tente novamente'))
      } finally {
        setIsLoading(false)
      }
    }

    void carregarSessoes()
  }, [open])

  const sessoesFiltradas = useMemo(() => {
    const termo = searchTerm.trim().toLowerCase()
    if (!termo) return sessoes

    return sessoes.filter((sessao) =>
      sessao.codigo.toLowerCase().includes(termo) ||
      sessao.titulo.toLowerCase().includes(termo),
    )
  }, [searchTerm, sessoes])

  const selectedSession = sessoes.find((sessao) => sessao.id === selectedSessionId) || null

  const gerarEbaixar = async () => {
    if (!selectedSession) {
      toast.error('Selecione um inventário específico para exportar')
      return
    }

    setIsExporting(true)
    try {
      const { data, error } = await supabase
        .from('inventario_lancamentos')
        .select('*')
        .eq('sessao_id', selectedSession.id)
        .order('created_at', { ascending: false })

      if (error) throw error

      const lancamentos = (data || []) as InventarioLancamento[]
      if (lancamentos.length === 0) {
        toast.error(`O inventário ${selectedSession.codigo} ainda não possui lançamentos`)
        return
      }

      const dadosExport = lancamentos.map((item) => ({
        'Data/Hora': format(new Date(item.created_at), 'dd/MM/yyyy HH:mm:ss', { locale: ptBR }),
        'Código do Inventário': selectedSession.codigo,
        'Título do Inventário': selectedSession.titulo,
        'Usuário / Operador': item.usuario || 'Usuário não identificado',
        EAN: item.ean,
        SKU: item.sku || '',
        Descrição: item.descricao || '',
        Lote: item.lote,
        Quantidade: Number(item.quantidade),
        Tratado: item.tratado ? 'Sim' : 'Não',
        'Tratado por': item.tratado_por || '',
        'Tratado em': item.tratado_at ? format(new Date(item.tratado_at), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : '',
      }))

      const worksheet = XLSX.utils.json_to_sheet(dadosExport)
      worksheet['!cols'] = [
        { wch: 20 },
        { wch: 24 },
        { wch: 32 },
        { wch: 24 },
        { wch: 16 },
        { wch: 14 },
        { wch: 42 },
        { wch: 14 },
        { wch: 12 },
        { wch: 10 },
        { wch: 24 },
        { wch: 18 },
      ]

      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Inventário')

      const codigoArquivo = sanitizarNomeArquivo(selectedSession.codigo)
      const tituloArquivo = sanitizarNomeArquivo(selectedSession.titulo)
      const nomeArquivo = `Inventario_${codigoArquivo}_${tituloArquivo}.xlsx`
      XLSX.writeFile(workbook, nomeArquivo)

      toast.success(`Inventário ${selectedSession.codigo} exportado com sucesso`)
      onOpenChange(false)
    } catch (err: any) {
      toast.error('Erro ao exportar inventário: ' + (err.message || 'Tente novamente'))
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl border-zinc-800 bg-[#111113] text-white">
        <DialogHeader>
          <DialogTitle className="text-xl">Exportar Relatório de Inventário (.xlsx)</DialogTitle>
          <DialogDescription className="text-zinc-400">
            Selecione uma única sala de inventário para gerar o relatório. A exportação consolidada geral não está disponível.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Buscar por código ATV-XXXX ou título da atividade"
              className="h-10 border-zinc-800 bg-zinc-950 pl-9 text-white placeholder:text-zinc-600 focus-visible:ring-[#e50914]"
              autoFocus
            />
          </div>

          <div className="max-h-[min(48vh,420px)] space-y-2 overflow-y-auto pr-1">
            {isLoading ? (
              <div className="flex items-center justify-center gap-2 py-12 text-sm text-zinc-500">
                <Loader2 className="h-4 w-4 animate-spin text-[#e50914]" />
                Carregando inventários…
              </div>
            ) : sessoesFiltradas.length === 0 ? (
              <div className="py-12 text-center text-sm text-zinc-500">
                Nenhuma sala de inventário encontrada.
              </div>
            ) : (
              sessoesFiltradas.map((sessao) => {
                const isSelected = selectedSessionId === sessao.id
                return (
                  <button
                    key={sessao.id}
                    type="button"
                    onClick={() => setSelectedSessionId(sessao.id)}
                    className={`w-full rounded-lg border p-3 text-left transition-colors ${
                      isSelected
                        ? 'border-[#e50914] bg-[#e50914]/10'
                        : 'border-zinc-800 bg-zinc-950 hover:border-[#e50914]/50 hover:bg-[#e50914]/5'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-sm font-bold text-[#e50914]">{sessao.codigo}</span>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                            sessao.status === 'em_andamento'
                              ? 'bg-green-500/10 text-green-400'
                              : 'bg-zinc-700/60 text-zinc-400'
                          }`}>
                            {statusLabel[sessao.status]}
                          </span>
                        </div>
                        <p className="mt-1 truncate text-sm font-semibold text-white">{sessao.titulo}</p>
                        <p className="mt-1 flex items-center gap-1.5 text-xs text-zinc-500">
                          <CalendarDays className="h-3.5 w-3.5" />
                          Criado em {format(new Date(sessao.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                        </p>
                      </div>
                      {isSelected && (
                        <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[#e50914] text-white">
                          <Check className="h-4 w-4" />
                        </span>
                      )}
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isExporting}
            className="border-zinc-700 text-zinc-300"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => void gerarEbaixar()}
            disabled={!selectedSession || isLoading || isExporting}
            className="gap-2 bg-[#e50914] text-white hover:bg-[#c4070f]"
          >
            {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Gerar e Baixar .xlsx
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}