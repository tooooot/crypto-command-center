import { useState, useEffect, useCallback, useRef } from 'react';

const SUPABASE_URL = 'https://lpwhiqtclpiuozxdaipc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxwd2hpcXRjbHBpdW96eGRhaXBjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwOTgyODQsImV4cCI6MjA4NDY3NDI4NH0.qV4dfR1ccUQokIflxyfQpkmfs_R4p5HOUWrCdHitAPs';
const PROXY_ENDPOINT = `${SUPABASE_URL}/functions/v1/trade-proxy`;
const SYNC_INTERVAL = 30000; // 30 seconds

export interface ServerBalance {
  asset: string;
  free: string;
  locked: string;
}

export interface ServerPrice {
  symbol: string;
  price: string;
}

export interface SyncData {
  usdtBalance: number;
  balances: ServerBalance[];
  prices: ServerPrice[];
  serverOnline: boolean;
  latency: number;
  lastSync: Date | null;
}

export const useAutoSync = (
  addLogEntry: (message: string, type: 'info' | 'success' | 'warning' | 'error') => void,
  onBalanceUpdate?: (balance: number) => void
) => {
  const [syncData, setSyncData] = useState<SyncData>({
    usdtBalance: 0,
    balances: [],
    prices: [],
    serverOnline: false,
    latency: -1,
    lastSync: null,
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const syncCountRef = useRef(0);

  // Fetch full account data from server
  const fetchServerData = useCallback(async (): Promise<SyncData | null> => {
    const requestId = (++syncCountRef.current).toString().padStart(4, '0');
    const startTime = performance.now();
    
    console.log(`[SYNC:${requestId}] ════════════════════════════════════`);
    console.log(`[SYNC:${requestId}] AUTO-REFRESH CYCLE STARTED`);
    console.log(`[SYNC:${requestId}] Time: ${new Date().toISOString()}`);
    
    try {
      setIsSyncing(true);
      
      const response = await fetch(PROXY_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ action: 'sync' }),
      });
      
      const elapsed = Math.round(performance.now() - startTime);
      const data = await response.json();
      
      console.log(`[SYNC:${requestId}] RESPONSE RECEIVED`);
      console.log(`[SYNC:${requestId}] Status: ${response.status}`);
      console.log(`[SYNC:${requestId}] Latency: ${elapsed}ms`);
      console.log(`[SYNC:${requestId}] Server Online: ${data.serverOnline}`);
      
      if (data.success && data.data) {
        const account = data.data.account || {};
        const balances: ServerBalance[] = account.balances || [];
        const prices: ServerPrice[] = data.data.prices || [];
        
        // Find USDT balance
        const usdtAsset = balances.find((b: ServerBalance) => b.asset === 'USDT');
        const usdtBalance = usdtAsset ? parseFloat(usdtAsset.free) : 0;
        
        console.log(`[SYNC:${requestId}] ────────────────────────────────────`);
        console.log(`[SYNC:${requestId}] 💰 USDT Balance: ${usdtBalance.toFixed(4)}`);
        console.log(`[SYNC:${requestId}] 📊 Active Balances: ${balances.filter((b: ServerBalance) => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0).length}`);
        console.log(`[SYNC:${requestId}] 📈 Prices Received: ${prices.length}`);
        console.log(`[SYNC:${requestId}] ════════════════════════════════════`);
        
        const syncResult: SyncData = {
          usdtBalance,
          balances,
          prices,
          serverOnline: true,
          latency: elapsed,
          lastSync: new Date(),
        };
        
        setSyncData(syncResult);
        
        // Update parent balance if callback provided
        if (onBalanceUpdate && usdtBalance > 0) {
          onBalanceUpdate(usdtBalance);
        }
        
        return syncResult;
      } else {
        console.log(`[SYNC:${requestId}] ⚠ No data in response`);
        console.log(`[SYNC:${requestId}] ════════════════════════════════════`);
        
        setSyncData(prev => ({
          ...prev,
          serverOnline: false,
          latency: elapsed,
          lastSync: new Date(),
        }));
        
        return null;
      }
      
    } catch (error) {
      const elapsed = Math.round(performance.now() - startTime);
      
      console.error(`[SYNC:${requestId}] ERROR`);
      console.error(`[SYNC:${requestId}] Message: ${(error as Error).message}`);
      console.error(`[SYNC:${requestId}] Latency: ${elapsed}ms`);
      console.error(`[SYNC:${requestId}] ════════════════════════════════════`);
      
      setSyncData(prev => ({
        ...prev,
        serverOnline: false,
        latency: elapsed,
        lastSync: new Date(),
      }));
      
      return null;
    } finally {
      setIsSyncing(false);
    }
  }, [onBalanceUpdate]);

  // Manual sync trigger
  const manualSync = useCallback(async () => {
    addLogEntry('[SYNC] جاري المزامنة اليدوية مع السيرفر...', 'info');
    const result = await fetchServerData();
    
    if (result?.serverOnline) {
      addLogEntry(
        `[SYNC] ✓ تم التحديث | الرصيد: ${result.usdtBalance.toFixed(4)} USDT | الأسعار: ${result.prices.length} | Latency: ${result.latency}ms`,
        'success'
      );
    } else {
      addLogEntry('[SYNC] ✗ فشل الاتصال بالسيرفر', 'error');
    }
    
    return result;
  }, [fetchServerData, addLogEntry]);

  // Auto-sync every 30 seconds
  useEffect(() => {
    // Initial sync
    fetchServerData().then(result => {
      if (result?.serverOnline) {
        addLogEntry(
          `[SYNC] ✓ مزامنة أولية | الرصيد: ${result.usdtBalance.toFixed(4)} USDT | Latency: ${result.latency}ms`,
          'success'
        );
      }
    });
    
    // Set up interval
    const intervalId = setInterval(async () => {
      const result = await fetchServerData();
      
      if (result?.serverOnline) {
        addLogEntry(
          `[SYNC-30s] ✓ تحديث تلقائي | الرصيد: ${result.usdtBalance.toFixed(4)} USDT | الأسعار: ${result.prices.length} | Latency: ${result.latency}ms`,
          'info'
        );
      } else {
        addLogEntry('[SYNC-30s] ⚠ فشل التحديث التلقائي', 'warning');
      }
    }, SYNC_INTERVAL);
    
    return () => clearInterval(intervalId);
  }, [fetchServerData, addLogEntry]);

  return {
    syncData,
    isSyncing,
    manualSync,
    lastSync: syncData.lastSync,
    serverOnline: syncData.serverOnline,
    latency: syncData.latency,
  };
};
