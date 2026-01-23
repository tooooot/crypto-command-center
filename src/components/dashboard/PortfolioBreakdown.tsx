import { TrendingUp, TrendingDown, Wallet, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StrategyPortfolio {
  id: string;
  label: string;
  balance: number;
  openPositionsValue: number;
  totalPortfolio: number;
  pnl: number;
  roi: number;
  trades: number;
  winRate: number;
  isExperimental: boolean;
}

interface PortfolioBreakdownProps {
  strategies: StrategyPortfolio[];
  totalCapital: number;
}

export const PortfolioBreakdown = ({ strategies, totalCapital }: PortfolioBreakdownProps) => {
  const totalPnL = strategies.reduce((sum, s) => sum + s.pnl, 0);
  const totalROI = totalCapital > 0 ? ((strategies.reduce((sum, s) => sum + s.totalPortfolio, 0) - totalCapital) / totalCapital) * 100 : 0;

  return (
    <div className="bg-card/50 rounded-2xl border border-border/50 backdrop-blur-sm overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border/50 bg-secondary/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-terminal-amber" />
            <span className="font-bold text-foreground">توزيع الأرباح حسب الاستراتيجية</span>
          </div>
          <div className={cn(
            "flex items-center gap-1 text-sm font-bold",
            totalPnL >= 0 ? "text-terminal-green" : "text-terminal-red"
          )}>
            {totalPnL >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            <span>{totalPnL >= 0 ? '+' : ''}{totalROI.toFixed(2)}%</span>
          </div>
        </div>
      </div>

      {/* Strategy Rows */}
      <div className="divide-y divide-border/30">
        {strategies.map((strategy) => {
          const isPositive = strategy.pnl >= 0;
          
          return (
            <div key={strategy.id} className="p-3 hover:bg-secondary/20 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "font-bold text-sm",
                    strategy.isExperimental ? "text-purple-400" : "text-foreground"
                  )}>
                    {strategy.label}
                  </span>
                  {strategy.isExperimental && (
                    <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300">
                      تجريبي
                    </span>
                  )}
                </div>
                
                <div className={cn(
                  "flex items-center gap-1 text-sm font-mono font-bold",
                  isPositive ? "text-terminal-green" : "text-terminal-red"
                )}>
                  {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  <span>{isPositive ? '+' : ''}{strategy.roi.toFixed(2)}%</span>
                </div>
              </div>

              {/* Stats Row */}
              <div className="grid grid-cols-4 gap-2 text-[10px]">
                <div className="bg-secondary/50 rounded-lg p-1.5 text-center">
                  <div className="text-muted-foreground">المحفظة</div>
                  <div className="font-mono font-semibold text-foreground">
                    ${strategy.totalPortfolio.toFixed(0)}
                  </div>
                </div>
                <div className="bg-secondary/50 rounded-lg p-1.5 text-center">
                  <div className="text-muted-foreground">الربح</div>
                  <div className={cn(
                    "font-mono font-semibold",
                    isPositive ? "text-terminal-green" : "text-terminal-red"
                  )}>
                    {isPositive ? '+' : ''}${strategy.pnl.toFixed(2)}
                  </div>
                </div>
                <div className="bg-secondary/50 rounded-lg p-1.5 text-center">
                  <div className="text-muted-foreground">الصفقات</div>
                  <div className="font-mono font-semibold text-foreground">
                    {strategy.trades}
                  </div>
                </div>
                <div className="bg-secondary/50 rounded-lg p-1.5 text-center">
                  <div className="text-muted-foreground">النجاح</div>
                  <div className={cn(
                    "font-mono font-semibold",
                    strategy.winRate >= 50 ? "text-terminal-green" : "text-terminal-amber"
                  )}>
                    {strategy.winRate.toFixed(0)}%
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mt-2 h-1.5 bg-secondary/50 rounded-full overflow-hidden">
                <div 
                  className={cn(
                    "h-full rounded-full transition-all",
                    isPositive ? "bg-terminal-green" : "bg-terminal-red"
                  )}
                  style={{ 
                    width: `${Math.min(100, Math.max(5, (strategy.totalPortfolio / 5000) * 100))}%` 
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer - Total Summary */}
      <div className="p-3 bg-secondary/30 border-t border-border/50">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <Wallet className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">إجمالي رأس المال:</span>
            <span className="font-mono font-bold text-foreground">
              ${strategies.reduce((sum, s) => sum + s.totalPortfolio, 0).toFixed(2)}
            </span>
          </div>
          <div className={cn(
            "font-mono font-bold",
            totalPnL >= 0 ? "text-terminal-green" : "text-terminal-red"
          )}>
            {totalPnL >= 0 ? '+' : ''}${totalPnL.toFixed(2)}
          </div>
        </div>
      </div>
    </div>
  );
};
