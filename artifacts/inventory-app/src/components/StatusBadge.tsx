import { ArrowDownCircle, ArrowUpCircle } from 'lucide-react'

interface StatusBadgeProps {
  tipo: 'entrada' | 'saida'
}

export default function StatusBadge({ tipo }: StatusBadgeProps) {
  if (tipo === 'entrada') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-green-500/10 text-green-400 border border-green-500/20 text-xs font-semibold" data-testid={`badge-${tipo}`}>
        <ArrowDownCircle className="h-3.5 w-3.5" />
        Entrada
      </span>
    )
  }
  
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-500/10 text-red-400 border border-red-500/20 text-xs font-semibold" data-testid={`badge-${tipo}`}>
      <ArrowUpCircle className="h-3.5 w-3.5" />
      Saída
    </span>
  )
}
