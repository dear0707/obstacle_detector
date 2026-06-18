/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  Sliders, 
  Volume2, 
  Eye, 
  Settings2, 
  Accessibility, 
  RefreshCw, 
  Check, 
  Info,
  SlidersHorizontal,
  ChevronRight,
  ShieldAlert
} from 'lucide-react';
import { CalibrationSettings, AccessibilityTheme } from '../types';

interface SettingsPanelProps {
  settings: CalibrationSettings;
  onChangeSettings: (settings: CalibrationSettings) => void;
  activeTheme: AccessibilityTheme;
  onChangeTheme: (theme: AccessibilityTheme) => void;
  onCalibrationReset: () => void;
}

const CATEGORY_GROUPS = [
  {
    name: 'Indoor & Furniture',
    items: ['chair', 'couch', 'bed', 'dining table', 'tv', 'toilet'],
  },
  {
    name: 'Hazard & Obstacles',
    items: ['person', 'dog', 'cat', 'backpack', 'handbag', 'suitcase'],
  },
  {
    name: 'Outdoor & Traffic',
    items: ['car', 'bicycle', 'motorcycle', 'bus', 'truck', 'traffic light', 'stop sign'],
  },
  {
    name: 'Common Small Objects',
    items: ['cup', 'bottle', 'bowl', 'cell phone', 'laptop', 'book'],
  }
];

export default function SettingsPanel({
  settings,
  onChangeSettings,
  activeTheme,
  onChangeTheme,
  onCalibrationReset
}: SettingsPanelProps) {
  
  const handleUpdate = <K extends keyof CalibrationSettings>(key: K, value: CalibrationSettings[K]) => {
    onChangeSettings({
      ...settings,
      [key]: value
    });
  };

  const toggleCategory = (category: string) => {
    const active = [...settings.activeCategories];
    if (active.includes(category)) {
      handleUpdate('activeCategories', active.filter(c => c !== category));
    } else {
      handleUpdate('activeCategories', [...active, category]);
    }
  };

  const toggleAllCategories = () => {
    const all = CATEGORY_GROUPS.flatMap(g => g.items);
    if (settings.activeCategories.length === all.length) {
      handleUpdate('activeCategories', []);
    } else {
      handleUpdate('activeCategories', all);
    }
  };

  const isAllSelected = settings.activeCategories.length === CATEGORY_GROUPS.flatMap(g => g.items).length;

  return (
    <div className="space-y-6" id="settings-dashboard">
      {/* Theme Selection - Large targets for high accessibility */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5" id="theme-selector-container">
        <div className="flex items-center gap-3 mb-4">
          <Accessibility className="w-5 h-5 text-emerald-400" />
          <h3 className="text-sm font-semibold tracking-wide uppercase text-neutral-300">
            Accessibility Themes
          </h3>
        </div>
        <div className="grid grid-cols-2 gap-3" id="theme-buttons-grid">
          <button
            id="theme-btn-dark"
            onClick={() => onChangeTheme('dark')}
            className={`p-3 rounded-lg border-2 text-left transition-all ${
              activeTheme === 'dark'
                ? 'bg-neutral-800 border-emerald-500 text-white'
                : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700'
            }`}
          >
            <div className="font-bold text-sm">Classic Dark</div>
            <div className="text-xs text-neutral-500">Soft slate, neon accents</div>
          </button>
          <button
            id="theme-btn-contrast-yellow"
            onClick={() => onChangeTheme('high-contrast-yellow')}
            className={`p-3 rounded-lg border-2 text-left transition-all ${
              activeTheme === 'high-contrast-yellow'
                ? 'bg-yellow-950 border-yellow-400 text-yellow-300'
                : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700'
            }`}
          >
            <div className="font-bold text-sm text-yellow-400">Contrast Yellow</div>
            <div className="text-xs text-yellow-600">Pure black and laser yellow</div>
          </button>
          <button
            id="theme-btn-contrast-white"
            onClick={() => onChangeTheme('high-contrast-white')}
            className={`p-3 rounded-lg border-2 text-left transition-all ${
              activeTheme === 'high-contrast-white'
                ? 'bg-white border-black text-black'
                : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700'
            }`}
          >
            <div className="font-bold text-sm text-black">Contrast White</div>
            <div className="text-xs text-neutral-600">Pure high-contrast white & black</div>
          </button>
          <button
            id="theme-btn-accessible-blue"
            onClick={() => onChangeTheme('accessible-blue')}
            className={`p-3 rounded-lg border-2 text-left transition-all ${
              activeTheme === 'accessible-blue'
                ? 'bg-blue-950 border-blue-400 text-blue-300'
                : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700'
            }`}
          >
            <div className="font-bold text-sm text-blue-400">Accessible Blue</div>
            <div className="text-xs text-blue-500">Tritanopia-safe dark blue</div>
          </button>
        </div>
      </div>

      {/* Primary Calibration Sliders */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5" id="engine-calibration-container">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <SlidersHorizontal className="w-5 h-5 text-emerald-400" />
            <h3 className="text-sm font-semibold tracking-wide uppercase text-neutral-300">
              Detector Calibration
            </h3>
          </div>
          <button
            id="reset-calibration-btn"
            onClick={onCalibrationReset}
            className="text-xs bg-neutral-800 hover:bg-neutral-700 text-neutral-300 px-3 py-1.5 rounded-lg flex items-center gap-1.5 active:scale-95 transition-all"
            aria-label="Reset calibration bounds to default"
          >
            <RefreshCw className="w-3 h-3" />
            Reset Defaults
          </button>
        </div>

        <div className="space-y-5" id="calibration-sliders">
          {/* Confidence Threshold */}
          <div id="slider-confidence-group">
            <div className="flex justify-between items-center mb-1.5">
              <label htmlFor="confidence-slider" className="text-sm font-medium text-neutral-300 flex items-center gap-1.5">
                Confidence Threshold
                <span className="group relative">
                  <Info className="w-3.5 h-3.5 text-neutral-500 cursor-help" />
                  <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1 w-48 bg-neutral-950 text-[11px] text-neutral-300 rounded p-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-20 shadow-xl border border-neutral-800">
                    Lower values detect more objects but increase false positives. Ideal indoors: 0.5.
                  </span>
                </span>
              </label>
              <span className="text-xs font-mono font-bold text-emerald-400">
                {Math.round(settings.confidenceThreshold * 100)}%
              </span>
            </div>
            <input
              id="confidence-slider"
              type="range"
              min="0.4"
              max="0.9"
              step="0.05"
              value={settings.confidenceThreshold}
              onChange={(e) => handleUpdate('confidenceThreshold', parseFloat(e.target.value))}
              className="w-full h-2 bg-neutral-850 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
            <div className="flex justify-between text-[10px] text-neutral-500 font-mono mt-1">
              <span>0.4 (High Sensitivity)</span>
              <span>0.9 (Very Precise)</span>
            </div>
          </div>

          {/* Hazard Size Threshold - Proximity distance proxy */}
          <div id="slider-hazard-group">
            <div className="flex justify-between items-center mb-1.5">
              <label htmlFor="hazard-slider" className="text-sm font-medium text-neutral-300 flex items-center gap-1.5">
                Proximity Warning Bubble (Size %)
                <span className="group relative">
                  <Info className="w-3.5 h-3.5 text-neutral-500 cursor-help" />
                  <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1 w-48 bg-neutral-950 text-[11px] text-neutral-300 rounded p-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-20 shadow-xl border border-neutral-800">
                    Defines obstacle proximity warning threshold. Lower percentages warn about objects further away.
                  </span>
                </span>
              </label>
              <span className="text-xs font-mono font-bold text-red-400">
                {Math.round(settings.hazardSizeThreshold * 100)}% width
              </span>
            </div>
            <input
              id="hazard-slider"
              type="range"
              min="0.15"
              max="0.6"
              step="0.05"
              value={settings.hazardSizeThreshold}
              onChange={(e) => handleUpdate('hazardSizeThreshold', parseFloat(e.target.value))}
              className="w-full h-2 bg-neutral-850 rounded-lg appearance-none cursor-pointer accent-red-500"
            />
            <div className="flex justify-between text-[10px] text-neutral-500 font-mono mt-1">
              <span>15% (Far Distances)</span>
              <span>60% (Immediate Close contact)</span>
            </div>
          </div>

          {/* Speech Rate multiplier */}
          <div id="slider-speech-rate-group">
            <div className="flex justify-between items-center mb-1.5">
              <label htmlFor="speech-rate-slider" className="text-sm font-medium text-neutral-300 flex items-center gap-1.5">
                Speech Rate Speed
              </label>
              <span className="text-xs font-mono font-bold text-sky-400">
                {settings.speechRate}x
              </span>
            </div>
            <input
              id="speech-rate-slider"
              type="range"
              min="0.8"
              max="2.0"
              step="0.1"
              value={settings.speechRate}
              onChange={(e) => handleUpdate('speechRate', parseFloat(e.target.value))}
              className="w-full h-2 bg-neutral-850 rounded-lg appearance-none cursor-pointer accent-sky-500"
            />
            <div className="flex justify-between text-[10px] text-neutral-500 font-mono mt-1">
              <span>0.8x (Relaxed)</span>
              <span>2.0x (Hyper Fast)</span>
            </div>
          </div>

          {/* Cooldown Period between announcements */}
          <div id="slider-cooldown-group">
            <div className="flex justify-between items-center mb-1.5">
              <label htmlFor="cooldown-slider" className="text-sm font-medium text-neutral-300 flex items-center gap-1.5">
                Speech Alert Repeat Cooldown
              </label>
              <span className="text-xs font-mono font-bold text-amber-400">
                {(settings.cooldownPeriod / 1000).toFixed(1)}s
              </span>
            </div>
            <input
              id="cooldown-slider"
              type="range"
              min="1000"
              max="6000"
              step="500"
              value={settings.cooldownPeriod}
              onChange={(e) => handleUpdate('cooldownPeriod', parseInt(e.target.value))}
              className="w-full h-2 bg-neutral-850 rounded-lg appearance-none cursor-pointer accent-amber-500"
            />
            <div className="flex justify-between text-[10px] text-neutral-500 font-mono mt-1">
              <span>1.0s (Very frequent)</span>
              <span>6.0s (Less verbose)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Warning Sounds Modes */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5" id="audio-modes-container">
        <div className="flex items-center gap-3 mb-4">
          <Volume2 className="w-5 h-5 text-emerald-400" />
          <h3 className="text-sm font-semibold tracking-wide uppercase text-neutral-300">
            Audio Alert Configuration
          </h3>
        </div>

        <div className="space-y-4" id="audio-checkboxes">
          <div className="flex items-center justify-between p-3 rounded-lg bg-neutral-950 border border-neutral-800">
            <div className="flex flex-col">
              <span className="text-sm font-bold text-neutral-200">Enable Sound Output</span>
              <span className="text-xs text-neutral-500">Toggle all visual audio warnings</span>
            </div>
            <button
              id="toggle-all-sounds-btn"
              onClick={() => handleUpdate('soundEnabled', !settings.soundEnabled)}
              className={`w-12 h-6 rounded-full p-1 transition-all ${
                settings.soundEnabled ? 'bg-emerald-500' : 'bg-neutral-700'
              }`}
              aria-label="Toggle Master Audio Warning"
              aria-pressed={settings.soundEnabled}
            >
              <div className={`bg-neutral-950 w-4 h-4 rounded-full transition-transform ${
                settings.soundEnabled ? 'translate-x-6' : 'translate-x-0'
              }`} />
            </button>
          </div>

          <div className="space-y-2">
            <span className="text-xs font-semibold text-neutral-400 tracking-wider uppercase block mb-1">
              Audio Feedback Style
            </span>
            <div className="grid grid-cols-3 gap-2" id="feedback-style-grid">
              {(['speech', 'beeps', 'both'] as const).map((style) => (
                <button
                  key={style}
                  id={`audio-style-btn-${style}`}
                  onClick={() => handleUpdate('soundType', style)}
                  disabled={!settings.soundEnabled}
                  className={`py-2 px-1 text-center rounded-lg border text-xs capitalize transition-all duration-150 ${
                    !settings.soundEnabled 
                      ? 'opacity-40 cursor-not-allowed bg-neutral-950 border-neutral-900 text-neutral-600'
                      : settings.soundType === style
                        ? 'bg-emerald-950 border-emerald-500 text-emerald-300 font-semibold'
                        : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                  }`}
                >
                  {style === 'both' ? 'Dual Feedback' : style}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Sensors & Voice Assist Customizations */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5" id="extra-features-container">
        <div className="flex items-center gap-3 mb-4">
          <Settings2 className="w-5 h-5 text-indigo-400" />
          <h3 className="text-sm font-semibold tracking-wide uppercase text-neutral-300">
            Intelligent Assist & Sensors
          </h3>
        </div>

        <div className="space-y-4" id="extra-features-checkboxes">
          {/* Wall/Barrier Sensor Toggler */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-neutral-950 border border-neutral-800">
            <div className="flex flex-col pr-2">
              <span className="text-sm font-bold text-neutral-200">Real-time Wall Detection</span>
              <span className="text-xs text-neutral-500">Heuristic laser scans floors to warn about upcoming walls and vertical barriers.</span>
            </div>
            <button
              id="toggle-wall-detection-btn"
              onClick={() => handleUpdate('wallDetectionEnabled', !settings.wallDetectionEnabled)}
              className={`w-12 h-6 rounded-full p-1 transition-all flex-shrink-0 ${
                settings.wallDetectionEnabled ? 'bg-indigo-500' : 'bg-neutral-700'
              }`}
              aria-label="Toggle Real-time Wall Detection"
              aria-pressed={settings.wallDetectionEnabled}
            >
              <div className={`bg-neutral-950 w-4 h-4 rounded-full transition-transform ${
                settings.wallDetectionEnabled ? 'translate-x-6' : 'translate-x-0'
              }`} />
            </button>
          </div>

          {/* Voice Command Engine Toggler */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-neutral-950 border border-neutral-800">
            <div className="flex flex-col pr-2">
              <span className="text-sm font-bold text-neutral-200">Hands-Free voice controls</span>
              <span className="text-xs text-neutral-500">Listen continuously for microphone keywords like "START", "STOP" and "STANDBY".</span>
            </div>
            <button
              id="toggle-voice-commands-btn"
              onClick={() => handleUpdate('voiceCommandsEnabled', !settings.voiceCommandsEnabled)}
              className={`w-12 h-6 rounded-full p-1 transition-all flex-shrink-0 ${
                settings.voiceCommandsEnabled ? 'bg-indigo-500' : 'bg-neutral-700'
              }`}
              aria-label="Toggle Voice Control"
              aria-pressed={settings.voiceCommandsEnabled}
            >
              <div className={`bg-neutral-950 w-4 h-4 rounded-full transition-transform ${
                settings.voiceCommandsEnabled ? 'translate-x-6' : 'translate-x-0'
              }`} />
            </button>
          </div>

          {/* Preferred Distance Measurement Unit */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-neutral-400 tracking-wider uppercase block mb-1">
              Preferred Distance Unit
            </span>
            <div className="grid grid-cols-2 gap-2" id="distance-unit-grid">
              {(['feet', 'meters'] as const).map((unit) => (
                <button
                  key={unit}
                  id={`dist-unit-btn-${unit}`}
                  onClick={() => handleUpdate('distanceUnit', unit)}
                  className={`py-2 px-1 text-center rounded-lg border text-xs capitalize transition-all duration-150 ${
                    settings.distanceUnit === unit
                      ? 'bg-indigo-950 border-indigo-500 text-indigo-300 font-semibold'
                      : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                  }`}
                >
                  {unit}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Categories Toggle Grid */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5" id="categories-filter-container">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Eye className="w-5 h-5 text-emerald-400" />
            <h3 className="text-sm font-semibold tracking-wide uppercase text-neutral-300">
              Obstacle Filter Categories
            </h3>
          </div>
          <button
            id="toggle-all-categories-btn"
            onClick={toggleAllCategories}
            className="text-xs text-sky-400 hover:text-sky-300 font-semibold underline bg-transparent border-none cursor-pointer py-1"
          >
            {isAllSelected ? 'Silence All' : 'Select All'}
          </button>
        </div>

        <p className="text-xs text-neutral-400 mb-4">
          Enable or disable speech notifications for specific types of furniture and obstacles to prevent auditory fatigue.
        </p>

        <div className="space-y-4" id="categories-groups-list">
          {CATEGORY_GROUPS.map((group) => (
            <div key={group.name} className="border-t border-neutral-855 pt-3 first:border-0 first:pt-0">
              <span className="text-xs font-bold text-neutral-400 block mb-2">{group.name}</span>
              <div className="flex flex-wrap gap-2">
                {group.items.map((cat) => {
                  const isSelected = settings.activeCategories.includes(cat);
                  return (
                    <button
                      key={cat}
                      id={`cat-tag-${cat.replace(' ', '-')}`}
                      onClick={() => toggleCategory(cat)}
                      className={`px-3 py-1.5 rounded-full text-xs flex items-center gap-1.5 transition-all ${
                        isSelected
                          ? 'bg-emerald-900/40 border border-emerald-500 text-emerald-300 font-medium'
                          : 'bg-neutral-950 border border-neutral-800 text-neutral-500 hover:border-neutral-700'
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                      <span className="capitalize">{cat}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
