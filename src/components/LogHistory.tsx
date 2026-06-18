/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  ClipboardList, 
  Trash2, 
  AlertOctagon, 
  CheckCircle2, 
  Activity,
  History,
  Download
} from 'lucide-react';
import { DetectionLog, AccessibilityTheme } from '../types';

interface LogHistoryProps {
  logs: DetectionLog[];
  onClearLogs: () => void;
  activeTheme: AccessibilityTheme;
  themeStyle: any;
}

export default function LogHistory({
  logs,
  onClearLogs,
  activeTheme,
  themeStyle
}: LogHistoryProps) {

  const formatTime = (timestamp: number) => {
    const d = new Date(timestamp);
    const hrs = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    const secs = String(d.getSeconds()).padStart(2, '0');
    const ms = String(Math.floor(d.getMilliseconds() / 100)).substring(0, 1);
    return `${hrs}:${mins}:${secs}.${ms}`;
  };

  const exportLogsAsCSV = () => {
    if (logs.length === 0) return;
    const headers = ['ID', 'Timestamp', 'LocalTime', 'ItemDetected', 'ZonePosition', 'HazardStatus', 'Confidence'];
    const rows = logs.map(l => [
      l.id,
      l.timestamp,
      new Date(l.timestamp).toISOString(),
      l.label,
      l.position,
      l.isHazard ? 'HAZARD' : 'SAFE',
      l.confidence.toFixed(2)
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `obstacle_detector_logs_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 flex flex-col h-[400px]" id="log-history-panel">
      {/* Header operations bar */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0" id="logs-header-container">
        <div className="flex items-center gap-3">
          <History className="w-5 h-5 text-emerald-400" />
          <h3 className="text-sm font-semibold tracking-wide uppercase text-neutral-300">
            Real-Time Diagnostic Log
          </h3>
          <span className="text-xs bg-neutral-950 px-2 py-0.5 rounded-full text-neutral-400 font-mono font-bold" aria-label={`${logs.length} logged detections`}>
            {logs.length}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {logs.length > 0 && (
            <>
              <button
                id="export-csv-btn"
                onClick={exportLogsAsCSV}
                className="text-xs text-neutral-400 hover:text-white bg-neutral-950 border border-neutral-800 hover:border-neutral-700 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all"
                title="Export list of detected obstacles as CSV"
              >
                <Download className="w-3.5 h-3.5" />
                Export CSV
              </button>
              <button
                id="clear-logs-btn"
                onClick={onClearLogs}
                className="text-xs text-red-400 hover:text-red-300 bg-neutral-950/20 hover:bg-neutral-950 border border-neutral-800 hover:border-red-950/50 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all"
                title="Clear current log trail"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear
              </button>
            </>
          )}
        </div>
      </div>

      <p className="text-xs text-neutral-400 mb-3 flex-shrink-0">
        History of critical telemetry and bounding obstacles identified relative to user path.
      </p>

      {/* Actual list scrolling box */}
      <div 
        className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-thin scrollbar-thumb-neutral-800 scrollbar-track-transparent text-left" 
        id="logs-scroller"
        role="log"
        aria-live="polite"
        aria-relevant="additions"
      >
        {logs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 border-2 border-dashed border-neutral-800 rounded-lg" id="no-logs-standby">
            <ClipboardList className="w-10 h-10 text-neutral-700 mb-2" />
            <h4 className="text-sm font-semibold text-neutral-400">Empty Log Stream</h4>
            <p className="text-xs text-neutral-500 max-w-[200px] mt-1">
              Start detection and walk around to capture hazard telemetry.
            </p>
          </div>
        ) : (
          logs.map((log) => {
            const isHazard = log.isHazard;
            return (
              <div
                key={log.id}
                id={`log-item-${log.id}`}
                className={`p-3 rounded-lg flex items-center justify-between border transition-all text-xs ${
                  isHazard
                    ? (themeStyle.isHighContrast 
                        ? 'bg-red-950/20 border-red-500 text-red-300' 
                        : 'bg-red-955/10 border-red-900/40 text-red-200')
                    : 'bg-neutral-950 border-neutral-855 text-neutral-300'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  {isHazard ? (
                    <AlertOctagon className="w-4 h-4 text-red-500 flex-shrink-0 animate-pulse" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  )}
                  <div className="flex flex-col gap-0.5">
                    <span className="font-bold uppercase tracking-wider capitalize flex items-center gap-1.5">
                      {log.label}
                      <span className="text-[10px] font-semibold text-neutral-400 bg-neutral-850 px-1.5 py-0.5 rounded-full lowercase">
                        {log.position}
                      </span>
                    </span>
                    <span className="text-[10.5px] font-mono text-neutral-500 flex items-center gap-1">
                      Confidence: {Math.round(log.confidence * 100)}%
                    </span>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1 font-mono text-[10px] text-neutral-400">
                  <span className="text-neutral-500">{formatTime(log.timestamp)}</span>
                  {isHazard && (
                    <span className="text-[9px] font-sans font-bold bg-red-950 border border-red-900 text-red-400 px-1.5 py-0.5 rounded uppercase tracking-wider">
                      Immediate Hazard
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
