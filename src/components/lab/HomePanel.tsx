import { Activity, TrendingUp, Wallet, Zap } from 'lucide-react';
import { StrategyEngineState } from '@/hooks/useStrategyEngine';
import { cn } from '@/lib/utils';

interface StrategyOverview {
  name: string;
  nameAr: string;
  tag: string;
  state: StrategyEngineState;
}

interface HomePanelProps {
  strategies: StrategyOverview[];
  totalScanned: number;
  totalOpportunities: number;
  serverOnline: boolean;
  lastSync: Date | null;
}

export const HomePanel = ({
  strategies,
  totalScanned,
  totalOpportunities,
  serverOnline,
  lastSync,
}: HomePanelProps) => {
  // Calculate totals
  const totalPortfolio = strategies.reduce((sum, s) => sum + s.state.totalPortfolioValue, 0);
  const totalInitial = strategies.reduce((sum, s) => sum + 5000, 0); // Each starts with 5000
  const totalPnL = strategies.reduce((sum, s) => sum + s.state.performanceStats.totalPnL, 0);
  const totalTrades = strategies.reduce((sum, s) => sum + s.state.performanceStats.totalTrades, 0);
  const totalOpenPositions = strategies.reduce((sum, s) => sum + s.state.openPositionsCount, 0);
  const overallROI = ((totalPortfolio - totalInitial) / totalInitial) * 100;

  return (
    <div className="space-y-4">
      {/* Hero Stats */}
      <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl border border-primary/20 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-foreground">مختبر الاستراتيجيات</h2>
          <div className="flex items-center gap-2">
            <span className={cn(
              "w-2 h-2 rounded-full",
              serverOnline ? "bg-terminal-green animate-pulse" : "bg-terminal-red"
            )} />
            <span className="text-xs text-muted-foreground">
              {serverOnline ? 'متصل' : 'غير متصل'}
            </span>
          </div>
        </div>

        {/* Total Portfolio */}
        <div className="text-center mb-6">
          <div className="text-3xl font-bold text-foreground font-mono">
            ${totalPortfolio.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className={cn(
            "text-sm font-medium mt-1",
            overallROI >= 0 ? "text-terminal-green" : "text-terminal-red"
          )}>
            {overallROI >= 0 ? '+' : ''}{overallROI.toFixed(2)}% ROI
            ({totalPnL >= 0 ? '+' : ''}${totalPnL.toFixed(2)})
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-card/50 rounded-xl p-3 text-center">
            <Activity className="w-5 h-5 mx-auto mb-1 text-terminal-amber" />
            <div className="text-lg font-bold text-foreground">{totalScanned}</div>
            <div className="text-xs text-muted-foreground">عملة مراقبة</div>
          </div>
          <div className="bg-card/50 rounded-xl p-3 text-center">
            <Zap className="w-5 h-5 mx-auto mb-1 text-terminal-green" />
            <div className="text-lg font-bold text-foreground">{totalOpportunities}</div>
            <div className="text-xs text-muted-foreground">فرصة مكتشفة</div>
          </div>
          <div className="bg-card/50 rounded-xl p-3 text-center">
            <TrendingUp className="w-5 h-5 mx-auto mb-1 text-blue-400" />
            <div className="text-lg font-bold text-foreground">{totalTrades}</div>
            <div className="text-xs text-muted-foreground">صفقة منفذة</div>
          </div>
          <div className="bg-card/50 rounded-xl p-3 text-center">
            <Wallet className="w-5 h-5 mx-auto mb-1 text-purple-400" />
            <div className="text-lg font-bold text-foreground">{totalOpenPositions}</div>
            <div className="text-xs text-muted-foreground">صفقة مفتوحة</div>
          </div>
        </div>
      </div>

      {/* Strategy Cards */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-foreground">أداء الاستراتيجيات</h3>
        
        {strategies.map((strategy) => {
          const isPositive = strategy.state.roi >= 0;
          
          return (
            <div
              key={strategy.tag}
              className="bg-card/50 rounded-xl border border-border/50 p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-foreground">{strategy.nameAr}</span>
                  <span className="text-xs px-2 py-0.5 bg-secondary rounded-full text-muted-foreground">
                    {strategy.tag}
                  </span>
                </div>
                <div className={cn(
                  "font-bold font-mono",
                  isPositive ? "text-terminal-green" : "text-terminal-red"
                )}>
                  {isPositive ? '+' : ''}{strategy.state.roi.toFixed(2)}%
                </div>
              </div>
              
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>الرصيد: ${strategy.state.balance.toFixed(2)}</span>
                <span>المفتوحة: {strategy.state.openPositionsCount}</span>
                <span>الصفقات: {strategy.state.performanceStats.totalTrades}</span>
              </div>

              {/* Progress Bar */}
              <div className="mt-2 h-1.5 bg-secondary/50 rounded-full overflow-hidden">
                <div 
                  className={cn(
                    "h-full rounded-full transition-all",
                    isPositive ? "bg-terminal-green" : "bg-terminal-red"
                  )}
                  style={{ 
                    width: `${Math.min(100, Math.max(5, (strategy.state.totalPortfolioValue / 5000) * 100))}%` 
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Last Sync Info */}
      {lastSync && (
        <div className="text-center text-xs text-muted-foreground">
          آخر تحديث: {lastSync.toLocaleTimeString('ar-SA', { hour12: false })}
        </div>
      )}
    </div>
  );
};
