import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import Header from '@/components/Header'
import Bipagem from '@/pages/Bipagem'
import Acompanhamento from '@/pages/Acompanhamento'

const queryClient = new QueryClient()

type Tab = 'bipagem' | 'acompanhamento'

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('bipagem')

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="min-h-[100dvh] bg-background text-foreground">
          <Header activeTab={activeTab} onTabChange={setActiveTab} />
          
          <main>
            {activeTab === 'bipagem' && <Bipagem />}
            {activeTab === 'acompanhamento' && <Acompanhamento />}
          </main>
        </div>
        
        <Toaster 
          position="top-center" 
          theme="dark"
          toastOptions={{
            style: {
              background: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              color: 'hsl(var(--foreground))',
            },
          }}
        />
      </TooltipProvider>
    </QueryClientProvider>
  )
}

export default App
