import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PendingOpportunity } from '@/hooks/usePaperTrading';
import { Check, X, TrendingUp, Clock } from 'lucide-react';

interface PendingTradesProps {
  pendingOpportunities: PendingOpportunity[];
  onConfirm: (id: string) => void;
  onDismiss: (id: string) => void;
}

export const PendingTrades = ({ pendingOpportunities, onConfirm, onDismiss }: PendingTradesProps) => {
  if (pendingOpportunities.length === 0) {
    return null;
  }

  return (
    <Card className="border-yellow-500/50 bg-yellow-500/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2 text-yellow-400">
          <Clock className="h-4 w-4 animate-pulse" />
          فرص تداول تنتظر التأكيد ({pendingOpportunities.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {pendingOpportunities.map((pending) => {
          const changePercent = parseFloat(pending.opportunity.priceChangePercent);
          const isPositive = changePercent >= 0;
          
          return (
            <div 
              key={pending.id} 
              className="flex items-center justify-between p-3 rounded-lg bg-background/50 border border-yellow-500/30"
            >
              <div className="flex items-center gap-3">
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-foreground">{pending.opportunity.symbol}</span>
                    <Badge variant="outline" className="text-xs">
                      {pending.opportunity.strategyName}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>${parseFloat(pending.opportunity.price).toFixed(6)}</span>
                    <span className={isPositive ? 'text-green-400' : 'text-red-400'}>
                      {isPositive ? '+' : ''}{changePercent.toFixed(2)}%
                    </span>
                  </div>
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
                  className="bg-green-600 hover:bg-green-700 text-white gap-1"
                  onClick={() => onConfirm(pending.id)}
                >
                  <TrendingUp className="h-4 w-4" />
                  شراء الآن
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};
