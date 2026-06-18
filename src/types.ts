/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ObstaclePrediction {
  class: string;
  score: number;
  bbox: [number, number, number, number]; // [x, y, width, height]
  position: 'left' | 'center' | 'right';
  distanceFactor: number; // calculated ratio of box width to video width (0 to 1)
  distanceFt?: number;   // estimated distance in feet
  distanceM?: number;    // estimated distance in meters
  isHazard: boolean;
  timestamp: number;
}

export interface CalibrationSettings {
  confidenceThreshold: number; // 0.4 to 0.9
  hazardSizeThreshold: number; // 0.2 to 0.7 (percentage of camera width)
  speechRate: number; // 0.8 to 2.0
  cooldownPeriod: number; // ms to wait before repeating same warning (e.g., 1000 - 5000)
  soundEnabled: boolean; // toggle audio feedback general
  soundType: 'speech' | 'beeps' | 'both'; // speech explanations, proximity beeps, or both
  activeCategories: string[]; // only announce selected categories (e.g., 'person', 'chair', 'car')
  wallDetectionEnabled: boolean; // toggle real-time wall and barrier detection Heuristic
  voiceCommandsEnabled: boolean; // toggle browser continuous voice recognition engine
  distanceUnit: 'feet' | 'meters'; // preferred measurement unit for voice audio callouts
}

export type AccessibilityTheme = 'dark' | 'high-contrast-yellow' | 'high-contrast-white' | 'accessible-blue';

export interface DetectionLog {
  id: string;
  timestamp: number;
  label: string;
  position: 'left' | 'center' | 'right';
  isHazard: boolean;
  confidence: number;
}
