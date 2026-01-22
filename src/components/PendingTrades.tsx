import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PendingOpportunity } from '@/hooks/usePaperTrading';
import { RankedOpportunity } from '@/hooks/useOpportunityRanker';
import { Check, X, TrendingUp, Clock, Crown, BarChart3, Activity } from 'lucide-react';

interface PendingTradesProps {
  pendingOpportunities: PendingOpportunity[];
  rankedOpportunities?: RankedOpportunity[];
  onConfirm: (id: string) => void;
  onDismiss: (id: string) => void;
}

export const PendingTrades = ({ 
  pendingOpportunities, 
  rankedOpportunities = [],
  onConfirm, 
  onDismiss 
}: PendingTradesProps) => {
  if (pendingOpportunities.length === 0) {
    return null;
  }

  // Create a map of ranked opportunities for quick lookup
  const rankMap = new Map(rankedOpportunities.map((r, idx) => [r.symbol, { rank: idx + 1, data: r }]));

  // Sort pending opportunities by rank (golden opportunity first)
  const sortedPending = [...pendingOpportunities].sort((a, b) => {
    const rankA = rankMap.get(a.opportunity.symbol)?.rank ?? 999;
    const rankB = rankMap.get(b.opportunity.symbol)?.rank ?? 999;
    return rankA - rankB;
  });

  return (
    <Card className="border-yellow-500/50 bg-yellow-500/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2 text-yellow-400">
          <Clock className="h-4 w-4 animate-pulse" />
          فرص تداول تنتظر التأكيد ({pendingOpportunities.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {sortedPending.map((pending, index) => {
          const changePercent = parseFloat(pending.opportunity.priceChangePercent);
          const isPositive = changePercent >= 0;
          const rankInfo = rankMap.get(pending.opportunity.symbol);
          const isGolden = index === 0 && rankInfo?.rank === 1;
          const ranked = rankInfo?.data;
          
          return (
            <div 
              key={pending.id} 
              className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                isGolden 
                  ? 'bg-gradient-to-r from-yellow-500/20 to-amber-500/10 border-yellow-400 shadow-lg shadow-yellow-500/20' 
                  : 'bg-background/50 border-yellow-500/30'
              }`}
            >
              <div className="flex items-center gap-3">
                {isGolden && (
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-yellow-500/20 animate-pulse">
                    <Crown className="h-5 w-5 text-yellow-400" />
                  </div>
                )}
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className={`font-bold ${isGolden ? 'text-yellow-300 text-lg' : 'text-foreground'}`}>
                      {pending.opportunity.symbol}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {pending.opportunity.strategyName}
                    </Badge>
                    {isGolden && (
                      <Badge className="bg-yellow-500 text-black text-xs font-bold">
                        الفرصة الذهبية
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>${parseFloat(pending.opportunity.price).toFixed(6)}</span>
                    <span className={isPositive ? 'text-green-400' : 'text-red-400'}>
                      {isPositive ? '+' : ''}{changePercent.toFixed(2)}%
                    </span>
                  </div>
                  
                  {/* Score details for ranked opportunities */}
                  {ranked && (
                    <div className="flex items-center gap-3 mt-1 text-xs">
                      <span className="flex items-center gap-1 text-blue-400">
                        <BarChart3 className="h-3 w-3" />
                        {(ranked.volume24h / 1000000).toFixed(1)}M
                      </span>
                      <span className="flex items-center gap-1 text-purple-400">
                        <Activity className="h-3 w-3" />
                        RSI: {ranked.estimatedRSI.toFixed(0)}
                      </span>
                      <span className={`text-xs ${isGolden ? 'text-yellow-400' : 'text-muted-foreground'}`}>
                        نقاط: {ranked.score.toFixed(0)}/100
                      </span>
                    </div>
                  )}
                  
                  {/* Reason for golden opportunity */}
                  {isGolden && ranked && (
                    <span className="text-xs text-yellow-400 mt-1">
                      ✨ {ranked.rankReason}
                    </span>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="border-red-500/50 text-red-400 hover:bg-red-500/10"
                  onClick={() => onDismiss(pending.id)}
                >
                  <X className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  className={`gap-1 ${
                    isGolden 
                      ? 'bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-600 hover:to-amber-600 text-black font-bold shadow-lg shadow-yellow-500/30' 
                      : 'bg-green-600 hover:bg-green-700 text-white'
                  }`}
                  onClick={() => onConfirm(pending.id)}
                >
                  <TrendingUp className="h-4 w-4" />
                  {isGolden ? '🏆 شراء الآن' : 'شراء الآن'}
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};
