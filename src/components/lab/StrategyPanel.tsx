import { BalanceCard } from '@/components/dashboard/BalanceCard';
import { GoldenOpportunity } from '@/components/dashboard/GoldenOpportunity';
import { OpportunitiesList } from '@/components/dashboard/OpportunitiesList';
import { PositionsList } from '@/components/dashboard/PositionsList';
import { Button } from '@/components/ui/button';
import { StrategyEngine } from '@/hooks/useStrategyEngine';
import { RankedOpportunity } from '@/hooks/useOpportunityRanker';
import { RefreshCw } from 'lucide-react';

interface StrategyPanelProps {
  engine: StrategyEngine;
  goldenOpportunity: RankedOpportunity | null;
  rankedOpportunities: RankedOpportunity[];
  onGoldenBuy: () => void;
}

export const StrategyPanel = ({
  engine,
  goldenOpportunity,
  rankedOpportunities,
  onGoldenBuy,
}: StrategyPanelProps) => {
  // Filter golden opportunity by strategy type
  const filteredGolden = goldenOpportunity && (
    engine.config.type === 'experimental' ||
    goldenOpportunity.strategy === engine.config.type
  ) ? goldenOpportunity : null;

  // Filter ranked opportunities by strategy type
  const filteredRanked = rankedOpportunities.filter(opp => 
    engine.config.type === 'experimental' || opp.strategy === engine.config.type
  );

  return (
    <div className="space-y-4">
      {/* Strategy Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground">{engine.config.nameAr}</h2>
          <p className="text-xs text-muted-foreground">
            رأس المال: {engine.config.initialBalance.toLocaleString()} USDT
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={engine.hardReset}
          className="h-8 px-3 text-xs border-terminal-amber/50 text-terminal-amber hover:bg-terminal-amber/10"
        >
          <RefreshCw className="w-3 h-3 ml-1" />
          إعادة ضبط
        </Button>
      </div>

      {/* Golden Opportunity */}
      <GoldenOpportunity 
        opportunity={filteredGolden} 
        onBuy={onGoldenBuy}
        isLive={false}
      />

      {/* Balance Card */}
      <BalanceCard
        balance={engine.balance}
        openPositionsValue={engine.openPositionsValue}
        totalPortfolioValue={engine.totalPortfolioValue}
        initialBalance={engine.config.initialBalance}
        totalPnL={engine.performanceStats.totalPnL}
        winRate={engine.performanceStats.winRate}
        isLive={false}
        autoTrading={engine.autoTrading}
        onAutoTradingChange={engine.toggleAutoTrading}
      />

      {/* Pending Opportunities */}
      <OpportunitiesList
        pendingOpportunities={engine.pendingOpportunities}
        rankedOpportunities={filteredRanked}
        onConfirm={engine.confirmPendingOpportunity}
        onDismiss={engine.dismissPendingOpportunity}
        isLive={false}
      />

      {/* Positions */}
      <PositionsList
        openPositions={engine.positions}
        closedTrades={engine.closedTrades}
        onClosePosition={engine.manualClosePosition}
      />
    </div>
  );
};
