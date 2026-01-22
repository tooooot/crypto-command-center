import { useState, useMemo } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  Search, 
  TrendingUp, 
  RefreshCw,
  Loader2
} from 'lucide-react';
import { CoinData } from '@/hooks/useBinanceData';

interface MarketGridProps {
  coins: CoinData[];
  loading: boolean;
  onRefresh: () => void;
}

type SortKey = 'symbol' | 'price' | 'priceChangePercent' | 'quoteVolume';
type SortDirection = 'asc' | 'desc';

const formatNumber = (num: string | number, decimals = 2) => {
  const n = typeof num === 'string' ? parseFloat(num) : num;
  if (n >= 1e9) return `${(n / 1e9).toFixed(decimals)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(decimals)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(decimals)}K`;
  return n.toFixed(decimals);
};

const formatPrice = (price: string) => {
  const num = parseFloat(price);
  if (num >= 1000) return num.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (num >= 1) return num.toFixed(2);
  if (num >= 0.0001) return num.toFixed(4);
  return num.toFixed(8);
};

export const MarketGrid = ({ coins, loading, onRefresh }: MarketGridProps) => {
  const [sortKey, setSortKey] = useState<SortKey>('quoteVolume');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [search, setSearch] = useState('');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('desc');
    }
  };

  const filteredAndSortedCoins = useMemo(() => {
    let result = [...coins];

    if (search) {
      result = result.filter((coin) =>
        coin.symbol.toLowerCase().includes(search.toLowerCase())
      );
    }

    result.sort((a, b) => {
      let aVal: number, bVal: number;

      switch (sortKey) {
        case 'symbol':
          return sortDirection === 'asc'
            ? a.symbol.localeCompare(b.symbol)
            : b.symbol.localeCompare(a.symbol);
        case 'price':
          aVal = parseFloat(a.price);
          bVal = parseFloat(b.price);
          break;
        case 'priceChangePercent':
          aVal = parseFloat(a.priceChangePercent);
          bVal = parseFloat(b.priceChangePercent);
          break;
        case 'quoteVolume':
          aVal = parseFloat(a.quoteVolume);
          bVal = parseFloat(b.quoteVolume);
          break;
        default:
          return 0;
      }

      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    });

    return result;
  }, [coins, sortKey, sortDirection, search]);

  const SortIcon = ({ columnKey }: { columnKey: SortKey }) => {
    if (sortKey !== columnKey) {
      return <ArrowUpDown className="w-3 h-3 ml-1 opacity-50" />;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="w-3 h-3 ml-1 text-terminal-green" />
    ) : (
      <ArrowDown className="w-3 h-3 ml-1 text-terminal-green" />
    );
  };

  return (
    <div className="terminal-card h-full flex flex-col">
      <div className="flex items-center justify-between p-3 border-b border-border">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-terminal-green" />
          <span className="text-sm font-medium text-terminal-green">MARKET_GRID</span>
          <span className="text-xs text-muted-foreground">
            ({filteredAndSortedCoins.length} assets)
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-7 w-32 pl-7 text-xs bg-secondary/50 border-border"
            />
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            disabled={loading}
            className="h-7 px-2 text-muted-foreground hover:text-terminal-green hover:bg-terminal-green/10"
          >
            {loading ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <RefreshCw className="w-3 h-3" />
            )}
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <Table>
          <TableHeader className="sticky top-0 bg-card z-10">
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground w-8">
                #
              </TableHead>
              <TableHead
                className="text-[10px] uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                onClick={() => handleSort('symbol')}
              >
                <div className="flex items-center">
                  Asset
                  <SortIcon columnKey="symbol" />
                </div>
              </TableHead>
              <TableHead
                className="text-[10px] uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-foreground transition-colors text-right"
                onClick={() => handleSort('price')}
              >
                <div className="flex items-center justify-end">
                  Price
                  <SortIcon columnKey="price" />
                </div>
              </TableHead>
              <TableHead
                className="text-[10px] uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-foreground transition-colors text-right"
                onClick={() => handleSort('priceChangePercent')}
              >
                <div className="flex items-center justify-end">
                  24h %
                  <SortIcon columnKey="priceChangePercent" />
                </div>
              </TableHead>
              <TableHead
                className="text-[10px] uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-foreground transition-colors text-right"
                onClick={() => handleSort('quoteVolume')}
              >
                <div className="flex items-center justify-end">
                  Volume
                  <SortIcon columnKey="quoteVolume" />
                </div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSortedCoins.map((coin, index) => {
              const changePercent = parseFloat(coin.priceChangePercent);
              const isPositive = changePercent >= 0;

              return (
                <TableRow
                  key={coin.symbol}
                  className="border-border hover:bg-secondary/30 transition-colors"
                >
                  <TableCell className="text-xs text-muted-foreground py-2">
                    {index + 1}
                  </TableCell>
                  <TableCell className="py-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{coin.symbol}</span>
                      <span className="text-[10px] text-muted-foreground">/USDT</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right py-2">
                    <span className="text-sm font-mono">${formatPrice(coin.price)}</span>
                  </TableCell>
                  <TableCell className="text-right py-2">
                    <span
                      className={`text-sm font-mono ${
                        isPositive ? 'text-terminal-green' : 'text-terminal-red'
                      }`}
                    >
                      {isPositive ? '+' : ''}
                      {changePercent.toFixed(2)}%
                    </span>
                  </TableCell>
                  <TableCell className="text-right py-2">
                    <span className="text-sm font-mono text-muted-foreground">
                      ${formatNumber(coin.quoteVolume)}
                    </span>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </ScrollArea>
    </div>
  );
};
