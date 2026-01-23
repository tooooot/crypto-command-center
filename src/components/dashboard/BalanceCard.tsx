import { Wallet, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';

interface BalanceCardProps {
  balance: number;
  openPositionsValue: number;
  totalPortfolioValue: number;
  initialBalance: number;
  totalPnL: number;
  winRate: number;
  isLive?: boolean;
}

export const BalanceCard = ({
  balance,
  openPositionsValue,
  totalPortfolioValue,
  initialBalance,
  totalPnL,
  winRate,
  isLive = true,
}: BalanceCardProps) => {
  const balanceChange = totalPortfolioValue - initialBalance;
  const balanceChangePercent = ((totalPortfolioValue - initialBalance) / initialBalance) * 100;
  const isPositive = balanceChange >= 0;

  return (
    <div className="bg-card/50 rounded-2xl p-5 border border-border/50 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className={`p-2 rounded-xl ${isLive ? 'bg-terminal-green/20' : 'bg-blue-500/20'}`}>
            <Wallet className={`w-5 h-5 ${isLive ? 'text-terminal-green' : 'text-blue-400'}`} />
          </div>
          <span className="text-sm text-muted-foreground">
            {isLive ? 'المحفظة الحقيقية' : 'المحفظة الافتراضية'}
          </span>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full ${isLive ? 'bg-terminal-green/20 text-terminal-green' : 'bg-blue-500/20 text-blue-400'}`}>
          {isLive ? 'LIVE' : 'DEMO'}
        </span>
      </div>

      {/* Total Value */}
      <div className="mb-4">
        <span className="text-3xl font-bold text-foreground">${totalPortfolioValue.toFixed(2)}</span>
        <div className={`flex items-center gap-1 mt-1 text-sm ${isPositive ? 'text-terminal-green' : 'text-terminal-red'}`}>
          {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
          <span>{isPositive ? '+' : ''}{balanceChangePercent.toFixed(2)}%</span>
          <span className="text-muted-foreground">({isPositive ? '+' : ''}${balanceChange.toFixed(2)})</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-secondary/50 rounded-xl p-3">
          <span className="text-[10px] text-muted-foreground block mb-1">السيولة المتاحة</span>
          <span className="text-sm font-bold text-foreground flex items-center gap-1">
            <DollarSign className="w-3 h-3 text-terminal-green" />
            {balance.toFixed(2)}
          </span>
        </div>
        <div className="bg-secondary/50 rounded-xl p-3">
          <span className="text-[10px] text-muted-foreground block mb-1">قيمة العملات</span>
          <span className="text-sm font-bold text-foreground flex items-center gap-1">
            <DollarSign className="w-3 h-3 text-terminal-amber" />
            {openPositionsValue.toFixed(2)}
          </span>
        </div>
        <div className="bg-secondary/50 rounded-xl p-3">
          <span className="text-[10px] text-muted-foreground block mb-1">الربح الصافي</span>
          <span className={`text-sm font-bold ${totalPnL >= 0 ? 'text-terminal-green' : 'text-terminal-red'}`}>
            {totalPnL >= 0 ? '+' : ''}${totalPnL.toFixed(2)}
          </span>
        </div>
        <div className="bg-secondary/50 rounded-xl p-3">
          <span className="text-[10px] text-muted-foreground block mb-1">نسبة النجاح</span>
          <span className={`text-sm font-bold ${winRate >= 50 ? 'text-terminal-green' : 'text-terminal-amber'}`}>
            {winRate.toFixed(1)}%
          </span>
        </div>
      </div>
    </div>
  );
};
