import { useState } from 'react'
import * as XLSX from 'xlsx'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster, toast } from 'sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Barcode, Activity, FileDown, Loader2 } from 'lucide-react'
import { motion } from 'framer-motion'
import Header from '@/components/Header'
import Bipagem from '@/pages/Bipagem'
import Acompanhamento from '@/pages/Acompanhamento'
import { supabase } from '@/lib/supabase'

const queryClient = new QueryClient()

export type View = 'home' | 'bipagem' | 'acompanhamento'

// ─── Nav cards definition ────────────────────────────────────────────────────
const NAV_CARDS = [
  {
    id: 'bipagem' as const,
    title: 'Bipagem / Entrada',
    description: 'Registre produtos por código EAN ou câmera',
    icon: Barcode,
  },
  {
    id: 'acompanhamento' as const,
    title: 'Acompanhamento Realtime',
    description: 'Visualize e edite lançamentos em tempo real',
    icon: Activity,
  },
] as const

// ─── Home screen ─────────────────────────────────────────────────────────────
function HomeScreen({ onNavigate }: { onNavigate: (view: View) => void }) {
  const [isExporting, setIsExporting] = useState(false)

  const exportarTodos = async () => {
    setIsExporting(true)
    try {
      const { data, error } = await supabase
        .from('inventario_lancamentos')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      if (!data || data.length === 0) {
        toast.error('Nenhum lançamento para exportar')
        return
      }

      const dadosExport = data.map((l) => ({
        'Data/Hora': format(new Date(l.created_at), 'dd/MM/yyyy HH:mm:ss', { locale: ptBR }),
        EAN: l.ean,
        SKU: l.sku || '',
        Descrição: l.descricao || '',
        Lote: l.lote,
        Quantidade: Number(l.quantidade),
      }))

      const ws = XLSX.utils.json_to_sheet(dadosExport)
      ws['!cols'] = [
        { wch: 20 }, { wch: 16 }, { wch: 14 }, { wch: 36 }, { wch: 14 }, { wch: 12 },
      ]
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Inventário')
      const nomeArquivo = `inventario_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`
      XLSX.writeFile(wb, nomeArquivo)
      toast.success(`"${nomeArquivo}" baixado com sucesso — ${data.length} registros`)
    } catch (err: any) {
      toast.error('Erro ao exportar: ' + (err.message || 'Tente novamente'))
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="min-h-[calc(100dvh-3.5rem)] flex flex-col items-center justify-center px-4 py-12">
      {/* Hero text */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="text-center mb-10 space-y-2"
      >
        <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
          Controle de Inventário
        </h2>
        <p className="text-sm text-zinc-500">Selecione uma opção para continuar</p>
      </motion.div>

      {/* Nav cards */}
      <div className="w-full max-w-lg space-y-3">
        {NAV_CARDS.map((card, i) => {
          const Icon = card.icon
          return (
            <motion.button
              key={card.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              onClick={() => onNavigate(card.id)}
              className="group w-full flex items-center gap-4 bg-zinc-900 border border-zinc-800 rounded-xl p-5
                         hover:border-[#e50914]/60 hover:bg-zinc-900/90 transition-all duration-200
                         hover:shadow-[0_0_20px_rgba(229,9,20,0.18)] text-left"
            >
              <div className="flex-shrink-0 h-12 w-12 rounded-xl bg-[#e50914]/10 border border-[#e50914]/20 flex items-center justify-center
                              group-hover:bg-[#e50914]/20 group-hover:border-[#e50914]/40 transition-all duration-200">
                <Icon className="h-6 w-6 text-[#e50914]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-base font-semibold text-white">{card.title}</p>
                <p className="text-xs text-zinc-500 mt-0.5">{card.description}</p>
              </div>
              <div className="flex-shrink-0 h-8 w-8 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center
                              group-hover:bg-[#e50914] group-hover:border-[#e50914] transition-all duration-200">
                <svg className="h-3.5 w-3.5 text-zinc-400 group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </motion.button>
          )
        })}

        {/* Export card — action, not navigation */}
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: NAV_CARDS.length * 0.08 }}
          onClick={exportarTodos}
          disabled={isExporting}
          className="group w-full flex items-center gap-4 bg-zinc-900 border border-zinc-800 rounded-xl p-5
                     hover:border-[#e50914]/60 hover:bg-zinc-900/90 transition-all duration-200
                     hover:shadow-[0_0_20px_rgba(229,9,20,0.18)] text-left
                     disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <div className="flex-shrink-0 h-12 w-12 rounded-xl bg-[#e50914]/10 border border-[#e50914]/20 flex items-center justify-center
                          group-hover:bg-[#e50914]/20 group-hover:border-[#e50914]/40 transition-all duration-200">
            {isExporting ? (
              <Loader2 className="h-6 w-6 text-[#e50914] animate-spin" />
            ) : (
              <FileDown className="h-6 w-6 text-[#e50914]" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-base font-semibold text-white">Exportar Relatório Excel</p>
            <p className="text-xs text-zinc-500 mt-0.5">Baixe todos os lançamentos em .xlsx</p>
          </div>
          <div className="flex-shrink-0 h-8 w-8 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center
                          group-hover:bg-[#e50914] group-hover:border-[#e50914] transition-all duration-200">
            <svg className="h-3.5 w-3.5 text-zinc-400 group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
            </svg>
          </div>
        </motion.button>
      </div>
    </div>
  )
}

// ─── Root ─────────────────────────────────────────────────────────────────────
function App() {
  const [activeView, setActiveView] = useState<View>('home')

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="min-h-[100dvh] bg-[#0a0a0a] text-white">
          <Header activeView={activeView} onBack={() => setActiveView('home')} />

          <main>
            {activeView === 'home' && (
              <HomeScreen onNavigate={setActiveView} />
            )}
            {activeView === 'bipagem' && <Bipagem />}
            {activeView === 'acompanhamento' && <Acompanhamento />}
          </main>
        </div>

        <Toaster
          position="top-center"
          theme="dark"
          toastOptions={{
            style: {
              background: '#111113',
              border: '1px solid #27272a',
              color: '#ffffff',
            },
          }}
        />
      </TooltipProvider>
    </QueryClientProvider>
  )
}

export default App
