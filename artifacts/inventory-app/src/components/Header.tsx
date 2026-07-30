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
  userName: string
  onUserNameChange: (value: string) => void
}

export default function Header({
  activeView,
  onBack,
  activeSession,
  onSessionClick,
  userName,
  onUserNameChange,
}: HeaderProps) {
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

        <div className="absolute right-3 flex items-center gap-2">
          <label className="hidden text-[10px] font-semibold uppercase tracking-wide text-zinc-500 lg:block" htmlFor="nome-usuario">
            Nome do Usuário
          </label>
          <input
            id="nome-usuario"
            required
            value={userName}
            onChange={(event) => onUserNameChange(event.target.value)}
            placeholder="Nome do Usuário"
            aria-label="Nome do Usuário"
            className="h-9 w-[118px] rounded-lg border border-zinc-800 bg-zinc-950/90 px-2 text-[11px] text-white outline-none transition-colors placeholder:text-zinc-600 focus:border-[#e50914] focus:ring-1 focus:ring-[#e50914]/40 sm:w-[190px] sm:px-2.5 sm:text-xs"
          />
          {!isHome && (
            <button
              type="button"
              onClick={onSessionClick}
              className="flex max-w-[115px] items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950/70 px-2.5 py-1.5 text-left transition-colors hover:border-[#e50914]/50 sm:max-w-[210px]"
              title="Trocar sessão ativa"
            >
              <span className="hidden text-[10px] uppercase tracking-wide text-zinc-500 xl:block">
                {VIEW_LABELS[activeView as Exclude<View, 'home'>]}
              </span>
              <span className="truncate font-mono text-xs font-bold text-[#e50914]">
                {activeSession?.codigo || 'Selecionar sala'}
              </span>
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
