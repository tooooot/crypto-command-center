import { useState, useCallback } from 'react';

const SERVER_IP = "108.61.175.57";
const SERVER_PORT = 3000;

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
  error?: string;
  latency?: number;
}

export const useServerConnection = (
  addLogEntry: (message: string, type: 'info' | 'success' | 'warning' | 'error') => void
) => {
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [tradeHistory, setTradeHistory] = useState<TradeHistoryEntry[]>([]);

  // Verify connection to the proxy server
  const verifyConnection = useCallback(async (): Promise<ServerConnectionResult> => {
    setIsChecking(true);
    const startTime = performance.now();
    
    addLogEntry(`[PROXY] جاري محاولة الاتصال بالسيرفر ${SERVER_IP}:${SERVER_PORT}...`, 'info');
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await fetch(`http://${SERVER_IP}:${SERVER_PORT}/trade-history`, {
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
      
      setIsConnected(true);
      setTradeHistory(data.trades || data || []);
      
      addLogEntry(
        `[PROXY] ✓ تم الاتصال بنجاح! | الوقت: ${latency}ms | سجل الصفقات: ${Array.isArray(data) ? data.length : data.trades?.length || 0} صفقة`,
        'success'
      );
      
      setIsChecking(false);
      return { success: true, data: data.trades || data, latency };
      
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
        ip: SERVER_IP,
        port: SERVER_PORT,
        error: error.message,
        latency,
      });
      
      setIsChecking(false);
      return { success: false, error: errorMessage, latency };
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
    verifyConnection,
    fetchTradeHistory,
    serverUrl: `http://${SERVER_IP}:${SERVER_PORT}`,
  };
};
