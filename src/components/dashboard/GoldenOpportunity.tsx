import { Crown, TrendingUp, BarChart3, Activity, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RankedOpportunity } from '@/hooks/useOpportunityRanker';

interface GoldenOpportunityProps {
  opportunity: RankedOpportunity | null;
  onBuy: () => void;
  isLive?: boolean;
}

export const GoldenOpportunity = ({ opportunity, onBuy, isLive = true }: GoldenOpportunityProps) => {
  if (!opportunity) {
    return (
      <div className="bg-gradient-to-br from-muted/30 to-muted/10 rounded-2xl p-6 border border-border/50">
        <div className="flex items-center justify-center gap-3 text-muted-foreground py-8">
          <Sparkles className="w-5 h-5 animate-pulse" />
          <span className="text-sm">جاري البحث عن الفرصة الذهبية...</span>
        </div>
      </div>
    );
  }

  const changePercent = parseFloat(opportunity.priceChangePercent);
  const isPositive = changePercent >= 0;

  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-amber-500/20 via-yellow-500/10 to-orange-500/20 rounded-2xl p-6 border border-amber-500/50 shadow-lg shadow-amber-500/10">
      {/* Glow Effect */}
      <div className="absolute -top-20 -right-20 w-40 h-40 bg-amber-400/20 rounded-full blur-3xl" />
      <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-yellow-400/10 rounded-full blur-2xl" />
      
      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/30 rounded-xl animate-pulse">
              <Crown className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-amber-300">الفرصة الذهبية</h3>
              <p className="text-xs text-amber-400/70">{opportunity.rankReason}</p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-2xl font-bold text-foreground">{opportunity.symbol}</span>
            <p className="text-xs text-muted-foreground">{opportunity.strategyName}</p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-background/50 rounded-xl p-3 text-center backdrop-blur-sm">
            <span className="text-xs text-muted-foreground block mb-1">السعر</span>
            <span className="text-sm font-bold text-foreground">
              ${parseFloat(opportunity.price).toFixed(6)}
            </span>
          </div>
          <div className="bg-background/50 rounded-xl p-3 text-center backdrop-blur-sm">
            <span className="text-xs text-muted-foreground block mb-1">التغير</span>
            <span className={`text-sm font-bold flex items-center justify-center gap-1 ${isPositive ? 'text-terminal-green' : 'text-terminal-red'}`}>
              <TrendingUp className={`w-3 h-3 ${!isPositive && 'rotate-180'}`} />
              {isPositive ? '+' : ''}{changePercent.toFixed(2)}%
            </span>
          </div>
          <div className="bg-background/50 rounded-xl p-3 text-center backdrop-blur-sm">
            <span className="text-xs text-muted-foreground block mb-1">النقاط</span>
            <span className="text-sm font-bold text-amber-400">{opportunity.score.toFixed(0)}/100</span>
          </div>
        </div>

        {/* Detail Stats */}
        <div className="flex items-center justify-between mb-4 text-xs">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1 text-blue-400">
              <BarChart3 className="w-3 h-3" />
              {(opportunity.volume24h / 1000000).toFixed(1)}M$
            </span>
            <span className="flex items-center gap-1 text-purple-400">
              <Activity className="w-3 h-3" />
              RSI: {opportunity.estimatedRSI.toFixed(0)}
            </span>
          </div>
          {!isLive && (
            <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded-full text-[10px]">
              وضع افتراضي
            </span>
          )}
        </div>

        {/* Buy Button */}
        <Button
          onClick={onBuy}
          className="w-full bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-black font-bold py-3 rounded-xl shadow-lg shadow-amber-500/25 transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          <Crown className="w-4 h-4 me-2" />
          {isLive ? '🏆 شراء الآن' : '🎮 تجربة افتراضية'}
        </Button>
      </div>
    </div>
  );
};
