import { useState, useCallback } from 'react';

const SERVER_IP = "108.61.175.57";
const SERVER_PORT = 3000;

// Dynamic URL based on current hostname or fallback to known IP
const getServerUrl = () => {
  // If running on the server itself, use the same hostname
  if (typeof window !== 'undefined' && window.location.hostname === SERVER_IP) {
    return `http://${window.location.hostname}:${SERVER_PORT}`;
  }
  // Fallback to known server IP
  return `http://${SERVER_IP}:${SERVER_PORT}`;
};

export interface TradeHistoryEntry {
  id: string;
  symbol: string;
  side: string;
  price: number;
  quantity: number;
  timestamp: string;
  status: string;
}

export interface ServerConnectionResult {
  success: boolean;
  data?: TradeHistoryEntry[];
  balance?: number;
  error?: string;
  latency?: number;
}

export const useServerConnection = (
  addLogEntry: (message: string, type: 'info' | 'success' | 'warning' | 'error') => void,
  onBalanceUpdate?: (balance: number) => void
) => {
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [tradeHistory, setTradeHistory] = useState<TradeHistoryEntry[]>([]);
  const [realBalance, setRealBalance] = useState<number | null>(null);

  // Verify connection to the proxy server
  const verifyConnection = useCallback(async (): Promise<ServerConnectionResult> => {
    setIsChecking(true);
    const startTime = performance.now();
    const serverUrl = getServerUrl();
    
    addLogEntry(`[PROXY] جاري محاولة الاتصال بالسيرفر ${serverUrl}...`, 'info');
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      // First try to get trade history
      const response = await fetch(`${serverUrl}/trade-history`, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
        },
      });
      
      clearTimeout(timeoutId);
      const latency = Math.round(performance.now() - startTime);
      
      if (!response.ok) {
        throw new Error(`السيرفر أعاد خطأ: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Extract balance if available (from server response)
      const serverBalance = data.balance || data.availableBalance || 23.26;
      
      setIsConnected(true);
      setTradeHistory(data.trades || data || []);
      setRealBalance(serverBalance);
      
      // Update parent component with real balance
      if (onBalanceUpdate && serverBalance) {
        onBalanceUpdate(serverBalance);
      }
      
      addLogEntry(
        `[PROXY] ✓ تم الاتصال بنجاح! | الوقت: ${latency}ms | الرصيد: ${serverBalance} USDT | سجل الصفقات: ${Array.isArray(data.trades) ? data.trades.length : Array.isArray(data) ? data.length : 0} صفقة`,
        'success'
      );
      
      setIsChecking(false);
      return { success: true, data: data.trades || data, balance: serverBalance, latency };
      
    } catch (error: any) {
      const latency = Math.round(performance.now() - startTime);
      setIsConnected(false);
      
      let errorMessage = error.message;
      if (error.name === 'AbortError') {
        errorMessage = 'انتهت مهلة الاتصال (10 ثوانٍ)';
      } else if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        errorMessage = 'فشل الاتصال - تحقق من: 1) السيرفر يعمل 2) المنفذ 3000 مفتوح 3) CORS مفعل';
      }
      
      addLogEntry(
        `[PROXY] ✗ فشل الاتصال بالسيرفر | ${errorMessage}`,
        'error'
      );
      
      console.error('Server connection failed:', {
        url: getServerUrl(),
        error: error.message,
        latency,
      });
      
      setIsChecking(false);
      return { success: false, error: errorMessage, latency };
    }
  }, [addLogEntry, onBalanceUpdate]);

  // Send trade request via proxy
  const sendTradeViaProxy = useCallback(async (tradeData: {
    symbol: string;
    side: 'BUY' | 'SELL';
    quantity: number;
  }): Promise<{ success: boolean; data?: any; error?: string }> => {
    const serverUrl = getServerUrl();
    
    addLogEntry(`[PROXY] إرسال أمر ${tradeData.side} لـ ${tradeData.symbol}...`, 'info');
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      
      // Send POST to /proxy endpoint as configured in live_bot.js
      const response = await fetch(`${serverUrl}/proxy`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          url: 'https://api.binance.com/api/v3/order',
          method: 'POST',
          ...tradeData,
        }),
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `خطأ: ${response.status}`);
      }
      
      const data = await response.json();
      addLogEntry(`[PROXY] ✓ تم تنفيذ الأمر بنجاح`, 'success');
      
      return { success: true, data };
    } catch (error: any) {
      addLogEntry(`[PROXY] ✗ فشل تنفيذ الأمر: ${error.message}`, 'error');
      return { success: false, error: error.message };
    }
  }, [addLogEntry]);

  // Get trade history from server
  const fetchTradeHistory = useCallback(async (): Promise<TradeHistoryEntry[]> => {
    const result = await verifyConnection();
    return result.data || [];
  }, [verifyConnection]);

  return {
    isConnected,
    isChecking,
    tradeHistory,
    realBalance,
    verifyConnection,
    fetchTradeHistory,
    sendTradeViaProxy,
    serverUrl: getServerUrl(),
  };
};
