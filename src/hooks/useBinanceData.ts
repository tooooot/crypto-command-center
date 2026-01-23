import { useState, useEffect, useCallback, useRef } from 'react';
import { SYSTEM_VERSION } from '@/lib/version';

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
  
  // v2.1-Live: Price cache to prevent bot stop on "Failed to fetch"
  const priceCache = useRef<Map<string, CoinData>>(new Map());
  // v2.1-Live: Reduced logging - only summary every 10 seconds
  const lastSummaryLog = useRef<number>(0);

  const fetchData = useCallback(async () => {
    try {
      // v2.1-Live: Silent fetch - no "connecting" logs
      const response = await fetch(BINANCE_API_URL);
      
      if (!response.ok) {
        throw new Error(`خطأ في API: ${response.status}`);
      }

      const data = await response.json();
      // v2.1-Live: No "data received" log - only summary

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

      // Update price cache with latest data
      usdtPairs.forEach((coin: CoinData) => {
        priceCache.current.set(coin.symbol, coin);
      });

      setCoins(usdtPairs);
      setLastUpdate(new Date());
      setError(null);
      
      // v2.1-Live: Log summary every 10 seconds only (not every fetch)
      const now = Date.now();
      if (now - lastSummaryLog.current >= 10000) {
        lastSummaryLog.current = now;
        addLogEntry(`[${SYSTEM_VERSION}][ملخص] تم فحص ${usdtPairs.length} أصل | نظام القواعد نشط: [S10: 1000$, S20: 1000$, S65: 1000$]`, 'success');
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'خطأ غير معروف';
      setError(errorMessage);
      
      // v2.1-Live: Use cached prices on "Failed to fetch" to prevent bot stop
      if (priceCache.current.size > 0) {
        const cachedCoins = Array.from(priceCache.current.values());
        setCoins(cachedCoins);
        addLogEntry(`[${SYSTEM_VERSION}][CACHE] خطأ: ${errorMessage} | استخدام ${cachedCoins.length} سعر مخبأ`, 'warning');
      } else {
        addLogEntry(`[${SYSTEM_VERSION}] خطأ في الاتصال: ${errorMessage}`, 'error');
      }
    } finally {
      setLoading(false);
    }
  }, [addLogEntry]);

  // Mark a symbol as invalid (called when order fails with Invalid symbol)
  const markSymbolInvalid = useCallback((symbol: string) => {
    invalidSymbols.current.add(symbol);
    addLogEntry(`[فلترة] تم استبعاد العملة ${symbol} من الفحص المستقبلي`, 'warning');
  }, [addLogEntry]);

  // v2.1-Final: Anti-Flood - Single fetch every 5 seconds ONLY
  const lastFetchTime = useRef<number>(0);
  const fetchIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    // Initial fetch
    fetchData();
    lastFetchTime.current = Date.now();
    
    // Anti-Flood: Strict 5-second interval - ONE fetch per cycle
    fetchIntervalRef.current = setInterval(() => {
      const now = Date.now();
      const timeSinceLastFetch = now - lastFetchTime.current;
      
      // Only fetch if at least 4.5 seconds have passed (safety margin)
      if (timeSinceLastFetch >= 4500) {
        lastFetchTime.current = now;
        fetchData();
      }
    }, 5000);

    return () => {
      if (fetchIntervalRef.current) {
        clearInterval(fetchIntervalRef.current);
      }
    };
  }, [fetchData]);

  // Get cached price for a symbol (fallback when live data unavailable)
  const getCachedPrice = useCallback((symbol: string): CoinData | null => {
    return priceCache.current.get(symbol) || null;
  }, []);

  return { coins, loading, error, lastUpdate, refetch: fetchData, markSymbolInvalid, getCachedPrice };
};
