import { createHmac } from "node:crypto";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Mainnet Configuration
const BINANCE_MAINNET_URL = 'https://api.binance.com/api';
const API_KEY = Deno.env.get('BINANCE_MAINNET_API_KEY')?.trim();
const SECRET_KEY = Deno.env.get('BINANCE_MAINNET_SECRET_KEY')?.trim();
const PROXY_URL = Deno.env.get('PROXY_SERVER_URL')?.trim();

// Proxy fetch wrapper - routes requests through user's static IP server with fallback
async function proxyFetch(url: string, options: RequestInit): Promise<Response> {
  if (PROXY_URL) {
    try {
      // Try routing through proxy server first
      const proxyPayload = {
        url: url,
        method: options.method || 'GET',
        headers: options.headers,
        body: options.body,
      };
      
      console.log(`Routing request through proxy: ${PROXY_URL}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout
      
      const response = await fetch(PROXY_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(proxyPayload),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      // Check if response is valid JSON (not HTML error page)
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const textBody = await response.text();
        console.warn(`Proxy returned non-JSON (${contentType}): ${textBody.slice(0, 100)}`);
        console.warn('Falling back to direct Binance API...');
        return await fetch(url, options);
      }
      
      return response;
    } catch (proxyError: unknown) {
      // Proxy failed - fallback to direct request
      const errMsg = proxyError instanceof Error ? proxyError.message : 'Unknown error';
      console.warn(`Proxy unavailable, falling back to direct: ${errMsg}`);
      return await fetch(url, options);
    }
  } else {
    // Direct request (no proxy configured)
    return await fetch(url, options);
  }
}

function generateSignature(queryString: string): string {
  const hmac = createHmac('sha256', SECRET_KEY!);
  hmac.update(queryString);
  return hmac.digest('hex');
}

async function getAccountBalance(): Promise<any> {
  const timestamp = Date.now();
  const queryString = `timestamp=${timestamp}`;
  const signature = generateSignature(queryString);
  
  const url = `${BINANCE_MAINNET_URL}/v3/account?${queryString}&signature=${signature}`;
  
  const response = await proxyFetch(url, {
    method: 'GET',
    headers: {
      'X-MBX-APIKEY': API_KEY!,
    },
  });
  
  const data = await response.json();
  console.log('Account balance response:', JSON.stringify(data).slice(0, 500));
  
  // Extract USDT balance
  if (data.balances) {
    const usdtBalance = data.balances.find((b: any) => b.asset === 'USDT');
    return {
      ...data,
      balance: usdtBalance ? parseFloat(usdtBalance.free) : 0,
    };
  }
  
  return data;
}

async function getExchangeInfo(symbol?: string): Promise<any> {
  let url = `${BINANCE_MAINNET_URL}/v3/exchangeInfo`;
  if (symbol) {
    url += `?symbol=${symbol}USDT`;
  }
  
  const response = await proxyFetch(url, {
    method: 'GET',
    headers: {},
  });
  
  return await response.json();
}

async function placeOrder(
  symbol: string,
  side: 'BUY' | 'SELL',
  quantity: number
): Promise<any> {
  const timestamp = Date.now();
  
  // Build query params - MARKET order for instant execution
  const params: Record<string, string> = {
    symbol: symbol + 'USDT',
    side: side,
    type: 'MARKET',
    quantity: quantity.toString(),
    timestamp: timestamp.toString(),
  };
  
  const queryString = Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&');
  
  const signature = generateSignature(queryString);
  const url = `${BINANCE_MAINNET_URL}/v3/order?${queryString}&signature=${signature}`;
  
  console.log(`[MAINNET] Placing ${side} order for ${symbol}:`, params);
  
  const response = await proxyFetch(url, {
    method: 'POST',
    headers: {
      'X-MBX-APIKEY': API_KEY!,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });
  
  const data = await response.json();
  console.log('[MAINNET] Order response:', data);
  return data;
}

async function cancelOrder(symbol: string, orderId: number): Promise<any> {
  const timestamp = Date.now();
  const queryString = `symbol=${symbol}USDT&orderId=${orderId}&timestamp=${timestamp}`;
  const signature = generateSignature(queryString);
  
  const url = `${BINANCE_MAINNET_URL}/v3/order?${queryString}&signature=${signature}`;
  
  const response = await proxyFetch(url, {
    method: 'DELETE',
    headers: {
      'X-MBX-APIKEY': API_KEY!,
    },
  });
  
  const data = await response.json();
  console.log('[MAINNET] Cancel order response:', data);
  return data;
}

async function getOpenOrders(symbol?: string): Promise<any> {
  const timestamp = Date.now();
  let queryString = `timestamp=${timestamp}`;
  if (symbol) {
    queryString = `symbol=${symbol}USDT&${queryString}`;
  }
  const signature = generateSignature(queryString);
  
  const url = `${BINANCE_MAINNET_URL}/v3/openOrders?${queryString}&signature=${signature}`;
  
  const response = await proxyFetch(url, {
    method: 'GET',
    headers: {
      'X-MBX-APIKEY': API_KEY!,
    },
  });
  
  const data = await response.json();
  console.log('[MAINNET] Open orders response:', data);
  return data;
}

async function getTicker24hr(): Promise<any> {
  const url = `${BINANCE_MAINNET_URL}/v3/ticker/24hr`;
  
  const response = await proxyFetch(url, {
    method: 'GET',
    headers: {},
  });
  
  return await response.json();
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate environment variables
    if (!API_KEY || !SECRET_KEY) {
      console.error('Missing API credentials');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing Binance Mainnet API credentials. Please configure BINANCE_MAINNET_API_KEY and BINANCE_MAINNET_SECRET_KEY.' 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { action, symbol, side, quantity, orderId } = body;

    console.log('[MAINNET] Received request:', { action, symbol, side, quantity, orderId });

    let result;

    switch (action) {
      case 'balance':
        result = await getAccountBalance();
        break;
      
      case 'order':
        if (!symbol || !side || !quantity) {
          return new Response(
            JSON.stringify({ success: false, error: 'Missing required parameters: symbol, side, quantity' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        result = await placeOrder(symbol, side, parseFloat(quantity));
        break;
      
      case 'cancel':
        if (!symbol || !orderId) {
          return new Response(
            JSON.stringify({ success: false, error: 'Missing required parameters: symbol, orderId' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        result = await cancelOrder(symbol, orderId);
        break;
      
      case 'openOrders':
        result = await getOpenOrders(symbol);
        break;
      
      case 'exchangeInfo':
        result = await getExchangeInfo(symbol);
        break;
      
      case 'ticker':
        result = await getTicker24hr();
        break;
      
      case 'test':
        // Test connection and return proxy status
        result = { 
          connected: true, 
          mainnet: true, 
          proxyEnabled: !!PROXY_URL,
          timestamp: Date.now() 
        };
        break;
      
      default:
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid action. Use: balance, order, cancel, openOrders, exchangeInfo, ticker, test' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[MAINNET] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
