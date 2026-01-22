import { useState, useEffect, useCallback } from 'react';

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

// Binance Testnet API for testing
const BINANCE_API_URL = 'https://testnet.binance.vision/api/v3/ticker/24hr';
const IS_TESTNET = true;

// Only these symbols are available on Binance Spot Testnet
const TESTNET_SUPPORTED_SYMBOLS = [
  'BTC', 'ETH', 'BNB', 'SOL', 'DOGE', 'ADA', 'MATIC', 'DOT',
  'XRP', 'LTC', 'LINK', 'UNI', 'AVAX', 'ATOM', 'ETC', 'XLM',
  'TRX', 'NEAR', 'FIL', 'APT', 'ARB', 'OP', 'INJ', 'SUI'
];

export const useBinanceData = (addLogEntry: (message: string, type: 'info' | 'success' | 'warning' | 'error') => void) => {
  const [coins, setCoins] = useState<CoinData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    try {
      addLogEntry(`جاري الاتصال بـ Binance ${IS_TESTNET ? 'Testnet' : 'API'}...`, 'info');
      
      const response = await fetch(BINANCE_API_URL);
      
      if (!response.ok) {
        throw new Error(`خطأ في API: ${response.status}`);
      }

      const data = await response.json();
      addLogEntry('تم استلام البيانات. جاري معالجة أفضل 100 أصل بالحجم...', 'info');

      // Filter USDT pairs - only include Testnet supported symbols
      const usdtPairs = data
        .filter((coin: any) => {
          if (!coin.symbol.endsWith('USDT')) return false;
          const baseSymbol = coin.symbol.replace('USDT', '');
          // In Testnet mode, only include supported symbols
          if (IS_TESTNET) {
            return TESTNET_SUPPORTED_SYMBOLS.includes(baseSymbol);
          }
          return true;
        })
        .sort((a: any, b: any) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
        .slice(0, 100)
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
      addLogEntry(`اكتمل الفحص. تم فهرسة ${usdtPairs.length} أصل بنجاح.`, 'success');

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'خطأ غير معروف';
      setError(errorMessage);
      addLogEntry(`خطأ في الاتصال: ${errorMessage}`, 'error');
    } finally {
      setLoading(false);
    }
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

  return { coins, loading, error, lastUpdate, refetch: fetchData };
};
