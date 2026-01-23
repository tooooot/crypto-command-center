import { useState, useEffect, useCallback, useRef } from 'react';

export interface CoinData {
  symbol: string;
  price: string;
  priceChange: string;
  priceChangePercent: string;
  volume: string;
  quoteVolume: string;
  highPrice: string;
  lowPrice: string;
}

// Binance Mainnet API
const BINANCE_API_URL = 'https://api.binance.com/api/v3/ticker/24hr';

// Known valid trading symbols on Binance Spot (expanded list)
const VALID_TRADING_SYMBOLS = new Set([
  'BTC', 'ETH', 'BNB', 'SOL', 'DOGE', 'ADA', 'MATIC', 'DOT',
  'XRP', 'LTC', 'LINK', 'UNI', 'AVAX', 'ATOM', 'ETC', 'XLM',
  'TRX', 'NEAR', 'FIL', 'APT', 'ARB', 'OP', 'INJ', 'SUI',
  'SHIB', 'PEPE', 'FLOKI', 'WIF', 'BONK', 'ORDI', 'SATS',
  'BCH', 'ICP', 'VET', 'HBAR', 'MKR', 'AAVE', 'GRT', 'SNX',
  'IMX', 'RNDR', 'FTM', 'SAND', 'MANA', 'AXS', 'GALA', 'ENJ',
  'CHZ', 'CRV', 'LDO', 'RUNE', 'KAVA', 'ALGO', 'FLOW', 'EGLD',
  'XTZ', 'EOS', 'IOTA', 'ZEC', 'DASH', 'NEO', 'WAVES', 'ZIL',
  'ONE', 'HOT', 'ENS', 'APE', 'COMP', 'BAT', 'ZRX', 'YFI',
  'SUSHI', '1INCH', 'DYDX', 'MASK', 'BLUR', 'CFX', 'STX', 'SEI',
  'TIA', 'JUP', 'PYTH', 'WLD', 'MEME', 'JTO', 'STRK', 'PIXEL',
  'BOME', 'ENA', 'NOT', 'TON', 'IO', 'ZRO', 'LISTA', 'ZK',
  'BANANA', 'RENDER', 'NEIRO', 'EIGEN', 'SAGA', 'TAO', 'AERO'
]);

// Symbols to permanently exclude (known to cause issues)
const EXCLUDED_SYMBOLS = new Set([
  'USDC', 'BUSD', 'TUSD', 'DAI', 'FDUSD', 'USDT', // Stablecoins
  'WBTC', 'WETH', 'STETH', // Wrapped tokens
]);

export const useBinanceData = (addLogEntry: (message: string, type: 'info' | 'success' | 'warning' | 'error') => void) => {
  const [coins, setCoins] = useState<CoinData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const invalidSymbols = useRef<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    try {
      addLogEntry(`جاري الاتصال بـ Binance Mainnet API...`, 'info');
      
      const response = await fetch(BINANCE_API_URL);
      
      if (!response.ok) {
        throw new Error(`خطأ في API: ${response.status}`);
      }

      const data = await response.json();
      addLogEntry('تم استلام البيانات. جاري معالجة أفضل 100 أصل بالحجم...', 'info');

      // Filter USDT pairs - strict validation
      const usdtPairs = data
        .filter((coin: any) => {
          if (!coin.symbol.endsWith('USDT')) return false;
          
          const baseSymbol = coin.symbol.replace('USDT', '');
          
          // Skip excluded symbols (stablecoins, wrapped tokens)
          if (EXCLUDED_SYMBOLS.has(baseSymbol)) return false;
          
          // Skip symbols that have previously failed
          if (invalidSymbols.current.has(baseSymbol)) return false;
          
          // Only include symbols from valid trading list
          if (!VALID_TRADING_SYMBOLS.has(baseSymbol)) return false;
          
          // Must have meaningful volume (> $100k daily)
          if (parseFloat(coin.quoteVolume) < 100000) return false;
          
          return true;
        })
        .sort((a: any, b: any) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
        .slice(0, 250)
        .map((coin: any) => ({
          symbol: coin.symbol.replace('USDT', ''),
          price: coin.lastPrice,
          priceChange: coin.priceChange,
          priceChangePercent: coin.priceChangePercent,
          volume: coin.volume,
          quoteVolume: coin.quoteVolume,
          highPrice: coin.highPrice,
          lowPrice: coin.lowPrice,
        }));

      setCoins(usdtPairs);
      setLastUpdate(new Date());
      setError(null);
      addLogEntry(`[MAINNET] اكتمل الفحص. تم فهرسة ${usdtPairs.length} أصل من أفضل 250 بالحجم.`, 'success');

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'خطأ غير معروف';
      setError(errorMessage);
      addLogEntry(`خطأ في الاتصال: ${errorMessage}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [addLogEntry]);

  // Mark a symbol as invalid (called when order fails with Invalid symbol)
  const markSymbolInvalid = useCallback((symbol: string) => {
    invalidSymbols.current.add(symbol);
    addLogEntry(`[فلترة] تم استبعاد العملة ${symbol} من الفحص المستقبلي`, 'warning');
  }, [addLogEntry]);

  useEffect(() => {
    fetchData();
    
    // Refresh every 30 seconds
    const interval = setInterval(() => {
      addLogEntry('بدء دورة التحديث التلقائي...', 'info');
      fetchData();
    }, 30000);

    return () => clearInterval(interval);
  }, [fetchData, addLogEntry]);

  return { coins, loading, error, lastUpdate, refetch: fetchData, markSymbolInvalid };
};
