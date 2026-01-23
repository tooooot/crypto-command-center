import { useRef, useEffect, useState } from 'react';
import { Terminal, Copy, Check, Trash2, ChevronDown, ChevronUp, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { LogEntry } from '@/lib/indexedDB';
import { StrategyEngineState } from '@/hooks/useStrategyEngine';

interface StrategyReport {
  name: string;
  nameAr: string;
  tag: string;
  state: StrategyEngineState;
}

interface UnifiedLogsProps {
  logs: LogEntry[];
  onClear: () => void;
  strategies: StrategyReport[];
  totalScanned: number;
  totalOpportunities: number;
}

const getLogColor = (type: LogEntry['type']) => {
  switch (type) {
    case 'success': return 'text-terminal-green';
    case 'warning': return 'text-terminal-amber';
    case 'error': return 'text-terminal-red';
    default: return 'text-muted-foreground';
  }
};

export const UnifiedLogs = ({ logs, onClear, strategies, totalScanned, totalOpportunities }: UnifiedLogsProps) => {
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

  const handleCopyFullReport = async () => {
    const VERSION = 'v3.0.0-LAB';
    const logsText = logs.map(log => `[${log.timestamp}] ${log.message}`).join('\n');
    
    // Build comprehensive report
    const totalPortfolio = strategies.reduce((sum, s) => sum + s.state.totalPortfolioValue, 0);
    const totalInitial = strategies.length * 5000;
    const overallROI = ((totalPortfolio - totalInitial) / totalInitial) * 100;
    
    const strategyReports = strategies.map(s => ({
      الاستراتيجية: s.nameAr,
      الوسم: s.tag,
      الرصيد: `${s.state.balance.toFixed(2)} USDT`,
      قيمة_المحفظة: `${s.state.totalPortfolioValue.toFixed(2)} USDT`,
      نسبة_العائد: `${s.state.roi >= 0 ? '+' : ''}${s.state.roi.toFixed(2)}%`,
      الصفقات_المفتوحة: s.state.openPositionsCount,
      إجمالي_الصفقات: s.state.performanceStats.totalTrades,
      نسبة_النجاح: `${s.state.performanceStats.winRate.toFixed(1)}%`,
      الربح_الصافي: `${s.state.performanceStats.totalPnL >= 0 ? '+' : ''}$${s.state.performanceStats.totalPnL.toFixed(2)}`,
    }));

    const fullReport = {
      الإصدار: VERSION,
      الطابع_الزمني: new Date().toISOString(),
      ملخص_عام: {
        إجمالي_المحفظة: `${totalPortfolio.toFixed(2)} USDT`,
        العائد_الإجمالي: `${overallROI >= 0 ? '+' : ''}${overallROI.toFixed(2)}%`,
        العملات_المراقبة: totalScanned,
        الفرص_المكتشفة: totalOpportunities,
      },
      أداء_الاستراتيجيات: strategyReports,
    };

    const fullReportText = `
═══════════════════════════════════════════════
        تقرير التحليل الشامل - مختبر الاستراتيجيات
═══════════════════════════════════════════════

${JSON.stringify(fullReport, null, 2)}

═══════════════════════════════════════════════
                  سجل العمليات الموحد
═══════════════════════════════════════════════

${logsText}

═══════════════════════════════════════════════
`;
    
    const success = await copyToClipboard(fullReportText);
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
          <span className="text-sm font-medium text-foreground">السجل الموحد</span>
          <span className="text-xs text-muted-foreground">({logs.length})</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleCopyFullReport();
            }}
            className="h-7 px-2 text-muted-foreground hover:text-terminal-green gap-1"
            title="نسخ تقرير التحليل الشامل"
          >
            <FileText className="w-3.5 h-3.5" />
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
      <div className={`transition-all duration-300 ${isExpanded ? 'max-h-[400px]' : 'max-h-[150px]'}`}>
        <ScrollArea className="h-full p-3" ref={scrollRef}>
          <div className="space-y-1 font-mono text-[11px]">
            {logs.length === 0 ? (
              <div className="text-muted-foreground text-center py-4">
                في انتظار أحداث النظام...
              </div>
            ) : (
              logs.slice(-100).map((log, index) => (
                <div key={log.id || index} className={`flex gap-2 ${getLogColor(log.type)}`}>
                  <span className="text-muted-foreground shrink-0">[{log.timestamp}]</span>
                  <span className="break-words">{log.message}</span>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};
