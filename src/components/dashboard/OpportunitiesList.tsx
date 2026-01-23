import { Crown, TrendingUp, BarChart3, Activity, Check, X, Sparkles, Loader2, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PendingOpportunity, ExecutionStatus } from '@/hooks/usePaperTrading';
import { RankedOpportunity } from '@/hooks/useOpportunityRanker';

// Execution status display helper
const getStatusDisplay = (status: ExecutionStatus, retryCount: number) => {
  switch (status) {
    case 'buying':
      return { icon: Loader2, text: 'جاري الشراء...', color: 'text-terminal-amber', animate: true };
    case 'retrying':
      return { icon: RefreshCw, text: `إعادة محاولة (${retryCount}/6)`, color: 'text-orange-400', animate: true };
    case 'executed':
      return { icon: CheckCircle, text: 'تم التنفيذ', color: 'text-terminal-green', animate: false };
    case 'failed':
      return { icon: AlertCircle, text: 'فشل نهائي', color: 'text-terminal-red', animate: false };
    default:
      return null;
  }
};

interface OpportunitiesListProps {
  pendingOpportunities: PendingOpportunity[];
  rankedOpportunities: RankedOpportunity[];
  onConfirm: (id: string) => void;
  onDismiss: (id: string) => void;
  isLive?: boolean;
}

export const OpportunitiesList = ({
  pendingOpportunities,
  rankedOpportunities,
  onConfirm,
  onDismiss,
  isLive = true,
}: OpportunitiesListProps) => {
  if (pendingOpportunities.length === 0) {
    return (
      <div className="bg-card/50 rounded-2xl p-6 border border-border/50 backdrop-blur-sm">
        <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
          <Sparkles className="w-8 h-8 mb-3 opacity-30 animate-pulse" />
          <span className="text-sm">جاري البحث عن فرص التداول...</span>
          <span className="text-xs mt-1 opacity-60">يتم فحص السوق كل 15 ثانية</span>
        </div>
      </div>
    );
  }

  // Create rank map for lookup
  const rankMap = new Map(rankedOpportunities.map((r, idx) => [r.symbol, { rank: idx + 1, data: r }]));

  // Sort by rank
  const sortedPending = [...pendingOpportunities].sort((a, b) => {
    const rankA = rankMap.get(a.opportunity.symbol)?.rank ?? 999;
    const rankB = rankMap.get(b.opportunity.symbol)?.rank ?? 999;
    return rankA - rankB;
  });

  return (
    <div className="bg-card/50 rounded-2xl border border-border/50 overflow-hidden backdrop-blur-sm">
      <div className="p-3 border-b border-border/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-terminal-amber" />
          <span className="text-sm font-medium text-foreground">فرص تنتظر التأكيد</span>
        </div>
        <span className="text-xs px-2 py-0.5 rounded-full bg-terminal-amber/20 text-terminal-amber">
          {pendingOpportunities.length}
        </span>
      </div>

      <ScrollArea className="h-[240px]">
        <div className="p-3 space-y-2">
          {sortedPending.map((pending, index) => {
            const changePercent = parseFloat(pending.opportunity.priceChangePercent);
            const isPositive = changePercent >= 0;
            const rankInfo = rankMap.get(pending.opportunity.symbol);
            const isGolden = index === 0 && rankInfo?.rank === 1;
            const ranked = rankInfo?.data;

            const statusDisplay = getStatusDisplay(pending.executionStatus, pending.retryCount);
            const isExecuting = pending.executionStatus === 'buying' || pending.executionStatus === 'retrying';
            const isCompleted = pending.executionStatus === 'executed' || pending.executionStatus === 'failed';

            return (
              <div
                key={pending.id}
                className={`rounded-xl p-3 border transition-all ${
                  isGolden
                    ? 'bg-gradient-to-r from-amber-500/15 to-yellow-500/10 border-amber-500/50'
                    : pending.executionStatus === 'executed'
                    ? 'bg-terminal-green/10 border-terminal-green/30'
                    : pending.executionStatus === 'failed'
                    ? 'bg-terminal-red/10 border-terminal-red/30'
                    : isExecuting
                    ? 'bg-terminal-amber/10 border-terminal-amber/30'
                    : 'bg-secondary/50 border-border/30'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {isGolden && !isExecuting && !isCompleted && (
                      <Crown className="w-4 h-4 text-amber-400 animate-pulse" />
                    )}
                    <span className={`font-bold ${isGolden ? 'text-amber-300' : 'text-foreground'}`}>
                      {pending.opportunity.symbol}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                      {pending.opportunity.strategyName}
                    </span>
                    {/* Execution Status Badge */}
                    {statusDisplay && (
                      <div className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-background/50 ${statusDisplay.color}`}>
                        <statusDisplay.icon className={`w-3 h-3 ${statusDisplay.animate ? 'animate-spin' : ''}`} />
                        <span>{statusDisplay.text}</span>
                      </div>
                    )}
                    {/* Reserved Amount */}
                    {pending.reservedAmount > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400">
                        محجوز: ${pending.reservedAmount}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {!isCompleted && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-terminal-red hover:bg-terminal-red/10 rounded-full"
                          onClick={() => onDismiss(pending.id)}
                          disabled={isExecuting}
                        >
                          <X className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          className={`h-7 px-3 rounded-full ${
                            isGolden
                              ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-black font-bold hover:from-amber-600 hover:to-yellow-600'
                              : 'bg-terminal-green text-black hover:bg-terminal-green/90'
                          }`}
                          onClick={() => onConfirm(pending.id)}
                          disabled={isExecuting}
                        >
                          {isExecuting ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <>
                              <Check className="w-3 h-3 me-1" />
                              {isGolden ? '🏆' : 'شراء'}
                            </>
                          )}
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-3">
                    <span className="text-foreground">${parseFloat(pending.opportunity.price).toFixed(6)}</span>
                    <span className={isPositive ? 'text-terminal-green' : 'text-terminal-red'}>
                      {isPositive ? '+' : ''}{changePercent.toFixed(2)}%
                    </span>
                  </div>
                  {ranked && (
                    <div className="flex items-center gap-3 text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <BarChart3 className="w-3 h-3 text-blue-400" />
                        {(ranked.volume24h / 1000000).toFixed(1)}M
                      </span>
                      <span className="flex items-center gap-1">
                        <Activity className="w-3 h-3 text-purple-400" />
                        RSI:{ranked.estimatedRSI.toFixed(0)}
                      </span>
                      <span className={isGolden ? 'text-amber-400' : 'text-muted-foreground'}>
                        {ranked.score.toFixed(0)}/100
                      </span>
                    </div>
                  )}
                </div>

                {/* Entry Reason - سبب الدخول */}
                {pending.opportunity.entryReason && (
                  <div className="mt-2 p-2 rounded-lg bg-muted/50 border border-border/30">
                    <div className="flex items-center gap-1.5 text-[10px]">
                      <TrendingUp className="w-3 h-3 text-terminal-green" />
                      <span className="text-muted-foreground">سبب الدخول:</span>
                      <span className="text-foreground font-medium">{pending.opportunity.entryReason}</span>
                    </div>
                    {ranked && ranked.dynamicTrailingStop && (
                      <div className="flex items-center gap-1.5 text-[10px] mt-1">
                        <Activity className="w-3 h-3 text-amber-400" />
                        <span className="text-muted-foreground">وقف زاحف ATR:</span>
                        <span className="text-amber-400 font-medium">{ranked.dynamicTrailingStop.toFixed(2)}%</span>
                      </div>
                    )}
                  </div>
                )}

                {isGolden && ranked && (
                  <div className="mt-2 text-[10px] text-amber-400">
                    ✨ {ranked.rankReason}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
};
