import { TrendingUp, TrendingDown, X, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Position, ClosedTrade } from '@/hooks/usePaperTrading';

interface PositionsListProps {
  openPositions: Position[];
  closedTrades: ClosedTrade[];
  onClosePosition: (positionId: string) => void;
}

export const PositionsList = ({ openPositions, closedTrades, onClosePosition }: PositionsListProps) => {
  return (
    <div className="bg-card/50 rounded-2xl border border-border/50 overflow-hidden backdrop-blur-sm">
      <Tabs defaultValue="open" className="w-full">
        <TabsList className="w-full rounded-none border-b border-border bg-transparent h-12">
          <TabsTrigger 
            value="open" 
            className="flex-1 data-[state=active]:bg-terminal-green/10 data-[state=active]:text-terminal-green rounded-none border-b-2 border-transparent data-[state=active]:border-terminal-green"
          >
            <TrendingUp className="w-4 h-4 me-2" />
            مفتوحة ({openPositions.length})
          </TabsTrigger>
          <TabsTrigger 
            value="closed"
            className="flex-1 data-[state=active]:bg-muted data-[state=active]:text-foreground rounded-none border-b-2 border-transparent data-[state=active]:border-foreground"
          >
            <History className="w-4 h-4 me-2" />
            مغلقة ({closedTrades.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="open" className="m-0">
          <ScrollArea className="h-[280px]">
            {openPositions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <TrendingUp className="w-8 h-8 mb-2 opacity-30" />
                <span className="text-sm">لا توجد صفقات مفتوحة</span>
              </div>
            ) : (
              <div className="p-3 space-y-2">
                {openPositions.map((position) => (
                  <OpenPositionCard 
                    key={position.id} 
                    position={position} 
                    onClose={() => onClosePosition(position.id)} 
                  />
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        <TabsContent value="closed" className="m-0">
          <ScrollArea className="h-[280px]">
            {closedTrades.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <History className="w-8 h-8 mb-2 opacity-30" />
                <span className="text-sm">لا توجد صفقات مغلقة</span>
              </div>
            ) : (
              <div className="p-3 space-y-2">
                {closedTrades.slice().reverse().map((trade) => (
                  <ClosedTradeCard key={trade.id} trade={trade} />
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
};

const OpenPositionCard = ({ position, onClose }: { position: Position; onClose: () => void }) => {
  const isProfit = position.pnlAmount >= 0;
  const Icon = isProfit ? TrendingUp : TrendingDown;

  return (
    <div className="bg-secondary/50 rounded-xl p-3 border border-border/30">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="font-bold text-foreground">{position.symbol}</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-terminal-amber/20 text-terminal-amber">
            {position.strategyName}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="h-7 w-7 p-0 text-muted-foreground hover:text-terminal-red hover:bg-terminal-red/10 rounded-full"
        >
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-2 text-[11px]">
        <div>
          <span className="text-muted-foreground block">الدخول</span>
          <span className="text-foreground">${position.entryPrice.toFixed(4)}</span>
        </div>
        <div>
          <span className="text-muted-foreground block">الحالي</span>
          <span className="text-foreground">${position.currentPrice.toFixed(4)}</span>
        </div>
        <div>
          <span className="text-muted-foreground block">الوقف</span>
          <span className="text-terminal-amber">${position.trailingStopPrice.toFixed(4)}</span>
        </div>
        <div className="text-left">
          <span className="text-muted-foreground block">الربح</span>
          <div className={`flex items-center gap-1 ${isProfit ? 'text-terminal-green' : 'text-terminal-red'}`}>
            <Icon className="w-3 h-3" />
            <span className="font-bold">{isProfit ? '+' : ''}{position.pnlPercent.toFixed(2)}%</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const ClosedTradeCard = ({ trade }: { trade: ClosedTrade }) => {
  const isProfit = trade.isWin;
  const Icon = isProfit ? TrendingUp : TrendingDown;

  return (
    <div className={`rounded-xl p-3 border ${isProfit ? 'bg-terminal-green/5 border-terminal-green/20' : 'bg-terminal-red/5 border-terminal-red/20'}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={`w-4 h-4 ${isProfit ? 'text-terminal-green' : 'text-terminal-red'}`} />
          <span className="font-bold text-foreground">{trade.symbol}</span>
        </div>
        <div className={`font-bold ${isProfit ? 'text-terminal-green' : 'text-terminal-red'}`}>
          {isProfit ? '+' : ''}{trade.pnlPercent.toFixed(2)}% (${trade.pnlAmount.toFixed(2)})
        </div>
      </div>
      <div className="flex items-center justify-between mt-1 text-[10px] text-muted-foreground">
        <span>{trade.closedAt.toLocaleTimeString('ar-SA', { hour12: false })}</span>
        <span>${trade.entryPrice.toFixed(4)} → ${trade.exitPrice.toFixed(4)}</span>
      </div>
    </div>
  );
};
