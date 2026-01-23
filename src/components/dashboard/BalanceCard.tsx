import { Wallet, TrendingUp, TrendingDown, DollarSign, Bot, ChevronDown } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

// Core strategies (الكنز)
export type CoreStrategyType = 'breakout' | 'rsiBounce';
// Experimental strategies (تجريبية)
export type ExperimentalStrategyType = 'institutional' | 'crossover';
// All strategy types
export type StrategyType = 'all' | CoreStrategyType | ExperimentalStrategyType;

interface BalanceCardProps {
  balance: number;
  openPositionsValue: number;
  totalPortfolioValue: number;
  initialBalance: number;
  totalPnL: number;
  winRate: number;
  isLive?: boolean;
  autoTrading: boolean;
  onAutoTradingChange: (enabled: boolean) => void;
  selectedStrategy: StrategyType;
  onStrategyChange: (strategy: StrategyType) => void;
}

// Only core strategies available for Live trading
const LIVE_STRATEGY_LABELS: Record<'all' | CoreStrategyType, string> = {
  all: 'جميع الاستراتيجيات',
  breakout: '🚀 الاختراق (S10)',
  rsiBounce: '📈 الارتداد (S65)',
};

export const BalanceCard = ({
  balance,
  openPositionsValue,
  totalPortfolioValue,
  initialBalance,
  totalPnL,
  winRate,
  isLive = true,
  autoTrading,
  onAutoTradingChange,
  selectedStrategy,
  onStrategyChange,
}: BalanceCardProps) => {
  const balanceChange = totalPortfolioValue - initialBalance;
  const balanceChangePercent = ((totalPortfolioValue - initialBalance) / initialBalance) * 100;
  const isPositive = balanceChange >= 0;

  return (
    <div className="bg-card/50 rounded-2xl p-5 border border-border/50 backdrop-blur-sm">
      {/* Header with Auto-Trading Toggle */}
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

      {/* Auto-Trading Toggle with Strategy Dropdown */}
      <div className={`flex items-center justify-between p-3 rounded-xl mb-4 border ${
        autoTrading 
          ? 'bg-terminal-green/10 border-terminal-green/30' 
          : 'bg-secondary/50 border-border/50'
      }`}>
        <div className="flex items-center gap-2">
          <Bot className={`w-4 h-4 ${autoTrading ? 'text-terminal-green' : 'text-muted-foreground'}`} />
          <div>
            <span className={`text-sm font-medium ${autoTrading ? 'text-terminal-green' : 'text-muted-foreground'}`}>
              التداول الآلي
            </span>
            <span className={`text-[10px] block ${autoTrading ? 'text-terminal-green/70' : 'text-muted-foreground/70'}`}>
              {autoTrading ? 'تنفيذ تلقائي للصفقات' : 'وضع يدوي - تأكيد مطلوب'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Strategy Dropdown - Only Core Strategies for Live */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="outline" 
                size="sm" 
                className="h-7 text-[10px] px-2 border-border/50 bg-secondary/50"
              >
                {LIVE_STRATEGY_LABELS[selectedStrategy as 'all' | CoreStrategyType] || 'الاستراتيجيات'}
                <ChevronDown className="w-3 h-3 ms-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[180px] bg-card border-border z-50">
              <DropdownMenuItem onClick={() => onStrategyChange('all')}>
                {LIVE_STRATEGY_LABELS.all}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onStrategyChange('breakout')}>
                {LIVE_STRATEGY_LABELS.breakout}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onStrategyChange('rsiBounce')}>
                {LIVE_STRATEGY_LABELS.rsiBounce}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          <Switch
            checked={autoTrading}
            onCheckedChange={onAutoTradingChange}
            className={autoTrading ? 'data-[state=checked]:bg-terminal-green' : ''}
          />
        </div>
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
