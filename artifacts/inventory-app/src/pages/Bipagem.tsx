import { useState, useEffect, useRef, useCallback } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { supabase, type ProdutoBase, type InventarioLancamento } from '@/lib/supabase'
import { toast } from 'sonner'
import {
  Barcode,
  Camera,
  CameraOff,
  CheckCircle2,
  Clock,
  AlertCircle,
  PackageSearch,
  Package,
  X,
  Search,
  Loader2,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// ─── Áudio de sucesso via Web Audio API ───────────────────────────────────────
function playBeep() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(1400, ctx.currentTime)
    gain.gain.setValueAtTime(0.25, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.18)
  } catch {
    // silently ignore in environments without AudioContext
  }
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function Bipagem() {
  // Campos do formulário
  const [ean, setEan] = useState('')
  const [lote, setLote] = useState('')
  const [quantidade, setQuantidade] = useState('')

  // Estado de busca de produto
  const [isBuscando, setIsBuscando] = useState(false)
  const [produtoBase, setProdutoBase] = useState<ProdutoBase | null>(null)
  const [produtoNaoEncontrado, setProdutoNaoEncontrado] = useState(false)
  const [descricaoManual, setDescricaoManual] = useState('')
  const [skuManual, setSkuManual] = useState('')

  // Câmera
  const [cameraAberta, setCameraAberta] = useState(false)
  const html5QrcodeRef = useRef<Html5Qrcode | null>(null)

  // Últimos lançamentos
  const [ultimosLancamentos, setUltimosLancamentos] = useState<InventarioLancamento[]>([])
  const [isLoadingLancamentos, setIsLoadingLancamentos] = useState(true)

  // Estado de envio
  const [isSalvando, setIsSalvando] = useState(false)

  // Refs
  const eanInputRef = useRef<HTMLInputElement>(null)
  const buscarProdutoRef = useRef<(eanValue: string) => void>(() => {})

  // ─── Auto-foco ────────────────────────────────────────────────────────────────
  useEffect(() => {
    eanInputRef.current?.focus()
  }, [])

  // ─── Carregar e assinar últimos lançamentos ───────────────────────────────────
  useEffect(() => {
    const carregarLancamentos = async () => {
      try {
        const { data, error } = await supabase
          .from('inventario_lancamentos')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(8)
        if (error) throw error
        setUltimosLancamentos(data || [])
      } catch (err: any) {
        console.error('Erro ao carregar lançamentos:', err)
      } finally {
        setIsLoadingLancamentos(false)
      }
    }

    carregarLancamentos()

    const channel = supabase
      .channel('inventario-lancamentos-changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'inventario_lancamentos' },
        (payload) => {
          setUltimosLancamentos((prev) =>
            [payload.new as InventarioLancamento, ...prev].slice(0, 8)
          )
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // ─── Buscar produto na tabela produtos_base ───────────────────────────────────
  const buscarProduto = useCallback(async (eanValue: string) => {
    const eanLimpo = eanValue.trim()
    if (!eanLimpo) return

    setIsBuscando(true)
    setProdutoBase(null)
    setProdutoNaoEncontrado(false)
    setDescricaoManual('')
    setSkuManual('')

    try {
      const { data, error } = await supabase
        .from('produtos_base')
        .select('*')
        .eq('ean', eanLimpo)
        .maybeSingle()

      if (error) throw error

      if (data) {
        setProdutoBase(data)
        setProdutoNaoEncontrado(false)
      } else {
        setProdutoBase(null)
        setProdutoNaoEncontrado(true)
      }
    } catch (err: any) {
      console.error('Erro ao buscar produto:', err)
      toast.error('Erro ao buscar produto: ' + (err.message || 'Tente novamente'))
    } finally {
      setIsBuscando(false)
    }
  }, [])

  // mantém ref sincronizada para uso no useEffect da câmera
  useEffect(() => {
    buscarProdutoRef.current = buscarProduto
  }, [buscarProduto])

  // ─── Câmera: iniciar/parar via useEffect ──────────────────────────────────────
  useEffect(() => {
    if (!cameraAberta) return

    let scanner: Html5Qrcode | null = null

    const iniciarScanner = async () => {
      try {
        scanner = new Html5Qrcode('qr-reader-container')
        html5QrcodeRef.current = scanner
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 260, height: 100 } },
          (decodedText) => {
            setEan(decodedText)
            setCameraAberta(false)
            buscarProdutoRef.current(decodedText)
          },
          undefined
        )
      } catch (err: any) {
        console.error('Erro ao iniciar câmera:', err)
        toast.error('Não foi possível acessar a câmera. Verifique as permissões.')
        setCameraAberta(false)
      }
    }

    // pequeno delay para o DOM renderizar o container
    const timer = setTimeout(iniciarScanner, 150)

    return () => {
      clearTimeout(timer)
      if (scanner?.isScanning) {
        scanner.stop().catch(() => {})
      }
      html5QrcodeRef.current = null
    }
  }, [cameraAberta])

  const fecharCamera = useCallback(async () => {
    if (html5QrcodeRef.current?.isScanning) {
      try {
        await html5QrcodeRef.current.stop()
      } catch {
        // ignora erros de parada
      }
    }
    html5QrcodeRef.current = null
    setCameraAberta(false)
    setTimeout(() => eanInputRef.current?.focus(), 100)
  }, [])

  // ─── Tecla Enter no campo EAN ─────────────────────────────────────────────────
  const handleEanKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      buscarProduto(ean)
    }
  }

  // ─── Salvar lançamento ────────────────────────────────────────────────────────
  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault()

    const eanLimpo = ean.trim()
    const loteLimpo = lote.trim()
    const qtd = Number(quantidade)

    if (!eanLimpo) {
      toast.error('Digite ou bipe o código EAN')
      eanInputRef.current?.focus()
      return
    }
    if (!produtoBase && !produtoNaoEncontrado) {
      toast.error('Faça a busca do produto antes de salvar (pressione Enter no campo EAN)')
      eanInputRef.current?.focus()
      return
    }
    if (produtoNaoEncontrado && !descricaoManual.trim()) {
      toast.error('Preencha a Descrição do produto manualmente')
      return
    }
    if (!loteLimpo) {
      toast.error('Campo Lote é obrigatório')
      return
    }
    if (isNaN(qtd) || qtd <= 0) {
      toast.error('Quantidade deve ser maior que zero')
      return
    }

    const descricao = produtoBase ? produtoBase.descricao : descricaoManual.trim()
    const sku = produtoBase ? produtoBase.sku : skuManual.trim()

    setIsSalvando(true)
    try {
      const { error } = await supabase.from('inventario_lancamentos').insert({
        ean: eanLimpo,
        sku,
        descricao,
        lote: loteLimpo,
        quantidade: qtd,
      })

      if (error) throw error

      playBeep()
      toast.success(
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-green-400" />
          <span>Lançamento salvo com sucesso!</span>
        </div>,
        { duration: 2500 }
      )

       // Limpa todos os campos para a próxima contagem
      setEan('')
       setLote('')
      setProdutoBase(null)
      setProdutoNaoEncontrado(false)
      setDescricaoManual('')
      setSkuManual('')
      setQuantidade('')

      setTimeout(() => eanInputRef.current?.focus(), 80)
    } catch (err: any) {
      console.error('Erro ao salvar lançamento:', err)
      toast.error('Erro ao salvar: ' + (err.message || 'Tente novamente'))
    } finally {
      setIsSalvando(false)
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-[calc(100vh-4rem)] p-3 pb-10">
      <div className="w-full max-w-4xl mx-auto space-y-4">

        {/* ── Modal câmera ─────────────────────────────────────────────────── */}
        {cameraAberta && (
          <div className="fixed inset-0 z-50 flex flex-col bg-black">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <div className="flex items-center gap-2 text-white font-semibold">
                <Camera className="h-5 w-5 text-primary" />
                Aponte para o código de barras
              </div>
              <button
                type="button"
                onClick={fecharCamera}
                className="text-white/70 hover:text-white transition-colors p-1"
                data-testid="button-fechar-camera"
                aria-label="Fechar câmera"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="flex-1 flex items-center justify-center overflow-hidden">
              <div
                id="qr-reader-container"
                className="w-full max-w-sm"
                style={{ minHeight: 300 }}
              />
            </div>

            <div className="px-4 py-4 text-center text-sm text-white/50">
              Posicione o código EAN dentro da área de leitura
            </div>
          </div>
        )}

        {/* ── Formulário principal ──────────────────────────────────────────── */}
        <form
          onSubmit={handleSalvar}
          className="bg-card border border-card-border rounded-xl p-5 space-y-5"
        >
          {/* Campo EAN */}
          <div className="space-y-2">
            <Label htmlFor="ean" className="text-sm font-semibold text-foreground/80 uppercase tracking-wide">
              Código EAN
            </Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
                <Input
                  ref={eanInputRef}
                  id="ean"
                  type="text"
                  inputMode="numeric"
                  placeholder="Bipe ou digite o código EAN…"
                  value={ean}
                  onChange={(e) => {
                    setEan(e.target.value)
                    // Limpa resultado anterior ao editar
                    if (produtoBase || produtoNaoEncontrado) {
                      setProdutoBase(null)
                      setProdutoNaoEncontrado(false)
                    }
                  }}
                  onKeyDown={handleEanKeyDown}
                  className="h-14 pl-10 pr-4 text-lg font-mono tracking-widest input-red-focus"
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  data-testid="input-ean"
                />
              </div>
              {/* Botão busca manual */}
              <button
                type="button"
                onClick={() => buscarProduto(ean)}
                disabled={isBuscando || !ean.trim()}
                className="h-14 w-14 flex items-center justify-center rounded-lg bg-[#e50914]/10 border border-[#e50914]/30 hover:bg-[#e50914]/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 hover:shadow-[0_0_12px_rgba(229,9,20,0.3)] flex-shrink-0"
                data-testid="button-buscar-ean"
                title="Buscar produto (Enter)"
              >
                {isBuscando ? (
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                ) : (
                  <Search className="h-5 w-5 text-primary" />
                )}
              </button>
              {/* Botão câmera */}
              <button
                type="button"
                onClick={() => setCameraAberta(true)}
                className="h-14 w-14 flex items-center justify-center rounded-lg bg-zinc-900 border border-zinc-700 hover:border-zinc-500 hover:bg-zinc-800 transition-all duration-200 flex-shrink-0"
                data-testid="button-camera"
                title="Ativar câmera"
              >
                <Camera className="h-5 w-5 text-zinc-400" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Pressione <kbd className="bg-muted px-1 py-0.5 rounded text-xs">Enter</kbd> ou clique em{' '}
              <Search className="inline h-3 w-3" /> para buscar o produto
            </p>
          </div>

          {/* ── Resultado da busca ────────────────────────────────────────── */}

          {/* Produto encontrado */}
          {produtoBase && (
            <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-4 space-y-3">
              <div className="flex items-center gap-2 text-green-400 font-semibold text-sm">
                <CheckCircle2 className="h-4 w-4" />
                Produto encontrado
              </div>
              <div className="grid sm:grid-cols-3 gap-3">
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                    Descrição
                  </Label>
                  <Input
                    value={produtoBase.descricao}
                    disabled
                    className="h-10 bg-muted/40 text-foreground opacity-80 cursor-not-allowed"
                    data-testid="input-descricao"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                    SKU
                  </Label>
                  <Input
                    value={produtoBase.sku}
                    disabled
                    className="h-10 bg-muted/40 font-mono text-foreground opacity-80 cursor-not-allowed"
                    data-testid="input-sku"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Produto não encontrado */}
          {produtoNaoEncontrado && (
            <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4 space-y-3">
              <div className="flex items-center gap-2 text-yellow-400 font-semibold text-sm">
                <AlertCircle className="h-4 w-4" />
                Produto não cadastrado — preencha manualmente
              </div>
              <div className="grid sm:grid-cols-3 gap-3">
                <div className="space-y-1 sm:col-span-2">
                  <Label htmlFor="descricao-manual" className="text-xs text-muted-foreground uppercase tracking-wide">
                    Descrição <span className="text-red-400">*</span>
                  </Label>
                  <Input
                    id="descricao-manual"
                    value={descricaoManual}
                    onChange={(e) => setDescricaoManual(e.target.value)}
                    placeholder="Descrição do produto"
                    className="h-10"
                    data-testid="input-descricao-manual"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="sku-manual" className="text-xs text-muted-foreground uppercase tracking-wide">
                    SKU
                  </Label>
                  <Input
                    id="sku-manual"
                    value={skuManual}
                    onChange={(e) => setSkuManual(e.target.value)}
                    placeholder="SKU / Referência"
                    className="h-10 font-mono"
                    data-testid="input-sku-manual"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── Lote e Quantidade ─────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="lote" className="text-sm font-semibold text-foreground/80 uppercase tracking-wide">
                Lote <span className="text-red-400">*</span>
              </Label>
              <Input
                id="lote"
                type="text"
                placeholder="Ex: L2024-001"
                value={lote}
                onChange={(e) => setLote(e.target.value)}
                className="h-12 font-mono tracking-wider"
                autoComplete="off"
                data-testid="input-lote"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quantidade" className="text-sm font-semibold text-foreground/80 uppercase tracking-wide">
                Quantidade <span className="text-red-400">*</span>
              </Label>
              <Input
                id="quantidade"
                type="number"
                inputMode="numeric"
                min="1"
                step="1"
                value={quantidade}
                onChange={(e) => setQuantidade(e.target.value)}
                className="h-12 text-center text-lg font-semibold"
                data-testid="input-quantidade"
              />
            </div>
          </div>

          {/* ── Botão salvar ───────────────────────────────────────────────── */}
          <Button
            type="submit"
            size="lg"
            className="w-full h-14 text-base font-bold tracking-wide bg-[#e50914] hover:bg-[#c4070f] text-white border-0 hover:shadow-[0_0_20px_rgba(229,9,20,0.45)] transition-all duration-200"
            disabled={isSalvando}
            data-testid="button-salvar"
          >
            {isSalvando ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                Salvando…
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Salvar Lançamento
              </span>
            )}
          </Button>
        </form>

        {/* ── Últimos lançamentos ───────────────────────────────────────────── */}
        <div className="bg-card border border-card-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
              Últimos Lançamentos
            </h2>
          </div>

          {isLoadingLancamentos ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-16 bg-muted/40 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : ultimosLancamentos.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <PackageSearch className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nenhum lançamento registrado ainda</p>
            </div>
          ) : (
            <div className="space-y-2">
              {ultimosLancamentos.map((lanc) => (
                <div
                  key={lanc.id}
                  className="flex items-center gap-3 p-3 bg-muted/20 rounded-lg border border-border/50 hover:border-primary/20 transition-colors"
                  data-testid={`lancamento-${lanc.id}`}
                >
                  <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Package className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-mono text-xs font-semibold text-foreground">
                        {lanc.ean}
                      </p>
                      {lanc.sku && (
                        <span className="text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground font-mono flex-shrink-0">
                          {lanc.sku}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-foreground/90 leading-relaxed break-words">
                      {lanc.descricao || '—'}
                    </p>
                    <p className="text-xs text-muted-foreground/70">
                      Lote: <span className="font-mono text-foreground/60">{lanc.lote}</span>
                      {' · '}
                      <span className="font-semibold text-foreground/70">{lanc.quantidade} un</span>
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground/60 whitespace-nowrap flex-shrink-0">
                    {formatDistanceToNow(new Date(lanc.created_at), {
                      addSuffix: true,
                      locale: ptBR,
                    })}
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
