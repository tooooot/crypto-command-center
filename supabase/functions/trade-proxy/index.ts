const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const VULTR_SERVER = 'http://108.61.175.57:3000';

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  
  try {
    const body = await req.json();
    const { action, ...tradeData } = body;
    
    console.log(`[PROXY] Received request - Action: ${action}`);
    console.log(`[PROXY] Trade data:`, JSON.stringify(tradeData));
    
    // Health check endpoint
    if (action === 'health') {
      console.log(`[PROXY] Health check to ${VULTR_SERVER}/health`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      try {
        const response = await fetch(`${VULTR_SERVER}/health`, {
          method: 'GET',
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
        const data = await response.json();
        const latency = Date.now() - startTime;
        
        console.log(`[PROXY] Health response:`, JSON.stringify(data));
        
        return new Response(
          JSON.stringify({ success: true, data, latency, serverOnline: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (healthError) {
        clearTimeout(timeoutId);
        throw healthError;
      }
    }
    
    // Trade execution
    console.log(`[PROXY] Forwarding trade to ${VULTR_SERVER}/api/execute-trade`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    
    try {
      const response = await fetch(`${VULTR_SERVER}/api/execute-trade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tradeData),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      const data = await response.json();
      const latency = Date.now() - startTime;
      
      console.log(`[PROXY] Trade response - Status: ${response.status}`);
      console.log(`[PROXY] Trade data:`, JSON.stringify(data));
      
      return new Response(
        JSON.stringify({ success: true, data, latency, serverOnline: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (tradeError) {
      clearTimeout(timeoutId);
      throw tradeError;
    }
    
  } catch (error) {
    const latency = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    console.error(`[PROXY] Error after ${latency}ms:`, errorMessage);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage,
        serverOnline: false,
        latency
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
