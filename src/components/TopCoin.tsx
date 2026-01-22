import { TrendingUp, Crown } from 'lucide-react';
import { Position } from '@/hooks/usePaperTrading';

interface TopCoinProps {
  positions: Position[];
}

export const TopCoin = ({ positions }: TopCoinProps) => {
  if (positions.length === 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-card/50 border border-border">
        <Crown className="w-4 h-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">لا توجد صفقات مفتوحة</span>
      </div>
    );
  }

  // Find the position with highest profit percentage
  const topPosition = positions.reduce((best, current) => 
    current.pnlPercent > best.pnlPercent ? current : best
  , positions[0]);

  const isPositive = topPosition.pnlPercent >= 0;

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-md border ${
      isPositive 
        ? 'bg-terminal-green/10 border-terminal-green/30' 
        : 'bg-terminal-red/10 border-terminal-red/30'
    }`}>
      <Crown className={`w-4 h-4 ${isPositive ? 'text-terminal-green' : 'text-terminal-red'}`} />
      <span className="text-xs font-bold text-foreground">{topPosition.symbol}</span>
      <div className={`flex items-center gap-1 ${isPositive ? 'text-terminal-green' : 'text-terminal-red'}`}>
        <TrendingUp className={`w-3 h-3 ${!isPositive && 'rotate-180'}`} />
        <span className="text-xs font-mono font-bold">
          {isPositive ? '+' : ''}{topPosition.pnlPercent.toFixed(2)}%
        </span>
      </div>
    </div>
  );
};
