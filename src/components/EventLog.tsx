import { useEffect, useRef } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Trash2, Terminal } from 'lucide-react';
import { LogEntry } from '@/lib/indexedDB';

interface EventLogProps {
  logs: LogEntry[];
  onClear: () => void;
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
      return '[OK]';
    case 'warning':
      return '[WARN]';
    case 'error':
      return '[ERR]';
    default:
      return '[LOG]';
  }
};

export const EventLog = ({ logs, onClear }: EventLogProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="terminal-card h-full flex flex-col">
      <div className="flex items-center justify-between p-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-terminal-green" />
          <span className="text-sm font-medium text-terminal-green">EVENT_LOG</span>
          <span className="text-xs text-muted-foreground">({logs.length} entries)</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          className="h-7 px-2 text-muted-foreground hover:text-terminal-red hover:bg-terminal-red/10"
        >
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>
      
      <ScrollArea className="flex-1 p-3" ref={scrollRef}>
        <div className="space-y-1 font-mono text-xs">
          {logs.length === 0 ? (
            <div className="text-muted-foreground animate-pulse">
              Awaiting system events...
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
