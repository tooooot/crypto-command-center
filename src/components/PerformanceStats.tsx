import { PerformanceStats as Stats } from '@/hooks/usePaperTrading';
import { BarChart3, TrendingUp, TrendingDown, Target, Wallet, Briefcase } from 'lucide-react';

interface PerformanceStatsProps {
  stats: Stats;
  virtualBalance: number;
  initialBalance: number;
  openPositionsValue: number;
  totalPortfolioValue: number;
}

export const PerformanceStats = ({ 
  stats, 
  virtualBalance, 
  initialBalance, 
  openPositionsValue,
  totalPortfolioValue 
}: PerformanceStatsProps) => {
  const balanceChange = totalPortfolioValue - initialBalance;
  const balanceChangePercent = ((totalPortfolioValue - initialBalance) / initialBalance) * 100;
  const isBalancePositive = balanceChange >= 0;

  return (
    <div className="terminal-card h-full flex flex-col">
      <div className="flex items-center gap-2 p-3 border-b border-border">
        <BarChart3 className="w-4 h-4 text-terminal-amber" />
        <span className="text-sm font-medium text-terminal-amber">إحصائيات_الأداء</span>
      </div>

      <div className="flex-1 p-3 space-y-3">
        {/* Portfolio Overview */}
        <div className="bg-secondary/50 rounded-lg p-3">
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-1">
            <Briefcase className="w-3 h-3" />
            <span>القيمة الإجمالية للمحفظة</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold text-foreground">
              ${totalPortfolioValue.toFixed(2)}
            </span>
            <span className={`text-sm ${isBalancePositive ? 'text-terminal-green' : 'text-terminal-red'}`}>
              {isBalancePositive ? '+' : ''}{balanceChangePercent.toFixed(2)}%
            </span>
          </div>
        </div>

        {/* Available Balance & Positions Value */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-secondary/50 rounded px-2 py-2">
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-1">
              <Wallet className="w-3 h-3" />
              <span>الرصيد المتاح</span>
            </div>
            <div className="text-sm font-semibold text-terminal-green">${virtualBalance.toFixed(2)}</div>
          </div>
          <div className="bg-secondary/50 rounded px-2 py-2">
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-1">
              <TrendingUp className="w-3 h-3" />
              <span>في الصفقات</span>
            </div>
            <div className="text-sm font-semibold text-terminal-amber">${openPositionsValue.toFixed(2)}</div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-2">
          <StatCard
            icon={<TrendingUp className="w-3 h-3" />}
            label="الربح الصافي"
            value={`${stats.totalPnL >= 0 ? '+' : ''}$${stats.totalPnL.toFixed(2)}`}
            colorClass={stats.totalPnL >= 0 ? 'text-terminal-green' : 'text-terminal-red'}
          />
          <StatCard
            icon={<Target className="w-3 h-3" />}
            label="نسبة النجاح"
            value={`${stats.winRate.toFixed(1)}%`}
            colorClass={stats.winRate >= 50 ? 'text-terminal-green' : 'text-terminal-amber'}
          />
          <StatCard
            icon={<TrendingUp className="w-3 h-3" />}
            label="صفقات ناجحة"
            value={stats.winningTrades.toString()}
            colorClass="text-terminal-green"
          />
          <StatCard
            icon={<TrendingDown className="w-3 h-3" />}
            label="صفقات خاسرة"
            value={stats.losingTrades.toString()}
            colorClass="text-terminal-red"
          />
        </div>

        {/* Total Trades */}
        <div className="bg-secondary/50 rounded-lg p-3 text-center">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
            إجمالي الصفقات المغلقة
          </div>
          <div className="text-lg font-bold text-foreground">{stats.totalTrades}</div>
        </div>
      </div>
    </div>
  );
};

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  colorClass: string;
}

const StatCard = ({ icon, label, value, colorClass }: StatCardProps) => (
  <div className="bg-secondary/50 rounded px-2 py-2">
    <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-1">
      {icon}
      <span>{label}</span>
    </div>
    <div className={`text-sm font-semibold ${colorClass}`}>{value}</div>
  </div>
);
