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

export const useBinanceData = (addLogEntry: (message: string, type: 'info' | 'success' | 'warning' | 'error') => void) => {
  const [coins, setCoins] = useState<CoinData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    try {
      addLogEntry('Initiating Binance API connection...', 'info');
      
      const response = await fetch('https://api.binance.com/api/v3/ticker/24hr');
      
      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const data = await response.json();
      addLogEntry('Data received. Processing 100 top assets by volume...', 'info');

      // Filter USDT pairs and sort by quote volume
      const usdtPairs = data
        .filter((coin: any) => coin.symbol.endsWith('USDT'))
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
      addLogEntry(`Scan complete. ${usdtPairs.length} assets indexed successfully.`, 'success');
      
      // Check for opportunities (coins with >5% change)
      const opportunities = usdtPairs.filter(
        (coin: CoinData) => Math.abs(parseFloat(coin.priceChangePercent)) > 5
      );
      
      if (opportunities.length > 0) {
        addLogEntry(`Alert: ${opportunities.length} high-volatility opportunities detected.`, 'warning');
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      addLogEntry(`Connection error: ${errorMessage}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [addLogEntry]);

  useEffect(() => {
    fetchData();
    
    // Refresh every 30 seconds
    const interval = setInterval(() => {
      addLogEntry('Auto-refresh cycle initiated...', 'info');
      fetchData();
    }, 30000);

    return () => clearInterval(interval);
  }, [fetchData, addLogEntry]);

  return { coins, loading, error, lastUpdate, refetch: fetchData };
};
