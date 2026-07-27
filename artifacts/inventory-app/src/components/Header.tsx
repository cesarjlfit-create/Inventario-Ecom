import { Barcode, Activity } from 'lucide-react'
import { motion } from 'framer-motion'

type Tab = 'bipagem' | 'acompanhamento'

interface HeaderProps {
  activeTab: Tab
  onTabChange: (tab: Tab) => void
}

export default function Header({ activeTab, onTabChange }: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="flex h-16 items-center px-4">
        <div className="flex items-center gap-2 mr-6">
          <Barcode className="h-6 w-6 text-primary" />
          <h1 className="text-lg font-bold tracking-tight">InventárioApp</h1>
        </div>
        
        <div className="flex items-center gap-2 flex-1">
          <button
            onClick={() => onTabChange('bipagem')}
            className="relative flex items-center gap-2 px-4 h-10 rounded-lg font-medium transition-colors text-sm"
            data-testid="tab-bipagem"
          >
            <Barcode className="h-4 w-4" />
            <span>Bipagem</span>
            {activeTab === 'bipagem' && (
              <motion.div
                layoutId="activeTab"
                className="absolute inset-0 bg-primary/10 rounded-lg border border-primary/20"
                transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
              />
            )}
          </button>
          
          <button
            onClick={() => onTabChange('acompanhamento')}
            className="relative flex items-center gap-2 px-4 h-10 rounded-lg font-medium transition-colors text-sm"
            data-testid="tab-acompanhamento"
          >
            <Activity className="h-4 w-4" />
            <span>Acompanhamento</span>
            {activeTab === 'acompanhamento' && (
              <motion.div
                layoutId="activeTab"
                className="absolute inset-0 bg-primary/10 rounded-lg border border-primary/20"
                transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
              />
            )}
          </button>
        </div>
      </div>
    </header>
  )
}
