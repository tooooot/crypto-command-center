import { Position } from '@/hooks/usePaperTrading';
import { Button } from '@/components/ui/button';
import { TrendingUp, TrendingDown, X, RotateCcw } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface OpenPositionsProps {
  positions: Position[];
  onClosePosition: (positionId: string) => void;
  onHardReset?: () => void;
}

export const OpenPositions = ({ positions, onClosePosition, onHardReset }: OpenPositionsProps) => {
  return (
    <div className="terminal-card h-full flex flex-col">
      <div className="flex items-center justify-between p-3 border-b border-border">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-terminal-green" />
          <span className="text-sm font-medium text-terminal-green">الصفقات_المفتوحة</span>
          <span className="text-xs text-muted-foreground">({positions.length}/10)</span>
        </div>
        {onHardReset && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onHardReset}
            className="h-7 px-2 text-muted-foreground hover:text-terminal-amber hover:bg-terminal-amber/10"
            title="إعادة ضبط المحفظة"
          >
            <RotateCcw className="w-3 h-3 me-1" />
            <span className="text-xs">ضبط</span>
          </Button>
        )}
      </div>

      <ScrollArea className="flex-1 p-2">
        {positions.length === 0 ? (
          <div className="text-center text-muted-foreground text-sm py-8">
            لا توجد صفقات مفتوحة - في انتظار الفرص...
          </div>
        ) : (
          <div className="space-y-2">
            {positions.map((position) => (
              <PositionCard
                key={position.id}
                position={position}
                onClose={() => onClosePosition(position.id)}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
};

interface PositionCardProps {
  position: Position;
  onClose: () => void;
}

const PositionCard = ({ position, onClose }: PositionCardProps) => {
  const isProfit = position.pnlAmount >= 0;
  const PnLIcon = isProfit ? TrendingUp : TrendingDown;
  const pnlColorClass = isProfit ? 'text-terminal-green' : 'text-terminal-red';

  return (
    <div className="bg-secondary/50 rounded-lg p-3 border border-border/50">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-foreground">{position.symbol}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-terminal-amber/20 text-terminal-amber">
            {position.strategyName}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="h-6 w-6 p-0 text-muted-foreground hover:text-terminal-red hover:bg-terminal-red/10"
        >
          <X className="w-3 h-3" />
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <span className="text-muted-foreground">سعر الدخول:</span>
          <span className="ms-1 text-foreground">${position.entryPrice.toFixed(6)}</span>
        </div>
        <div>
          <span className="text-muted-foreground">السعر الحالي:</span>
          <span className="ms-1 text-foreground">${position.currentPrice.toFixed(6)}</span>
        </div>
        <div>
          <span className="text-muted-foreground">أعلى سعر:</span>
          <span className="ms-1 text-terminal-green">${position.highestPrice.toFixed(6)}</span>
        </div>
        <div>
          <span className="text-muted-foreground">سعر الوقف:</span>
          <span className="ms-1 text-terminal-amber">${position.trailingStopPrice.toFixed(6)}</span>
        </div>
        <div className="col-span-2 flex items-center justify-between pt-1 border-t border-border/30">
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground">الربح اللحظي:</span>
            <PnLIcon className={`w-3 h-3 ${pnlColorClass}`} />
            <span className={pnlColorClass}>
              {isProfit ? '+' : ''}{position.pnlPercent.toFixed(2)}%
            </span>
          </div>
          <span className={`font-semibold ${pnlColorClass}`}>
            {isProfit ? '+' : ''}${position.pnlAmount.toFixed(4)}
          </span>
        </div>
      </div>
    </div>
  );
};
