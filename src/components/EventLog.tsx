import { useEffect, useRef, useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Trash2, Terminal, Copy, Check } from 'lucide-react';
import { LogEntry } from '@/lib/indexedDB';

interface DiagnosticData {
  virtualBalance: number;
  openPositionsValue: number;
  totalPortfolioValue: number;
  totalScanned: number;
  opportunities: number;
  openPositions: number;
  totalTrades: number;
  winRate: number;
  totalPnL: number;
}

interface EventLogProps {
  logs: LogEntry[];
  onClear: () => void;
  diagnosticData?: DiagnosticData;
}

const getLogColor = (type: LogEntry['type']) => {
  switch (type) {
    case 'success':
      return 'text-terminal-green';
    case 'warning':
      return 'text-terminal-amber';
    case 'error':
      return 'text-terminal-red';
    default:
      return 'text-muted-foreground';
  }
};

const getLogPrefix = (type: LogEntry['type']) => {
  switch (type) {
    case 'success':
      return '[تم]';
    case 'warning':
      return '[تنبيه]';
    case 'error':
      return '[خطأ]';
    default:
      return '[معلومة]';
  }
};

export const EventLog = ({ logs, onClear, diagnosticData }: EventLogProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const copyToClipboard = async (text: string): Promise<boolean> => {
    // Try modern Navigator Clipboard API first
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (err) {
        console.warn('Navigator clipboard failed, trying fallback:', err);
      }
    }
    
    // Fallback: Create a temporary textarea element
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      textarea.style.top = '-9999px';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const success = document.execCommand('copy');
      document.body.removeChild(textarea);
      return success;
    } catch (err) {
      console.error('Clipboard fallback also failed:', err);
      return false;
    }
  };

  const handleCopy = async () => {
    const VERSION = 'v1.5.1-AR';
    const logsText = logs.map(log => `[${log.timestamp}] ${getLogPrefix(log.type)} ${log.message}`).join('\n');
    
    const diagnosticBundle = diagnosticData ? {
      الإصدار: VERSION,
      الطابع_الزمني: new Date().toISOString(),
      المحفظة: {
        السيولة_المتاحة: `${diagnosticData.virtualBalance.toFixed(2)} USDT`,
        قيمة_العملات: `${diagnosticData.openPositionsValue.toFixed(2)} USDT`,
        القيمة_الإجمالية: `${diagnosticData.totalPortfolioValue.toFixed(2)} USDT`,
      },
      التداول: {
        الصفقات_المفتوحة: `${diagnosticData.openPositions}/10`,
        إجمالي_الصفقات: diagnosticData.totalTrades,
        نسبة_النجاح: `${diagnosticData.winRate.toFixed(1)}%`,
        الربح_الصافي: `${diagnosticData.totalPnL >= 0 ? '+' : ''}$${diagnosticData.totalPnL.toFixed(2)}`,
      },
      المقاييس: {
        إجمالي_العملات_المفحوصة: diagnosticData.totalScanned,
        الفرص_المكتشفة: diagnosticData.opportunities,
      },
    } : null;

    const fullReport = `=== سجل العمليات ===\n${logsText}\n\n=== حزمة التشخيص ===\n${JSON.stringify(diagnosticBundle, null, 2)}`;
    
    const success = await copyToClipboard(fullReport);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="terminal-card h-full flex flex-col">
      <div className="flex items-center justify-between p-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-terminal-green" />
          <span className="text-sm font-medium text-terminal-green">سجل_العمليات</span>
          <span className="text-xs text-muted-foreground">({logs.length} سجل)</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="h-7 px-2 text-muted-foreground hover:text-terminal-green hover:bg-terminal-green/10"
            title="نسخ السجل مع التشخيص"
          >
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="h-7 px-2 text-muted-foreground hover:text-terminal-red hover:bg-terminal-red/10"
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </div>
      
      <ScrollArea className="flex-1 p-3" ref={scrollRef}>
        <div className="space-y-1 font-mono text-xs">
          {logs.length === 0 ? (
            <div className="text-muted-foreground animate-pulse">
              في انتظار أحداث النظام...
            </div>
          ) : (
            logs.map((log, index) => (
              <div
                key={log.id || index}
                className={`flex gap-2 animate-fade-in ${getLogColor(log.type)}`}
              >
                <span className="text-muted-foreground shrink-0">[{log.timestamp}]</span>
                <span className="shrink-0">{getLogPrefix(log.type)}</span>
                <span>{log.message}</span>
              </div>
            ))
          )}
          <span className="inline-block w-2 h-4 bg-terminal-green animate-blink" />
        </div>
      </ScrollArea>
    </div>
  );
};
