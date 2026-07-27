import { useState, useEffect, useRef } from 'react'
import { supabase, type Movimentacao } from '@/lib/supabase'
import { toast } from 'sonner'
import { ArrowDownCircle, ArrowUpCircle, CheckCircle2, Clock, AlertCircle } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import StatusBadge from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

const OPERADOR_KEY = 'inventario_operador'

export default function Bipagem() {
  const [codigoBarras, setCodigoBarras] = useState('')
  const [tipo, setTipo] = useState<'entrada' | 'saida'>('entrada')
  const [quantidade, setQuantidade] = useState('1')
  const [operador, setOperador] = useState('')
  const [observacao, setObservacao] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [ultimasBipagens, setUltimasBipagens] = useState<Movimentacao[]>([])
  const [isLoadingBipagens, setIsLoadingBipagens] = useState(true)
  const [configError, setConfigError] = useState<string | null>(null)
  
  const barcodeInputRef = useRef<HTMLInputElement>(null)
  const submitTimeoutRef = useRef<NodeJS.Timeout>()

  // Load operador from localStorage
  useEffect(() => {
    const savedOperador = localStorage.getItem(OPERADOR_KEY)
    if (savedOperador) {
      setOperador(savedOperador)
    }
  }, [])

  // Save operador to localStorage
  useEffect(() => {
    if (operador) {
      localStorage.setItem(OPERADOR_KEY, operador)
    }
  }, [operador])

  // Check Supabase config
  useEffect(() => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
    
    if (!supabaseUrl || !supabaseAnonKey) {
      setConfigError('Configuração incompleta. Defina as variáveis de ambiente VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.')
      setIsLoadingBipagens(false)
      return
    }
    
    setConfigError(null)
  }, [])

  // Load recent movements
  useEffect(() => {
    if (configError) return
    
    const loadRecentMovements = async () => {
      try {
        const { data, error } = await supabase
          .from('movimentacoes')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(10)
        
        if (error) throw error
        setUltimasBipagens(data || [])
      } catch (error: any) {
        console.error('Erro ao carregar movimentações:', error)
        toast.error('Erro ao carregar últimas bipagens')
      } finally {
        setIsLoadingBipagens(false)
      }
    }
    
    loadRecentMovements()
    
    // Subscribe to realtime changes
    const channel = supabase
      .channel('movimentacoes-changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'movimentacoes' },
        (payload) => {
          setUltimasBipagens((prev) => [payload.new as Movimentacao, ...prev].slice(0, 10))
        }
      )
      .subscribe()
    
    return () => {
      supabase.removeChannel(channel)
    }
  }, [configError])

  // Auto-focus barcode input
  useEffect(() => {
    barcodeInputRef.current?.focus()
  }, [])

  const handleBarcodeChange = (value: string) => {
    setCodigoBarras(value)
    
    // Clear existing timeout
    if (submitTimeoutRef.current) {
      clearTimeout(submitTimeoutRef.current)
    }
    
    // Set new timeout for auto-submit after 300ms of no input
    if (value.trim()) {
      submitTimeoutRef.current = setTimeout(() => {
        // Don't auto-submit, just keep it ready
      }, 300)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!codigoBarras.trim()) {
      toast.error('Digite o código de barras')
      barcodeInputRef.current?.focus()
      return
    }
    
    const qtd = Number(quantidade)
    if (isNaN(qtd) || qtd <= 0) {
      toast.error('Quantidade inválida')
      return
    }
    
    setIsSubmitting(true)
    
    try {
      const { error } = await supabase
        .from('movimentacoes')
        .insert({
          codigo_barras: codigoBarras.trim(),
          nome_produto: '', // Will be updated when product info is available
          tipo,
          quantidade: qtd,
          operador: operador || 'Sistema',
          observacao: observacao.trim(),
        })
      
      if (error) throw error
      
      toast.success(
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" />
          <span>Lançamento registrado com sucesso</span>
        </div>
      )
      
      // Reset form
      setCodigoBarras('')
      setQuantidade('1')
      setObservacao('')
      
      // Re-focus barcode input
      setTimeout(() => {
        barcodeInputRef.current?.focus()
      }, 100)
      
    } catch (error: any) {
      console.error('Erro ao registrar movimentação:', error)
      toast.error('Erro ao registrar lançamento: ' + (error.message || 'Erro desconhecido'))
    } finally {
      setIsSubmitting(false)
    }
  }

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
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Main Form */}
        <form onSubmit={handleSubmit} className="bg-card border border-card-border rounded-xl p-6 space-y-6">
          <div className="space-y-2">
            <Label htmlFor="barcode" className="text-base font-semibold">
              Código de Barras
            </Label>
            <Input
              ref={barcodeInputRef}
              id="barcode"
              type="text"
              placeholder="Bipagem de código de barras…"
              value={codigoBarras}
              onChange={(e) => handleBarcodeChange(e.target.value)}
              className="h-14 text-lg font-mono"
              autoComplete="off"
              data-testid="input-barcode"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-base font-semibold">Tipo de Movimentação</Label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setTipo('entrada')}
                className={`h-14 rounded-lg font-semibold text-base flex items-center justify-center gap-2 transition-all ${
                  tipo === 'entrada'
                    ? 'bg-green-600 text-white border-2 border-green-500'
                    : 'bg-card border-2 border-border hover:border-green-500/50'
                }`}
                data-testid="button-entrada"
              >
                <ArrowDownCircle className="h-5 w-5" />
                Entrada
              </button>
              <button
                type="button"
                onClick={() => setTipo('saida')}
                className={`h-14 rounded-lg font-semibold text-base flex items-center justify-center gap-2 transition-all ${
                  tipo === 'saida'
                    ? 'bg-red-600 text-white border-2 border-red-500'
                    : 'bg-card border-2 border-border hover:border-red-500/50'
                }`}
                data-testid="button-saida"
              >
                <ArrowUpCircle className="h-5 w-5" />
                Saída
              </button>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quantidade">Quantidade</Label>
              <Input
                id="quantidade"
                type="number"
                min="1"
                step="1"
                value={quantidade}
                onChange={(e) => setQuantidade(e.target.value)}
                className="h-12"
                data-testid="input-quantidade"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="operador">Operador</Label>
              <Input
                id="operador"
                type="text"
                placeholder="Seu nome"
                value={operador}
                onChange={(e) => setOperador(e.target.value)}
                className="h-12"
                data-testid="input-operador"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="observacao">Observação (opcional)</Label>
            <Textarea
              id="observacao"
              placeholder="Detalhes adicionais…"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              className="resize-none"
              rows={2}
              data-testid="input-observacao"
            />
          </div>

          <Button
            type="submit"
            size="lg"
            className="w-full h-14 text-base font-semibold"
            disabled={isSubmitting}
            data-testid="button-submit"
          >
            {isSubmitting ? 'Registrando...' : 'Confirmar Lançamento'}
          </Button>
        </form>

        {/* Recent Scans */}
        <div className="bg-card border border-card-border rounded-xl p-6">
          <h2 className="text-lg font-bold mb-4">Últimas Bipagens</h2>
          
          {isLoadingBipagens ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-20 bg-muted/50 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : ultimasBipagens.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">Nenhuma movimentação registrada ainda</p>
            </div>
          ) : (
            <div className="space-y-2">
              {ultimasBipagens.map((mov) => (
                <div
                  key={mov.id}
                  className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg border border-border hover:border-primary/30 transition-colors"
                  data-testid={`movement-${mov.id}`}
                >
                  <StatusBadge tipo={mov.tipo} />
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-sm font-medium truncate">{mov.codigo_barras}</p>
                    <p className="text-xs text-muted-foreground">
                      {mov.operador} • {mov.quantidade} un
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDistanceToNow(new Date(mov.created_at), { addSuffix: true, locale: ptBR })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
