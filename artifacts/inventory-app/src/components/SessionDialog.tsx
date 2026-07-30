import { useEffect, useMemo, useState } from 'react'
import { DoorOpen, Loader2, Plus, RefreshCw, Search, Users } from 'lucide-react'
import { toast } from 'sonner'
import { supabase, type InventarioSessao } from '@/lib/supabase'
import { gerarCodigoSala } from '@/lib/inventory-sessions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type SessionMode = 'create' | 'join'

interface SessionDialogProps {
  open: boolean
  initialMode?: SessionMode
  onOpenChange: (open: boolean) => void
  onSessionSelected: (session: InventarioSessao) => void
}

export default function SessionDialog({
  open,
  initialMode = 'create',
  onOpenChange,
  onSessionSelected,
}: SessionDialogProps) {
  const [mode, setMode] = useState<SessionMode>(initialMode)
  const [titulo, setTitulo] = useState('')
  const [codigoBusca, setCodigoBusca] = useState('')
  const [sessoes, setSessoes] = useState<InventarioSessao[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setMode(initialMode)
      setTitulo('')
      setCodigoBusca('')
    }
  }, [open, initialMode])

  const carregarSessoes = async () => {
    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from('inventario_sessoes')
        .select('*')
        .eq('status', 'em_andamento')
        .order('created_at', { ascending: false })

      if (error) throw error
      setSessoes((data || []) as InventarioSessao[])
    } catch (error: any) {
      toast.error('Não foi possível carregar as salas: ' + (error.message || 'verifique a tabela inventario_sessoes'))
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (open && mode === 'join') void carregarSessoes()
  }, [open, mode])

  const sessoesFiltradas = useMemo(() => {
    const termo = codigoBusca.trim().toLowerCase()
    if (!termo) return sessoes
    return sessoes.filter(
      (session) =>
        session.codigo.toLowerCase().includes(termo) ||
        session.titulo.toLowerCase().includes(termo),
    )
  }, [codigoBusca, sessoes])

  const criarSala = async (event: React.FormEvent) => {
    event.preventDefault()
    const tituloLimpo = titulo.trim()
    if (!tituloLimpo) {
      toast.error('Digite o título do inventário')
      return
    }

    setIsSaving(true)
    try {
      let criada: InventarioSessao | null = null

      for (let attempt = 0; attempt < 3 && !criada; attempt += 1) {
        const { data, error } = await supabase
          .from('inventario_sessoes')
          .insert({
            codigo: gerarCodigoSala(),
            titulo: tituloLimpo,
            status: 'em_andamento',
          })
          .select('*')
          .single()

        if (!error) {
          criada = data as InventarioSessao
          break
        }

        if (!error.message.toLowerCase().includes('duplicate')) throw error
      }

      if (!criada) throw new Error('Não foi possível gerar um código de sala único')
      toast.success(`Sala ${criada.codigo} criada com sucesso`)
      onSessionSelected(criada)
    } catch (error: any) {
      toast.error('Erro ao criar inventário: ' + (error.message || 'Tente novamente'))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-[#111113] border-zinc-800 text-white">
        <DialogHeader>
          <DialogTitle className="text-xl">Sessão de Inventário</DialogTitle>
          <DialogDescription className="text-zinc-400">
            Crie uma sala nova ou entre em um inventário que já está em andamento.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2 rounded-lg bg-zinc-950 p-1">
          <button
            type="button"
            onClick={() => setMode('create')}
            className={`flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              mode === 'create' ? 'bg-[#e50914] text-white' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Plus className="h-4 w-4" />
            Criar novo
          </button>
          <button
            type="button"
            onClick={() => setMode('join')}
            className={`flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              mode === 'join' ? 'bg-[#e50914] text-white' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <DoorOpen className="h-4 w-4" />
            Entrar em uma sala
          </button>
        </div>

        {mode === 'create' ? (
          <form onSubmit={criarSala} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="titulo-inventario">Título do Inventário</Label>
              <Input
                id="titulo-inventario"
                value={titulo}
                onChange={(event) => setTitulo(event.target.value)}
                placeholder="Ex: Inventário Geral Julho/2026"
                autoFocus
                className="bg-zinc-950 border-zinc-800 input-red-focus"
              />
            </div>
            <Button
              type="submit"
              disabled={isSaving}
              className="w-full bg-[#e50914] hover:bg-[#c4070f] text-white"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Criar Novo Inventário
            </Button>
          </form>
        ) : (
          <div className="space-y-3 pt-2">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <Input
                  value={codigoBusca}
                  onChange={(event) => setCodigoBusca(event.target.value.toUpperCase())}
                  placeholder="Buscar ATV-XXXX ou título"
                  className="pl-9 bg-zinc-950 border-zinc-800 input-red-focus"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => void carregarSessoes()}
                disabled={isLoading}
                className="border-zinc-700"
                title="Atualizar salas"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>

            <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
              {isLoading ? (
                <div className="flex items-center justify-center gap-2 py-8 text-sm text-zinc-500">
                  <Loader2 className="h-4 w-4 animate-spin" /> Carregando salas…
                </div>
              ) : sessoesFiltradas.length === 0 ? (
                <div className="py-8 text-center text-sm text-zinc-500">
                  <Users className="mx-auto mb-2 h-7 w-7 opacity-50" />
                  Nenhuma sala em andamento encontrada.
                </div>
              ) : (
                sessoesFiltradas.map((session) => (
                  <button
                    key={session.id}
                    type="button"
                    onClick={() => onSessionSelected(session)}
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-left transition-colors hover:border-[#e50914]/60 hover:bg-[#e50914]/5"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-mono text-sm font-bold text-[#e50914]">{session.codigo}</span>
                      <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-green-400">
                        Em andamento
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-white">{session.titulo}</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      Criado em {new Date(session.created_at).toLocaleString('pt-BR')}
                    </p>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}