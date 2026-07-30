import { ChevronLeft } from 'lucide-react'
import type { InventarioSessao } from '@/lib/supabase'

type View = 'home' | 'bipagem' | 'acompanhamento'

const VIEW_LABELS: Record<Exclude<View, 'home'>, string> = {
  bipagem: 'Bipagem / Entrada',
  acompanhamento: 'Acompanhamento',
}

interface HeaderProps {
  activeView: View
  onBack: () => void
  activeSession: InventarioSessao | null
  onSessionClick: () => void
}

export default function Header({ activeView, onBack, activeSession, onSessionClick }: HeaderProps) {
  const isHome = activeView === 'home'

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/5 bg-black/80 backdrop-blur-md supports-[backdrop-filter]:bg-black/60">
      <div className="relative flex h-14 items-center justify-center px-4">

        {/* Back button — only shown inside a section */}
        {!isHome && (
          <button
            onClick={onBack}
            className="absolute left-3 flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white transition-colors px-2 py-1.5 rounded-lg hover:bg-white/5"
            aria-label="Voltar ao início"
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Início</span>
          </button>
        )}

        {/* Logo — always centered */}
        <div className="select-none">
          <img
            src="/fitoway-logo.png"
            alt="Fitoway"
            className="h-[42px] w-auto object-contain"
            draggable={false}
          />
        </div>

        {/* Section label — right side on mobile, shown only inside sections */}
        {!isHome && (
          <button
            type="button"
            onClick={onSessionClick}
            className="absolute right-3 flex max-w-[210px] items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950/70 px-2.5 py-1.5 text-left transition-colors hover:border-[#e50914]/50"
            title="Trocar sessão ativa"
          >
            <span className="hidden text-[10px] uppercase tracking-wide text-zinc-500 sm:block">
              {VIEW_LABELS[activeView as Exclude<View, 'home'>]}
            </span>
            <span className="truncate font-mono text-xs font-bold text-[#e50914]">
              {activeSession?.codigo || 'Selecionar sala'}
            </span>
          </button>
        )}
      </div>
    </header>
  )
}
