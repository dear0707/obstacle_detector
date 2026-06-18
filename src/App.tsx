/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Eye, 
  Volume2, 
  VolumeX, 
  Settings, 
  HelpCircle, 
  ShieldAlert, 
  Sparkles, 
  Activity, 
  Moon, 
  Sun, 
  Maximize2,
  Minimize2,
  BookOpen,
  Info,
  Clock,
  ChevronDown,
  ThumbsUp,
  Sliders,
  CheckCircle,
  Play,
  Square,
  RefreshCw
} from 'lucide-react';
import { useTfModel } from './utils/useTfModel';
import { audioEngine } from './utils/audioEngine';
import { CalibrationSettings, AccessibilityTheme, ObstaclePrediction, DetectionLog } from './types';
import SettingsPanel from './components/SettingsPanel';
import ObjectRadarCanvas from './components/ObjectRadarCanvas';
import LogHistory from './components/LogHistory';

const INITIAL_SETTINGS: CalibrationSettings = {
  confidenceThreshold: 0.55,
  hazardSizeThreshold: 0.35, // 35% of screen width constitutes "highly close / hazard"
  speechRate: 1.2,
  cooldownPeriod: 3000,
  soundEnabled: true,
  soundType: 'both',
  activeCategories: [
    'chair', 'couch', 'person', 'dog', 'cat', 'backpack', 
    'handbag', 'suitcase', 'cup', 'bottle', 'car', 'dining table',
    'bicycle', 'motorcycle', 'bus', 'truck', 'traffic light', 'stop sign'
  ],
  wallDetectionEnabled: true,
  voiceCommandsEnabled: false,
  distanceUnit: 'feet'
};

// Accessible colors and contrast mappings based on Theme choice
const THEME_STYLES: Record<AccessibilityTheme, {
  bg: string;
  cardBg: string;
  borderClass: string;
  gridLineColor: string;
  textColor: string;
  textMutedColor: string;
  accentColor: string;
  accentBg: string;
  warningSecColor?: string;
  dangerColor?: string;
  dangerBg?: string;
  dangerText?: string;
  badgeBg: string;
  headerBg: string;
  buttonActiveBg: string;
  isHighContrast?: boolean;
}> = {
  'dark': {
    bg: 'bg-neutral-950',
    cardBg: 'bg-neutral-900',
    borderClass: 'border-neutral-800',
    gridLineColor: 'rgba(255, 255, 255, 0.15)',
    textColor: '#ffffff',
    textMutedColor: 'text-neutral-400',
    accentColor: '#10b981', // emerald-500
    accentBg: 'bg-emerald-950/30',
    dangerColor: '#ef4444', // red-500
    dangerBg: '#7f1d1d',
    dangerText: '#fecaca',
    badgeBg: '#171717',
    headerBg: 'bg-neutral-900 border-neutral-800',
    buttonActiveBg: 'bg-neutral-800'
  },
  'high-contrast-yellow': {
    bg: 'bg-black',
    cardBg: 'bg-black',
    borderClass: 'border-2 border-yellow-400',
    gridLineColor: 'rgba(250, 204, 21, 0.45)',
    textColor: '#facc15', // yellow-400
    textMutedColor: 'text-yellow-500 font-bold',
    accentColor: '#eab308', // pure yellow
    accentBg: 'bg-yellow-950/50',
    warningSecColor: '#fbbf24',
    dangerColor: '#fca5a5',
    dangerBg: '#450a0a',
    dangerText: '#fca5a5',
    badgeBg: '#1c1917',
    headerBg: 'bg-black border-yellow-400 border-2',
    buttonActiveBg: 'bg-stone-900',
    isHighContrast: true
  },
  'high-contrast-white': {
    bg: 'bg-black',
    cardBg: 'bg-black',
    borderClass: 'border-2 border-white',
    gridLineColor: 'rgba(255, 255, 255, 0.6)',
    textColor: '#ffffff',
    textMutedColor: 'text-neutral-300 font-bold',
    accentColor: '#ffffff',
    accentBg: 'bg-neutral-900',
    dangerColor: '#ffffff',
    dangerBg: '#ffffff',
    dangerText: '#000000',
    badgeBg: '#000000',
    headerBg: 'bg-black border-b border-white',
    buttonActiveBg: 'bg-neutral-900',
    isHighContrast: true
  },
  'accessible-blue': {
    bg: 'bg-slate-950',
    cardBg: 'bg-slate-900',
    borderClass: 'border-blue-900',
    gridLineColor: 'rgba(96, 165, 250, 0.25)',
    textColor: '#93c5fd', // blue-300
    textMutedColor: 'text-slate-400',
    accentColor: '#3b82f6', // blue-500
    accentBg: 'bg-blue-950/30',
    dangerColor: '#f87171',
    dangerBg: '#7f1d1d',
    dangerText: '#fecaca',
    badgeBg: '#0f172a',
    headerBg: 'bg-slate-900 border-blue-900',
    buttonActiveBg: 'bg-slate-800'
  }
};

export default function App() {
  const [settings, setSettings] = useState<CalibrationSettings>(INITIAL_SETTINGS);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [activeTheme, setActiveTheme] = useState<AccessibilityTheme>('dark');
  const [activeTab, setActiveTab] = useState<'detector' | 'instructions'>('detector');
  const [logs, setLogs] = useState<DetectionLog[]>([]);

  const [isListeningVoice, setIsListeningVoice] = useState<boolean>(false);
  const [speechSupported, setSpeechSupported] = useState<boolean>(false);
  const [voicePermissionError, setVoicePermissionError] = useState<boolean>(false);

  // Initialize TFJS load hook
  const { model, loading: modelLoading, error: modelError, status: modelStatus } = useTfModel();

  const themeStyle = useMemo(() => THEME_STYLES[activeTheme], [activeTheme]);

  // Voice Recognition Engine for Start/Stop controller
  useEffect(() => {
    const SpeechClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechClass) {
      setSpeechSupported(false);
      return;
    }
    setSpeechSupported(true);

    if (!settings.voiceCommandsEnabled) {
      setIsListeningVoice(false);
      setVoicePermissionError(false);
      return;
    }

    const rec = new SpeechClass();
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = 'en-US';

    rec.onstart = () => {
      setIsListeningVoice(true);
      setVoicePermissionError(false);
      console.log("Voice Command Recognition Listener Active");
    };

    rec.onresult = (event: any) => {
      const resultIndex = event.resultIndex;
      const transcript = event.results[resultIndex][0].transcript.toLowerCase().trim();
      console.log("Caught transcript segment:", transcript);

      if (transcript.includes("start") || transcript.includes("activate") || transcript.includes("navigation") || transcript.includes("go") || transcript.includes("resume")) {
        setIsScanning(prev => {
          if (!prev) {
            audioEngine.speak("Voice command received. Starting detection.", settings.speechRate, 1000, true);
            return true;
          }
          return prev;
        });
      } else if (transcript.includes("stop") || transcript.includes("standby") || transcript.includes("pause") || transcript.includes("disable") || transcript.includes("deactivate") || transcript.includes("halt")) {
        setIsScanning(prev => {
          if (prev) {
            audioEngine.speak("Voice command received. Pausing detection.", settings.speechRate, 1000, true);
            audioEngine.stopAll();
            return false;
          }
          return prev;
        });
      }
    };

    rec.onerror = (e: any) => {
      console.warn("Speech engine warning:", e.error);
      if (e.error === 'not-allowed') {
        setIsListeningVoice(false);
        setVoicePermissionError(true);
      }
    };

    rec.onend = () => {
      if (settings.voiceCommandsEnabled && !voicePermissionError) {
        try {
          rec.start();
        } catch (err) {
          // silent bypass
        }
      } else {
        setIsListeningVoice(false);
      }
    };

    try {
      rec.start();
    } catch (err) {
      console.error(err);
    }

    return () => {
      try {
        rec.abort();
      } catch (err) {
        // silent bypass
      }
      setIsListeningVoice(false);
    };
  }, [settings.voiceCommandsEnabled, settings.speechRate, voicePermissionError]);

  // Handle master calibration reset
  const handleCalibrationReset = () => {
    setSettings(INITIAL_SETTINGS);
    audioEngine.speak("Calibration levels restored.", INITIAL_SETTINGS.speechRate, 2000, true);
  };

  // Log clearing
  const handleClearLogs = () => {
    setLogs([]);
    audioEngine.speak("Logs cleared.", settings.speechRate, 2000, true);
  };

  // Frame detection processor callback
  const handlePredictionsUpdated = useCallback((predictions: ObstaclePrediction[]) => {
    if (predictions.length === 0) return;

    // Filter to only categories that are selected by the user, plus any walls detected
    const filteredPredictions = predictions.filter(p => 
      p.class === 'wall' || settings.activeCategories.includes(p.class)
    );

    if (filteredPredictions.length === 0) return;

    // Separate hazards from regular obstacles
    const hazards = filteredPredictions.filter(p => p.isHazard);

    // If Sound Output is turned ON:
    if (settings.soundEnabled) {
      if (hazards.length > 0) {
        // Choose the most immediate critical hazard (biggest scale / width ratio)
        const principalHazard = hazards.reduce((prev, current) => 
          (prev.distanceFactor > current.distanceFactor) ? prev : current
        );

        // Sound Proximity Radar Beeper
        if (settings.soundType === 'beeps' || settings.soundType === 'both') {
          audioEngine.triggerProximityBeep(principalHazard.distanceFactor);
        }

        // Sound Speech Synthesis Alert
        if (settings.soundType === 'speech' || settings.soundType === 'both') {
          const locationText = principalHazard.position === 'center' 
            ? 'directly ahead' 
            : `on your ${principalHazard.position}`;
          
          const distanceValue = settings.distanceUnit === 'feet'
            ? `${principalHazard.distanceFt} feet`
            : `${principalHazard.distanceM} meters`;
          
          const label = principalHazard.class === 'wall' ? 'wall' : principalHazard.class;

          audioEngine.speak(
            `Warning: ${label} ${locationText}, about ${distanceValue} away`,
            settings.speechRate,
            settings.cooldownPeriod
          );
        }
      } else {
        // No immediate hazard, but there are obstacles in view.
        // Alert general observations at a relaxed, longer cooldown to avoid noise fatigue.
        const prominentObstacle = filteredPredictions.reduce((prev, current) => 
          (prev.score > current.score) ? prev : current
        );

        if (settings.soundType === 'speech' || settings.soundType === 'both') {
          const locText = prominentObstacle.position === 'center' 
            ? 'ahead' 
            : `on your ${prominentObstacle.position}`;

          const distanceValue = settings.distanceUnit === 'feet'
            ? `${prominentObstacle.distanceFt} feet`
            : `${prominentObstacle.distanceM} meters`;

          const label = prominentObstacle.class === 'wall' ? 'wall' : prominentObstacle.class;

          audioEngine.speak(
            `${label} ${locText}, about ${distanceValue} away`,
            settings.speechRate,
            settings.cooldownPeriod * 1.5 // 50% extra grace cooldown for safe/general obstacles
          );
        }
      }
    }

    // Capture logs for diagnostics
    // Limit log triggers to once every 1200ms to keep log historical audit fast and legible
    setLogs(prev => {
      const now = Date.now();
      const lastLog = prev[0];
      if (lastLog && (now - lastLog.timestamp) < 1200) {
        return prev;
      }

      // Add prominent objects to logs
      const itemsToLog = hazards.length > 0 ? hazards : [filteredPredictions[0]];
      const newLogs: DetectionLog[] = itemsToLog.map(item => ({
        id: `${item.class}-${now}-${Math.random().toString(36).substring(2, 5)}`,
        timestamp: now,
        label: item.class,
        position: item.position,
        isHazard: item.isHazard,
        confidence: item.score
      }));

      // slice at 150 entries to avoid memory hogging
      return [...newLogs, ...prev].slice(0, 150);
    });
  }, [settings]);

  // Master power toggling voice alert
  const toggleScanning = () => {
    const nextState = !isScanning;
    setIsScanning(nextState);
    
    if (nextState) {
      audioEngine.speak("System loaded. Scanning started.", settings.speechRate, 1000, true);
    } else {
      audioEngine.stopAll();
      audioEngine.speak("System standby.", settings.speechRate, 1000, true);
    }
  };

  // Announces on page load that the system is ready
  useEffect(() => {
    if (!modelLoading && model && !modelError) {
      audioEngine.speak("Vision obstacle detector loaded. Tap start navigation.", 1.1, 3000);
    }
  }, [modelLoading, model, modelError]);

  return (
    <div className={`min-h-screen ${themeStyle.bg} flex flex-col font-sans overflow-x-hidden`} style={{ color: themeStyle.textColor }} id="obstacle-detector-app-wrapper">
      
      {/* Dynamic Upper Navigation Bar */}
      <header className={`py-4 px-6 border-b ${themeStyle.headerBg} flex flex-col sm:flex-row items-center justify-between gap-4`} id="app-main-header">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-500/10 p-2 rounded-xl border border-emerald-500/30" id="header-logo-badge">
            <Eye className="w-6 h-6 text-emerald-400 animate-pulse" />
          </div>
          <div className="text-left">
            <h1 className="text-lg font-black tracking-tight" style={{ color: themeStyle.textColor }}>
              OBSTACLE RADAR
            </h1>
            <p className="text-xs text-neutral-500 font-mono">Accessibility Vision Core v2.4</p>
          </div>
        </div>

        {/* Global Active Power controls */}
        <div className="flex flex-wrap items-center gap-3" id="header-interactive-capsule">
          <button
            id="master-power-btn"
            disabled={modelLoading || !!modelError}
            onClick={toggleScanning}
            className={`px-5 py-2.5 rounded-full font-bold tracking-wide uppercase transition-all duration-150 active:scale-95 flex items-center gap-2 text-sm text-black ${
              isScanning 
                ? 'bg-rose-500 hover:bg-rose-400 shadow-[0_0_15px_rgba(239,68,68,0.4)]' 
                : 'bg-emerald-500 hover:bg-emerald-400 shadow-[0_4px_12px_rgba(16,185,129,0.3)]'
            } disabled:opacity-40 disabled:cursor-not-allowed`}
            aria-label={isScanning ? "Deactivate Scanning Navigation" : "Activate Scanning Navigation"}
          >
            {isScanning ? (
              <>
                <Square className="w-4 h-4 fill-current text-black" />
                STOP SCANNERS
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current text-black" />
                START NAVIGATION
              </>
            )}
          </button>

          {/* Quick Mute Indicator */}
          <button
            id="quick-mute-btn"
            onClick={() => setSettings(prev => ({ ...prev, soundEnabled: !prev.soundEnabled }))}
            className={`p-2.5 rounded-full border ${themeStyle.borderClass} hover:bg-neutral-850 active:scale-95 transition-all`}
            title={settings.soundEnabled ? "Mute warning sound outputs" : "Unmute warning sound outputs"}
            aria-label={settings.soundEnabled ? "Mute audio warning feed" : "Unmute audio warning feed"}
          >
            {settings.soundEnabled ? (
              <Volume2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <VolumeX className="w-4 h-4 text-neutral-500" />
            )}
          </button>
        </div>
      </header>

      {/* Loading & Setup Shield */}
      {modelLoading && (
        <div className="bg-neutral-900 border-b border-neutral-800 px-6 py-3.5 flex items-center justify-between text-xs font-mono text-emerald-400 gap-3" id="loading-calibration-shield">
          <div className="flex items-center gap-3">
            <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
            <span>{modelStatus}</span>
          </div>
          <span className="text-neutral-500">Wait for Local Model Compilation...</span>
        </div>
      )}

      {modelError && (
        <div className="bg-red-950/40 border-b border-red-900/50 px-6 py-4 flex flex-col sm:flex-row items-center justify-between text-xs text-red-300 gap-3" id="model-error-shield">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-4 h-4 text-red-500 flex-shrink-0" />
            <span>{modelError}</span>
          </div>
          <button
            id="reload-page-btn"
            onClick={() => window.location.reload()}
            className="bg-red-900/50 border border-red-700 font-bold px-3 py-1.5 rounded hover:bg-red-800"
          >
            Reload Interface
          </button>
        </div>
      )}

      {/* Voice Assistant Listening status strip */}
      {settings.voiceCommandsEnabled && speechSupported && (
        <div className={`border-b ${voicePermissionError ? 'bg-red-950/40 border-red-900/60' : 'bg-neutral-900/60 border-neutral-800'} px-6 py-2.5 flex flex-col md:flex-row md:items-center justify-between text-xs font-mono gap-3`} id="voice-assistant-listening-strip">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="relative flex h-2.5 w-2.5">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${voicePermissionError ? 'bg-red-400' : isListeningVoice ? 'bg-indigo-400' : 'bg-amber-400'} opacity-75`}></span>
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${voicePermissionError ? 'bg-red-500' : isListeningVoice ? 'bg-indigo-500' : 'bg-amber-500'}`}></span>
            </span>
            <span className="text-neutral-400 font-bold uppercase tracking-wider">Voice Control:</span>
            {voicePermissionError ? (
              <span className="text-red-400 font-bold">
                MICROPHONE NOT ALLOWED. TO USE VOICE COMMANDS, TRY RELOADING AND ALLOWING MIC OR OPEN THIS APP IN A NEW TAB!
              </span>
            ) : (
              <span className={isListeningVoice ? "text-indigo-400" : "text-amber-400"}>
                {isListeningVoice ? "LISTENING FOR HANDS-FREE VOICE COMMANDS..." : "INITIALIZING SPEECH ENGINE..."}
              </span>
            )}
          </div>
          {voicePermissionError ? (
            <p className="text-neutral-400 max-w-lg leading-relaxed">
              ⚠️ In sandboxed environments (like the AI Studio Preview iFrame), browsers prevent voice access. Click <strong className="text-indigo-300 font-bold">"Open in a new tab"</strong> at the top right of this preview panel to enable hands-free voice control!
            </p>
          ) : (
            <p className="text-neutral-500 hidden md:block select-none">
              Say <span className="text-indigo-300 font-bold">"START"</span> or <span className="text-indigo-300 font-bold">"STOP"</span> to toggle navigation scanners.
            </p>
          )}
        </div>
      )}

      {/* Main Grid Panels Layout */}
      <main className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6" id="app-main-content-grid">
        
        {/* LEFT COLUMN: Camera Feed Map and Diagnostic lists (7/12 cols) */}
        <section className="lg:col-span-7 space-y-6 flex flex-col h-full" id="left-vision-viewports">
          
          {/* ObjectRadar Viewer */}
          <div className="flex-1" id="radar-viewport-container">
            <ObjectRadarCanvas
              model={model}
              settings={settings}
              isScanning={isScanning}
              onScanningStateChange={setIsScanning}
              onPredictionsUpdated={handlePredictionsUpdated}
              themeStyle={themeStyle}
            />
          </div>

          {/* Telemetry Logger */}
          <div id="telemetry-logs-wrapper">
            <LogHistory
              logs={logs}
              onClearLogs={handleClearLogs}
              activeTheme={activeTheme}
              themeStyle={themeStyle}
            />
          </div>

        </section>

        {/* RIGHT COLUMN: Calibration Tab Controls Panel (5/12 cols) */}
        <section className="lg:col-span-5 h-full" id="right-control-panels">
          <div className={`p-4 ${themeStyle.cardBg} border ${themeStyle.borderClass} rounded-2xl flex flex-col h-full`} id="control-tabs-container">
            
            {/* Navigational Tabs */}
            <div className="flex border-b border-neutral-800 p-1 mb-5 bg-neutral-950/40 rounded-xl" id="control-tabs-bar" role="tablist">
              <button
                id="control-tab-btn-detector"
                role="tab"
                aria-selected={activeTab === 'detector'}
                onClick={() => setActiveTab('detector')}
                className={`flex-1 py-3 px-3 rounded-lg text-xs font-bold tracking-wider uppercase flex items-center justify-center gap-2 transition-all ${
                  activeTab === 'detector'
                    ? 'bg-neutral-800 text-white shadow-md'
                    : 'text-neutral-500 hover:text-neutral-300'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                Calibration Controls
              </button>
              <button
                id="control-tab-btn-instructions"
                role="tab"
                aria-selected={activeTab === 'instructions'}
                onClick={() => setActiveTab('instructions')}
                className={`flex-1 py-3 px-3 rounded-lg text-xs font-bold tracking-wider uppercase flex items-center justify-center gap-2 transition-all ${
                  activeTab === 'instructions'
                    ? 'bg-neutral-800 text-white shadow-md'
                    : 'text-neutral-500 hover:text-neutral-300'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                Testing Guides
              </button>
            </div>

            {/* TAB CONTENTS CONTAINER */}
            <div className="flex-1 overflow-y-auto max-h-[700px] pr-1 select-none" id="control-tabs-scroller">
              
              {activeTab === 'detector' ? (
                /* Calibration parameters */
                <SettingsPanel
                  settings={settings}
                  onChangeSettings={setSettings}
                  activeTheme={activeTheme}
                  onChangeTheme={setActiveTheme}
                  onCalibrationReset={handleCalibrationReset}
                />
              ) : (
                /* Interactive Calibration Docs and verification instructions */
                <div className="space-y-6 text-left" id="testing-guide-panel">
                  <div className="bg-neutral-950 border border-neutral-855 rounded-xl p-5" id="how-visiondetect-works-summary">
                    <h3 className="text-sm font-bold uppercase text-emerald-400 mb-2 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-emerald-400" />
                      How Obstacle Detector Works
                    </h3>
                    <p className="text-xs text-neutral-400 leading-relaxed mb-3">
                      This application operates purely locally on the browser using <strong>TensorFlow.js</strong> and 
                      a <strong>COCO-SSD convolutional neural network</strong>. No video or biometric telemetry is ever sent to 
                      a cloud server, ensuring 100% data security and sub-millisecond local object categorization.
                    </p>
                    <div className="flex items-start gap-2 bg-neutral-900 p-3 rounded-lg border border-neutral-800" id="spatial-mapping-breakdown">
                      <Info className="w-4.5 h-4.5 text-sky-400 flex-shrink-0 mt-0.5" />
                      <div className="text-[11.5px] text-neutral-400 leading-relaxed">
                        <strong className="text-neutral-300">Spatial Depth Index:</strong> An item's width comparative to 
                        the lens boundaries is translated to distance. If an object encompasses more than the configured 
                        <strong> Size % threshold</strong>, it is flagged as an immediate hazard requiring alert feedback.
                      </div>
                    </div>
                  </div>

                  {/* Calibration & verification protocol tests */}
                  <div className="space-y-4" id="calibration-and-verification-protocols">
                    <h3 className="text-xs font-bold text-neutral-500 tracking-wider uppercase mb-1">
                      Verification Test Protocols
                    </h3>

                    {/* Protocol 1: Low light */}
                    <div className="bg-neutral-950 rounded-xl p-4 border border-neutral-855" id="test-protocol-cards">
                      <div className="flex items-center gap-2.5 mb-2">
                        <div className="bg-yellow-950 p-1 rounded font-bold text-yellow-500 text-[10px] font-mono border border-yellow-900">
                          TEST 01
                        </div>
                        <h4 className="text-xs font-bold text-neutral-300">Dim-Light & Interferences</h4>
                      </div>
                      <p className="text-[11.5px] text-neutral-400 leading-relaxed mb-2">
                        Under dim indoor environments or shadows, neural networks often struggle to classify items, 
                        manifesting as decaying confidence rates.
                      </p>
                      <ul className="text-[11px] text-neutral-500 space-y-1 pl-4 list-disc">
                        <li>Walk into a dim room or cover part of your lighting.</li>
                        <li>Look at a chair or table.</li>
                        <li>If detection triggers sporadically, calibrate <strong>Confidence Threshold</strong> down to <strong>45% - 50%</strong>.</li>
                      </ul>
                    </div>

                    {/* Protocol 2: Postures */}
                    <div className="bg-neutral-950 rounded-xl p-4 border border-neutral-855">
                      <div className="flex items-center gap-2.5 mb-2">
                        <div className="bg-blue-950 p-1 rounded font-bold text-blue-400 text-[10px] font-mono border border-blue-900">
                          TEST 02
                        </div>
                        <h4 className="text-xs font-bold text-neutral-300">Angle of Hold Calibration</h4>
                      </div>
                      <p className="text-[11.5px] text-neutral-400 leading-relaxed mb-2">
                        Visually impaired users operate applications with a downward-tilted phone position during walking.
                      </p>
                      <ul className="text-[11px] text-neutral-500 space-y-1 pl-4 list-disc">
                        <li>Hold your phone or laptop camera at a normal walking slant.</li>
                        <li>Assess when a floor-bound obstacle is exactly 4-5 feet away.</li>
                        <li>Calibrate <strong>Proximity Warning Bubble (Size %)</strong> to lower percentages (e.g., <strong>20%-30%</strong>) if you require warnings about obstacles that are further away.</li>
                      </ul>
                    </div>

                    {/* Protocol 3: Sound alerts */}
                    <div className="bg-neutral-950 rounded-xl p-4 border border-neutral-855">
                      <div className="flex items-center gap-2.5 mb-2">
                        <div className="bg-pink-950 p-1 rounded font-bold text-pink-400 text-[10px] font-mono border border-pink-900">
                          TEST 03
                        </div>
                        <h4 className="text-xs font-bold text-neutral-300">Audio Fatigue Mitigation</h4>
                      </div>
                      <p className="text-[11.5px] text-neutral-400 leading-relaxed mb-2">
                        Constant spoken text can overwhelm a user in crowded corridors (audio clutter / fatigue).
                      </p>
                      <ul className="text-[11px] text-neutral-500 space-y-1 pl-4 list-disc">
                        <li>Stand in a room with multiple items. Set Sound Style to <strong>Dual Feedback</strong>.</li>
                        <li>Notice how the <strong>Proximity Beeper</strong> increases its beep frequency as you approach a dining table, without spoken announcements overlapping.</li>
                        <li>Increase <strong>Speech Alert Repeat Cooldown</strong> to <strong>4.5s or 5.0s</strong> to reduce spoken clutter.</li>
                      </ul>
                    </div>

                    {/* Protocol 4: General Proximity tracking */}
                    <div className="bg-neutral-950 rounded-xl p-4 border border-neutral-855">
                      <div className="flex items-center gap-2.5 mb-2">
                        <div className="bg-emerald-950 p-1 rounded font-bold text-emerald-400 text-[10px] font-mono border border-emerald-900">
                          TEST 04
                        </div>
                        <h4 className="text-xs font-bold text-neutral-300">Real-Time Radar Simulation</h4>
                      </div>
                      <p className="text-[11.5px] text-neutral-400 leading-relaxed mb-2">
                        Simulating actual emergency warning curves.
                      </p>
                      <ul className="text-[11px] text-neutral-500 space-y-1 pl-4 list-disc">
                        <li>Stand 8 feet away from a <strong>chair</strong> or <strong>backpack</strong>.</li>
                        <li>Step forward progressively toward the obstacle.</li>
                        <li>Verify transitions: from silence, to light audio notes, to high-frequency beeping paired with the <em>"Warning: chair directly ahead"</em> speech alert.</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>
        </section>

      </main>

      {/* Footer copyright */}
      <footer className="py-6 px-6 text-center text-xs text-neutral-600 border-t border-neutral-900 flex-shrink-0" id="app-base-footer">
        <p>© 2026 VisionAssist Obstacle Detector. Designed with client-side privacy-first computer vision.</p>
      </footer>
    </div>
  );
}
