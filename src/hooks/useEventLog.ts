import { useState, useEffect, useCallback } from 'react';
import { addLog, getLogs, clearLogs, LogEntry } from '@/lib/indexedDB';

export const useEventLog = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);

  useEffect(() => {
    const loadLogs = async () => {
      try {
        const savedLogs = await getLogs(200);
        setLogs(savedLogs);
      } catch (error) {
        console.error('Failed to load logs:', error);
      }
    };
    loadLogs();
  }, []);

  const addLogEntry = useCallback(async (message: string, type: LogEntry['type'] = 'info') => {
    const now = new Date();
    const timestamp = now.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });

    const entry: Omit<LogEntry, 'id'> = {
      timestamp,
      message,
      type,
    };

    try {
      await addLog(entry);
      setLogs(prev => [...prev, { ...entry, id: Date.now() }].slice(-200));
    } catch (error) {
      console.error('Failed to add log:', error);
    }
  }, []);

  const clearAllLogs = useCallback(async () => {
    try {
      await clearLogs();
      setLogs([]);
    } catch (error) {
      console.error('Failed to clear logs:', error);
    }
  }, []);

  const reloadLogs = useCallback(async () => {
    try {
      const savedLogs = await getLogs(200);
      setLogs(savedLogs);
    } catch (error) {
      console.error('Failed to reload logs:', error);
    }
  }, []);

  return { logs, addLogEntry, clearAllLogs, reloadLogs };
};
