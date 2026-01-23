import { useRef, useEffect, useState } from 'react';
import { Terminal, Copy, Check, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
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

interface CompactLogsProps {
  logs: LogEntry[];
  onClear: () => void;
  diagnosticData?: DiagnosticData;
  isLive?: boolean;
}

const getLogColor = (type: LogEntry['type']) => {
  switch (type) {
    case 'success': return 'text-terminal-green';
    case 'warning': return 'text-terminal-amber';
    case 'error': return 'text-terminal-red';
    default: return 'text-muted-foreground';
  }
};

export const CompactLogs = ({ logs, onClear, diagnosticData, isLive = true }: CompactLogsProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const copyToClipboard = async (text: string): Promise<boolean> => {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        // Fallback below
      }
    }
    
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const success = document.execCommand('copy');
      document.body.removeChild(textarea);
      return success;
    } catch {
      return false;
    }
  };

  const handleCopy = async () => {
    const VERSION = 'v2.3-S20-Only';
    const logsText = logs.map(log => `[${log.timestamp}] ${log.message}`).join('\n');
    
    // v2.3-S20-Only: Diagnostic bundle shows REAL balance only
    const diagnosticBundle = diagnosticData ? {
      الإصدار: VERSION,
      الوضع: isLive ? 'حقيقي (LIVE)' : 'افتراضي',
      المحرك_النشط: 'S20 - النطاق (المحرك الوحيد)',
      الاستراتيجيات_المعطلة: ['S10 الاختراق', 'S65 الارتداد', 'المؤسسي', 'التقاطعات'],
      الطابع_الزمني: new Date().toISOString(),
      المحفظة: {
        السيولة_المتاحة: `${diagnosticData.virtualBalance.toFixed(2)} USDT`,
        قيمة_العملات: `${diagnosticData.openPositionsValue.toFixed(2)} USDT`,
        القيمة_الإجمالية: `${diagnosticData.totalPortfolioValue.toFixed(2)} USDT`,
      },
      إعدادات_الصفقة: {
        نسبة_الدخول: '40% من الرصيد المتاح',
        الحد_الأدنى: '10 USDT',
        الاحتياطي: '5 USDT',
        عتبة_الشراء_التلقائي: '≥60/100',
        TP: '1.2%',
        SL: '0.8%',
      },
      التداول: {
        الصفقات_المفتوحة: `${diagnosticData.openPositions}/10`,
        إجمالي_الصفقات: diagnosticData.totalTrades,
        نسبة_النجاح: `${diagnosticData.winRate.toFixed(1)}%`,
        الربح_الصافي: `${diagnosticData.totalPnL >= 0 ? '+' : ''}$${diagnosticData.totalPnL.toFixed(2)}`,
      },
      المقاييس: {
        إجمالي_العملات_المفحوصة: diagnosticData.totalScanned,
        فرص_S20_المكتشفة: diagnosticData.opportunities,
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
    <div className="bg-card/50 rounded-2xl border border-border/50 overflow-hidden backdrop-blur-sm">
      {/* Header */}
      <div 
        className="flex items-center justify-between p-3 border-b border-border/50 cursor-pointer hover:bg-secondary/30 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-terminal-green" />
          <span className="text-sm font-medium text-foreground">السجلات</span>
          <span className="text-xs text-muted-foreground">({logs.length})</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleCopy();
            }}
            className="h-7 w-7 p-0 text-muted-foreground hover:text-terminal-green"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
            className="h-7 w-7 p-0 text-muted-foreground hover:text-terminal-red"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </div>

      {/* Logs Content */}
      <div className={`transition-all duration-300 ${isExpanded ? 'max-h-[300px]' : 'max-h-[120px]'}`}>
        <ScrollArea className="h-full p-3" ref={scrollRef}>
          <div className="space-y-1 font-mono text-[11px]">
            {logs.length === 0 ? (
              <div className="text-muted-foreground text-center py-4">
                في انتظار أحداث النظام...
              </div>
            ) : (
              logs.slice(-50).map((log, index) => (
                <div key={log.id || index} className={`flex gap-2 ${getLogColor(log.type)}`}>
                  <span className="text-muted-foreground shrink-0">[{log.timestamp}]</span>
                  <span className="truncate">{log.message}</span>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};
