import { createHmac } from "node:crypto";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BINANCE_TESTNET_URL = 'https://testnet.binance.vision/api';
const API_KEY = Deno.env.get('BINANCE_TESTNET_API_KEY')?.trim();
const SECRET_KEY = Deno.env.get('BINANCE_TESTNET_SECRET_KEY')?.trim();

function generateSignature(queryString: string): string {
  const hmac = createHmac('sha256', SECRET_KEY!);
  hmac.update(queryString);
  return hmac.digest('hex');
}

async function getAccountBalance(): Promise<any> {
  const timestamp = Date.now();
  const queryString = `timestamp=${timestamp}`;
  const signature = generateSignature(queryString);
  
  const url = `${BINANCE_TESTNET_URL}/v3/account?${queryString}&signature=${signature}`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'X-MBX-APIKEY': API_KEY!,
    },
  });
  
  const data = await response.json();
  console.log('Account balance response:', data);
  return data;
}

async function placeOrder(
  symbol: string,
  side: 'BUY' | 'SELL',
  quantity: number,
  price?: number
): Promise<any> {
  const timestamp = Date.now();
  
  // Build query params
  const params: Record<string, string> = {
    symbol: symbol,
    side: side,
    type: price ? 'LIMIT' : 'MARKET',
    quantity: quantity.toString(),
    timestamp: timestamp.toString(),
  };
  
  if (price) {
    params.timeInForce = 'GTC';
    params.price = price.toString();
  }
  
  const queryString = Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&');
  
  const signature = generateSignature(queryString);
  const url = `${BINANCE_TESTNET_URL}/v3/order?${queryString}&signature=${signature}`;
  
  console.log(`Placing ${side} order for ${symbol}:`, params);
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'X-MBX-APIKEY': API_KEY!,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });
  
  const data = await response.json();
  console.log('Order response:', data);
  return data;
}

async function cancelOrder(symbol: string, orderId: number): Promise<any> {
  const timestamp = Date.now();
  const queryString = `symbol=${symbol}&orderId=${orderId}&timestamp=${timestamp}`;
  const signature = generateSignature(queryString);
  
  const url = `${BINANCE_TESTNET_URL}/v3/order?${queryString}&signature=${signature}`;
  
  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      'X-MBX-APIKEY': API_KEY!,
    },
  });
  
  const data = await response.json();
  console.log('Cancel order response:', data);
  return data;
}

async function getOpenOrders(symbol?: string): Promise<any> {
  const timestamp = Date.now();
  let queryString = `timestamp=${timestamp}`;
  if (symbol) {
    queryString = `symbol=${symbol}&${queryString}`;
  }
  const signature = generateSignature(queryString);
  
  const url = `${BINANCE_TESTNET_URL}/v3/openOrders?${queryString}&signature=${signature}`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'X-MBX-APIKEY': API_KEY!,
    },
  });
  
  const data = await response.json();
  console.log('Open orders response:', data);
  return data;
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
          error: 'Missing Binance Testnet API credentials' 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { action, symbol, side, quantity, price, orderId } = body;

    console.log('Received request:', { action, symbol, side, quantity, price, orderId });

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
        result = await placeOrder(symbol, side, parseFloat(quantity), price ? parseFloat(price) : undefined);
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
      
      case 'test':
        // Test connection
        result = { connected: true, testnet: true, timestamp: Date.now() };
        break;
      
      default:
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid action. Use: balance, order, cancel, openOrders, test' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in binance-testnet-trade:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
