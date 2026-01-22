import { useCallback, useState } from 'react';

const SUPABASE_URL = 'https://lpwhiqtclpiuozxdaipc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxwd2hpcXRjbHBpdW96eGRhaXBjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwOTgyODQsImV4cCI6MjA4NDY3NDI4NH0.qV4dfR1ccUQokIflxyfQpkmfs_R4p5HOUWrCdHitAPs';

interface OrderResponse {
  success: boolean;
  data?: any;
  error?: string;
}

export const useBinanceTestnet = (
  addLogEntry: (message: string, type: 'info' | 'success' | 'warning' | 'error') => void
) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const callEdgeFunction = useCallback(async (body: any): Promise<OrderResponse> => {
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/binance-testnet-trade`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();
      return data;
    } catch (error: any) {
      console.error('Edge function error:', error);
      return { success: false, error: error.message };
    }
  }, []);

  const testConnection = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    addLogEntry('[TESTNET] جاري اختبار الاتصال بـ Binance Testnet...', 'info');
    
    try {
      const result = await callEdgeFunction({ action: 'test' });
      
      if (result.success && result.data?.connected) {
        setIsConnected(true);
        addLogEntry('[TESTNET] ✓ تم الربط مع تطبيق بينانس (Mock Trading)', 'success');
        return true;
      } else {
        setIsConnected(false);
        addLogEntry(`[TESTNET] ✗ فشل الاتصال: ${result.error || 'Unknown error'}`, 'error');
        return false;
      }
    } catch (error: any) {
      setIsConnected(false);
      addLogEntry(`[TESTNET] ✗ خطأ في الاتصال: ${error.message}`, 'error');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [callEdgeFunction, addLogEntry]);

  const getBalance = useCallback(async () => {
    const result = await callEdgeFunction({ action: 'balance' });
    
    if (result.success && result.data?.balances) {
      const usdtBalance = result.data.balances.find((b: any) => b.asset === 'USDT');
      if (usdtBalance) {
        addLogEntry(`[TESTNET] رصيد USDT: ${parseFloat(usdtBalance.free).toFixed(2)}`, 'info');
      }
      return result.data;
    }
    
    return null;
  }, [callEdgeFunction, addLogEntry]);

  const placeBuyOrder = useCallback(async (
    symbol: string,
    quantity: number,
    price?: number
  ): Promise<OrderResponse> => {
    addLogEntry(`[TESTNET] جاري إرسال أمر شراء ${symbol}...`, 'info');
    
    const result = await callEdgeFunction({
      action: 'order',
      symbol: symbol.replace('/', ''), // Remove slash if present
      side: 'BUY',
      quantity: quantity.toString(),
      price: price?.toString(),
    });

    if (result.success && result.data?.orderId) {
      addLogEntry(
        `[TESTNET] ✓ تم تنفيذ أمر الشراء: ${symbol} | الكمية: ${quantity} | Order ID: ${result.data.orderId}`,
        'success'
      );
    } else {
      addLogEntry(
        `[TESTNET] ✗ فشل أمر الشراء: ${result.error || result.data?.msg || 'Unknown error'}`,
        'error'
      );
    }

    return result;
  }, [callEdgeFunction, addLogEntry]);

  const placeSellOrder = useCallback(async (
    symbol: string,
    quantity: number,
    price?: number
  ): Promise<OrderResponse> => {
    addLogEntry(`[TESTNET] جاري إرسال أمر بيع ${symbol}...`, 'info');
    
    const result = await callEdgeFunction({
      action: 'order',
      symbol: symbol.replace('/', ''),
      side: 'SELL',
      quantity: quantity.toString(),
      price: price?.toString(),
    });

    if (result.success && result.data?.orderId) {
      addLogEntry(
        `[TESTNET] ✓ تم تنفيذ أمر البيع: ${symbol} | الكمية: ${quantity} | Order ID: ${result.data.orderId}`,
        'success'
      );
    } else {
      addLogEntry(
        `[TESTNET] ✗ فشل أمر البيع: ${result.error || result.data?.msg || 'Unknown error'}`,
        'error'
      );
    }

    return result;
  }, [callEdgeFunction, addLogEntry]);

  const cancelOrder = useCallback(async (symbol: string, orderId: number): Promise<OrderResponse> => {
    addLogEntry(`[TESTNET] جاري إلغاء الأمر ${orderId}...`, 'info');
    
    const result = await callEdgeFunction({
      action: 'cancel',
      symbol: symbol.replace('/', ''),
      orderId,
    });

    if (result.success) {
      addLogEntry(`[TESTNET] ✓ تم إلغاء الأمر ${orderId}`, 'success');
    } else {
      addLogEntry(`[TESTNET] ✗ فشل إلغاء الأمر: ${result.error || 'Unknown error'}`, 'error');
    }

    return result;
  }, [callEdgeFunction, addLogEntry]);

  const getOpenOrders = useCallback(async (symbol?: string) => {
    const result = await callEdgeFunction({
      action: 'openOrders',
      symbol: symbol?.replace('/', ''),
    });

    if (result.success) {
      return result.data;
    }
    
    return [];
  }, [callEdgeFunction]);

  return {
    isConnected,
    isLoading,
    testConnection,
    getBalance,
    placeBuyOrder,
    placeSellOrder,
    cancelOrder,
    getOpenOrders,
  };
};
