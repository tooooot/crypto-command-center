import { Trophy, TrendingUp, TrendingDown, Award } from 'lucide-react';
import { StrategyEngineState } from '@/hooks/useStrategyEngine';
import { cn } from '@/lib/utils';

interface StrategyRanking {
  name: string;
  nameAr: string;
  tag: string;
  state: StrategyEngineState;
}

interface LeaderboardPanelProps {
  strategies: StrategyRanking[];
}

export const LeaderboardPanel = ({ strategies }: LeaderboardPanelProps) => {
  // Sort by ROI descending
  const sortedStrategies = [...strategies].sort((a, b) => b.state.roi - a.state.roi);

  const getMedalIcon = (index: number) => {
    if (index === 0) return <Trophy className="w-5 h-5 text-yellow-400" />;
    if (index === 1) return <Award className="w-5 h-5 text-gray-400" />;
    if (index === 2) return <Award className="w-5 h-5 text-amber-600" />;
    return <span className="w-5 h-5 flex items-center justify-center text-muted-foreground">#{index + 1}</span>;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="text-center py-4">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Trophy className="w-6 h-6 text-yellow-400" />
          <h2 className="text-xl font-bold text-foreground">ترتيب الاستراتيجيات</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          مرتبة حسب نسبة العائد على الاستثمار (ROI)
        </p>
      </div>

      {/* Leaderboard Cards */}
      <div className="space-y-3">
        {sortedStrategies.map((strategy, index) => {
          const isPositive = strategy.state.roi >= 0;
          const isWinner = index === 0;
          
          return (
            <div
              key={strategy.tag}
              className={cn(
                "rounded-2xl border p-4 transition-all",
                isWinner 
                  ? "bg-gradient-to-r from-yellow-500/10 to-amber-500/10 border-yellow-500/30" 
                  : "bg-card/50 border-border/50"
              )}
            >
              <div className="flex items-center gap-4">
                {/* Rank */}
                <div className="flex-shrink-0">
                  {getMedalIcon(index)}
                </div>

                {/* Strategy Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-foreground">{strategy.nameAr}</span>
                    <span className="text-xs px-2 py-0.5 bg-secondary rounded-full text-muted-foreground">
                      {strategy.tag}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                    <span>الصفقات: {strategy.state.performanceStats.totalTrades}</span>
                    <span>نسبة النجاح: {strategy.state.performanceStats.winRate.toFixed(0)}%</span>
                    <span>المفتوحة: {strategy.state.openPositionsCount}</span>
                  </div>
                </div>

                {/* ROI */}
                <div className="flex-shrink-0 text-left">
                  <div className={cn(
                    "flex items-center gap-1 text-lg font-bold",
                    isPositive ? "text-terminal-green" : "text-terminal-red"
                  )}>
                    {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                    <span>{isPositive ? '+' : ''}{strategy.state.roi.toFixed(2)}%</span>
                  </div>
                  <div className={cn(
                    "text-xs text-left",
                    isPositive ? "text-terminal-green/70" : "text-terminal-red/70"
                  )}>
                    {isPositive ? '+' : ''}${strategy.state.performanceStats.totalPnL.toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Balance Bar */}
              <div className="mt-3 pt-3 border-t border-border/30">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">إجمالي المحفظة</span>
                  <span className="font-mono text-foreground">
                    ${strategy.state.totalPortfolioValue.toFixed(2)} USDT
                  </span>
                </div>
                <div className="mt-2 h-2 bg-secondary/50 rounded-full overflow-hidden">
                  <div 
                    className={cn(
                      "h-full rounded-full transition-all",
                      isPositive ? "bg-terminal-green" : "bg-terminal-red"
                    )}
                    style={{ 
                      width: `${Math.min(100, Math.max(0, (strategy.state.totalPortfolioValue / 5000) * 100))}%` 
                    }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary Stats */}
      <div className="bg-card/50 rounded-2xl border border-border/50 p-4 mt-6">
        <h3 className="text-sm font-bold text-foreground mb-3">ملخص الأداء الإجمالي</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">إجمالي رأس المال:</span>
            <span className="font-mono mr-2">
              ${sortedStrategies.reduce((sum, s) => sum + s.state.totalPortfolioValue, 0).toFixed(2)}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">إجمالي الصفقات:</span>
            <span className="font-mono mr-2">
              {sortedStrategies.reduce((sum, s) => sum + s.state.performanceStats.totalTrades, 0)}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">إجمالي الربح:</span>
            <span className={cn(
              "font-mono mr-2",
              sortedStrategies.reduce((sum, s) => sum + s.state.performanceStats.totalPnL, 0) >= 0 
                ? "text-terminal-green" 
                : "text-terminal-red"
            )}>
              ${sortedStrategies.reduce((sum, s) => sum + s.state.performanceStats.totalPnL, 0).toFixed(2)}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">الصفقات المفتوحة:</span>
            <span className="font-mono mr-2">
              {sortedStrategies.reduce((sum, s) => sum + s.state.openPositionsCount, 0)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
