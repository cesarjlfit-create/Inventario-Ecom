import { ChevronLeft } from 'lucide-react'

type View = 'home' | 'bipagem' | 'acompanhamento'

const VIEW_LABELS: Record<Exclude<View, 'home'>, string> = {
  bipagem: 'Bipagem / Entrada',
  acompanhamento: 'Acompanhamento',
}

interface HeaderProps {
  activeView: View
  onBack: () => void
}

export default function Header({ activeView, onBack }: HeaderProps) {
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
            className="h-7 w-auto object-contain"
            draggable={false}
          />
        </div>

        {/* Section label — right side on mobile, shown only inside sections */}
        {!isHome && (
          <span className="absolute right-4 text-xs text-zinc-500 hidden sm:block truncate max-w-[140px]">
            {VIEW_LABELS[activeView as Exclude<View, 'home'>]}
          </span>
        )}
      </div>
    </header>
  )
}
