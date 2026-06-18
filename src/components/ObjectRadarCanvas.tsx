/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Camera, CameraOff, RefreshCw, AlertTriangle, Play, Square, SwitchCamera } from 'lucide-react';
import { CalibrationSettings, ObstaclePrediction } from '../types';

const ESTIMATED_WIDTHS_METERS: Record<string, number> = {
  person: 0.50,
  chair: 0.55,
  couch: 1.80,
  dog: 0.40,
  cat: 0.25,
  backpack: 0.30,
  handbag: 0.25,
  suitcase: 0.45,
  cup: 0.08,
  bottle: 0.08,
  car: 1.80,
  'dining table': 1.20,
  bicycle: 0.65,
  motorcycle: 0.75,
  bus: 2.50,
  truck: 2.30,
  'traffic light': 0.40,
  'stop sign': 0.75,
};

interface ObjectRadarCanvasProps {
  model: any;
  settings: CalibrationSettings;
  isScanning: boolean;
  onScanningStateChange: (state: boolean) => void;
  onPredictionsUpdated: (predictions: ObstaclePrediction[]) => void;
  themeStyle: any; // visual styles map depending on accessible contrast mode
}

export default function ObjectRadarCanvas({
  model,
  settings,
  isScanning,
  onScanningStateChange,
  onPredictionsUpdated,
  themeStyle
}: ObjectRadarCanvasProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const requestRef = useRef<number | null>(null);
  const predictionsRef = useRef<ObstaclePrediction[]>([]);
  const wallCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [showZones, setShowZones] = useState<boolean>(true);
  const [showDiagnostics, setShowDiagnostics] = useState<boolean>(true);
  const [fps, setFps] = useState<number>(0);

  // Stats / FPS counter
  const lastFrameTimeRef = useRef<number>(performance.now());
  const framesCountRef = useRef<number>(0);

  // Declare refs for our mutable props/state to keep detection loop completely stale-free & fast
  const settingsRef = useRef(settings);
  const showZonesRef = useRef(showZones);
  const showDiagnosticsRef = useRef(showDiagnostics);
  const themeStyleRef = useRef(themeStyle);
  const onPredictionsUpdatedRef = useRef(onPredictionsUpdated);
  const isScanningRef = useRef(isScanning);
  const modelRef = useRef(model);

  // Sync refs on render
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    showZonesRef.current = showZones;
  }, [showZones]);

  useEffect(() => {
    showDiagnosticsRef.current = showDiagnostics;
  }, [showDiagnostics]);

  useEffect(() => {
    themeStyleRef.current = themeStyle;
  }, [themeStyle]);

  useEffect(() => {
    onPredictionsUpdatedRef.current = onPredictionsUpdated;
  }, [onPredictionsUpdated]);

  useEffect(() => {
    isScanningRef.current = isScanning;
  }, [isScanning]);

  useEffect(() => {
    modelRef.current = model;
  }, [model]);

  // Stop camera feed
  const stopCamera = useCallback(() => {
    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
      requestRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    predictionsRef.current = [];
    onPredictionsUpdatedRef.current([]);
    
    // Clear canvas
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, []);

  const setupCanvasDimensions = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video && canvas) {
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
    }
  };

  // Flip Camera
  const toggleFacingMode = () => {
    setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
  };

  // Main Prediction loop (completely stable - zero recreation jitter)
  const detectFrame = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const currentModel = modelRef.current;
    const activeScan = isScanningRef.current;

    if (!video || !canvas || !currentModel || !activeScan) return;

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      try {
        // Run model detection
        const rawPredictions = await currentModel.detect(video);
        
        // Calculate FPS
        const now = performance.now();
        framesCountRef.current++;
        if (now > lastFrameTimeRef.current + 1000) {
          setFps(Math.round((framesCountRef.current * 1000) / (now - lastFrameTimeRef.current)));
          framesCountRef.current = 0;
          lastFrameTimeRef.current = now;
        }

        const currentSettings = settingsRef.current;
        const currentThemeStyle = themeStyleRef.current;
        const currentShowZones = showZonesRef.current;

        // Process bounding boxes and translate to user feedback
        const processed: ObstaclePrediction[] = rawPredictions
          .filter((p: any) => p.score >= currentSettings.confidenceThreshold)
          .map((p: any) => {
            const [x, y, width, height] = p.bbox;
            const videoWidth = video.videoWidth || 640;
            const centerX = x + width / 2;

            // Spatial zone calculation
            let position: 'left' | 'center' | 'right' = 'center';
            if (centerX < videoWidth / 3) {
              position = 'left';
            } else if (centerX > (videoWidth / 3) * 2) {
              position = 'right';
            }

            // Area factor / distance proxy
            const distanceFactor = width / videoWidth; // width relative to screen is an intuitive distance proxy

            // Determine if it is a major hazard
            const isCategoryActive = currentSettings.activeCategories.includes(p.class);
            const isHazard = isCategoryActive && (
              distanceFactor >= currentSettings.hazardSizeThreshold || 
              (position === 'center' && distanceFactor >= currentSettings.hazardSizeThreshold * 0.8)
            );

            // Estimate physical distances (Feet and Meters)
            const realWidth = ESTIMATED_WIDTHS_METERS[p.class] || 0.50;
            const fFraction = 0.65;
            let distM = (realWidth * fFraction) / Math.max(0.01, distanceFactor);
            distM = Math.max(0.3, Math.min(6.0, distM));
            const distFt = distM * 3.28084;

            return {
              class: p.class,
              score: p.score,
              bbox: p.bbox,
              position,
              distanceFactor,
              distanceFt: parseFloat(distFt.toFixed(1)),
              distanceM: parseFloat(distM.toFixed(1)),
              isHazard,
              timestamp: Date.now()
            };
          });

        // Auxiliary real-time wall and barrier detection heuristic
        let wallPrediction: ObstaclePrediction | null = null;
        if (currentSettings.wallDetectionEnabled) {
          if (!wallCanvasRef.current) {
            wallCanvasRef.current = document.createElement('canvas');
            wallCanvasRef.current.width = 32;
            wallCanvasRef.current.height = 24;
          }
          const wallCanvas = wallCanvasRef.current;
          const wallCtx = wallCanvas.getContext('2d');
          if (wallCtx) {
            try {
              // Scale video frame into tiny offscreen context
              wallCtx.drawImage(video, 0, 0, 32, 24);
              const imgData = wallCtx.getImageData(0, 0, 32, 24);
              const data = imgData.data;

              let transitionRow = -1;
              
              // Search vertical columns from bottom to find color contrast change (floor-to-wall intersection boundary)
              for (let r = 21; r >= 6; r--) {
                let rowDiffSum = 0;
                let samples = 0;
                
                for (let c = 12; c <= 20; c++) {
                  const idxCurrent = (r * 32 + c) * 4;
                  const idxBelow = ((r + 1) * 32 + c) * 4;
                  
                  const rDiff = data[idxCurrent] - data[idxBelow];
                  const gDiff = data[idxCurrent + 1] - data[idxBelow + 1];
                  const bDiff = data[idxCurrent + 2] - data[idxBelow + 2];
                  
                  const diff = Math.sqrt(rDiff*rDiff + gDiff*gDiff + bDiff*bDiff);
                  rowDiffSum += diff;
                  samples++;
                }
                
                const avgRowDiff = rowDiffSum / samples;
                if (avgRowDiff > 25) { // Represents a sharp horizontal line boundary
                  transitionRow = r;
                  break;
                }
              }

              if (transitionRow !== -1) {
                // Pin linear projection range: row 22 = close (~1.5 ft), row 6 = far distance (~8.0 ft)
                const rangeFraction = (transitionRow - 6) / (22 - 6);
                const distFt = 1.5 + (1 - Math.max(0, Math.min(1, rangeFraction))) * 6.5;
                const distM = distFt / 3.28084;
                
                const canvasY = (transitionRow / 24) * canvas.height;
                const distanceFactor = 1 - (transitionRow / 24);
                
                // Hazard trigger if wall is within active buffer threshold (e.g., 4 feet)
                const isHazard = distFt < 4.0;
                
                wallPrediction = {
                  class: 'wall',
                  score: 0.82,
                  bbox: [canvas.width * 0.1, canvasY, canvas.width * 0.8, Math.max(25, canvas.height - canvasY)],
                  position: 'center',
                  distanceFactor,
                  distanceFt: parseFloat(distFt.toFixed(1)),
                  distanceM: parseFloat(distM.toFixed(1)),
                  isHazard,
                  timestamp: Date.now()
                };
              }
            } catch (err) {
              console.error('Wall heuristic running error:', err);
            }
          }
        }

        if (wallPrediction) {
          processed.push(wallPrediction);
        }

        predictionsRef.current = processed;
        onPredictionsUpdatedRef.current(processed);

        // Draw Canvas Overlay
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          const w = canvas.width;
          const h = canvas.height;

          // DRAW SECTOR BOUNDARIES
          if (currentShowZones) {
            ctx.save();
            ctx.strokeStyle = currentThemeStyle.isHighContrast ? currentThemeStyle.gridLineColor : 'rgba(255, 255, 255, 0.15)';
            ctx.lineWidth = 2;
            ctx.setLineDash([6, 6]);

            // Sector dividers
            ctx.beginPath();
            ctx.moveTo(w / 3, 0);
            ctx.lineTo(w / 3, h);
            ctx.moveTo((w / 3) * 2, 0);
            ctx.lineTo((w / 3) * 2, h);
            ctx.stroke();

            // Draw Zone Labels
            ctx.restore();
            ctx.save();
            ctx.fillStyle = currentThemeStyle.isHighContrast ? currentThemeStyle.badgeBg : 'rgba(0, 0, 0, 0.5)';
            ctx.font = 'bold 11px system-ui, sans-serif';
            ctx.textAlign = 'center';

            // Left
            ctx.fillRect(10, 10, 60, 22);
            ctx.fillStyle = currentThemeStyle.textColor;
            ctx.fillText('LEFT', 40, 25);

            // Center
            ctx.fillStyle = currentThemeStyle.isHighContrast ? currentThemeStyle.badgeBg : 'rgba(0, 0, 0, 0.5)';
            ctx.fillRect(w / 2 - 40, 10, 80, 22);
            ctx.fillStyle = currentThemeStyle.warningSecColor || currentThemeStyle.textColor;
            ctx.fillText('CENTER', w / 2, 25);

            // Right
            ctx.fillStyle = currentThemeStyle.isHighContrast ? currentThemeStyle.badgeBg : 'rgba(0, 0, 0, 0.5)';
            ctx.fillRect(w - 70, 10, 60, 22);
            ctx.fillStyle = currentThemeStyle.textColor;
            ctx.fillText('RIGHT', w - 40, 25);

            ctx.restore();
          }

          // DRAW DETECTED OBJECTS
          processed.forEach((pred) => {
            const [x, y, width, height] = pred.bbox;
            const isHazard = pred.isHazard;

            ctx.save();
            
            // Set styles depending on hazard state and theme
            if (isHazard) {
              ctx.strokeStyle = currentThemeStyle.dangerColor || '#ef4444';
              ctx.lineWidth = 4;
              ctx.shadowColor = currentThemeStyle.dangerColor || '#ef4444';
              ctx.shadowBlur = 8;
            } else {
              ctx.strokeStyle = currentThemeStyle.accentColor;
              ctx.lineWidth = 2.5;
            }

            // Draw bounding rect
            ctx.strokeRect(x, y, width, height);

            // Draw corner focus clips for high visibility
            const offset = 6;
            ctx.beginPath();
            // Up-Left
            ctx.moveTo(x - offset, y + 15);
            ctx.lineTo(x - offset, y - offset);
            ctx.lineTo(x + 15, y - offset);
            // Up-Right
            ctx.moveTo(x + width + offset - 15, y - offset);
            ctx.lineTo(x + width + offset, y - offset);
            ctx.lineTo(x + width + offset, y + 15);
            // Down-Left
            ctx.moveTo(x - offset, y + height - 15);
            ctx.lineTo(x - offset, y + height + offset);
            ctx.lineTo(x + 15, y + height + offset);
            // Down-Right
            ctx.moveTo(x + width + offset - 15, y + height + offset);
            ctx.lineTo(x + width + offset, y + height + offset);
            ctx.lineTo(x + width + offset, y + height - 15);
            ctx.stroke();

            // Label background Banner
            ctx.restore();
            ctx.save();
            ctx.fillStyle = isHazard 
              ? (currentThemeStyle.isHighContrast ? currentThemeStyle.dangerBg : '#ef4444')
              : (currentThemeStyle.isHighContrast ? currentThemeStyle.badgeBg : 'rgba(16, 185, 129, 0.85)');
            
            const textWidth = ctx.measureText(`${pred.class.toUpperCase()} ${Math.round(pred.score * 100)}%`).width;
            ctx.fillRect(x, Math.max(0, y - 24), Math.max(width, textWidth + 16), 24);

            // Label Text
            ctx.fillStyle = isHazard && currentThemeStyle.isHighContrast ? currentThemeStyle.dangerText : '#ffffff';
            ctx.font = 'bold 12px monospace';
            ctx.fillText(
              `${pred.class.toUpperCase()} (${Math.round(pred.score * 100)}%)`, 
              x + 8, 
              Math.max(16, y - 8)
            );

            // Hazard warning circle details
            if (isHazard) {
              ctx.beginPath();
              ctx.arc(x + width / 2, y + height / 2, 6, 0, 2 * Math.PI);
              ctx.fillStyle = currentThemeStyle.dangerColor || '#ef4444';
              ctx.fill();
            }

            ctx.restore();

            // If diagnostics is active, draw extra calibration dataset and coordinates overlay helper
            if (showDiagnosticsRef.current) {
              ctx.save();
              
              // 1. Draw distance factor crosshairs and text HUD
              ctx.font = '10px monospace';
              ctx.fillStyle = isHazard ? '#f87171' : '#60a5fa';
              
              const ratio = width / w;
              const requiredRatio = pred.position === 'center' 
                ? currentSettings.hazardSizeThreshold * 0.8 
                : currentSettings.hazardSizeThreshold;

              let lineIdx = 0;
              const drawHUDText = (label: string, val: string) => {
                ctx.fillText(`${label}: ${val}`, x + 5, y + height + 15 + (lineIdx * 12));
                lineIdx++;
              };

              // Draw translucent backdrop for diagnostic labels
              ctx.fillStyle = 'rgba(10, 10, 10, 0.88)';
              ctx.fillRect(x, y + height + 4, Math.max(width, 195), 75);
              ctx.fillStyle = isHazard ? '#f87171' : '#34d399';
              
              drawHUDText('POSITION', pred.position.toUpperCase() + ` (X:${Math.round(x + width/2)})`);
              drawHUDText('SCREEN WIDTH %', `${(ratio * 100).toFixed(1)}%`);
              drawHUDText('REQUIRED THRES', `${(requiredRatio * 100).toFixed(1)}%`);
              drawHUDText('EST DISTANCE  ', `${pred.distanceFt} ft / ${pred.distanceM} m`);
              drawHUDText('HAZARD STATUS ', isHazard ? 'TRIGGERED [SHOUT]' : 'SAFE OBSERVE');

              // 2. Draw Target Size Indicator Box inside/around the object's centerpoint to assist in calibration.
              ctx.strokeStyle = 'rgba(245, 158, 11, 0.55)';
              ctx.lineWidth = 1;
              ctx.setLineDash([4, 4]);
              
              const targetWidth = w * requiredRatio;
              const aspect = height / width;
              const targetHeight = targetWidth * (isNaN(aspect) ? 1 : aspect);
              const targetX = (x + width / 2) - targetWidth / 2;
              const targetY = (y + height / 2) - targetHeight / 2;
              
              ctx.strokeRect(targetX, targetY, targetWidth, targetHeight);
              
              // Label the calibration boundary
              ctx.fillStyle = 'rgba(245, 158, 11, 0.9)';
              ctx.font = 'bold 8px monospace';
              ctx.fillText('HAZARD TRIGGER THRESHOLD SIZE', targetX + 4, targetY - 4);

              // 3. Draw anchor horizontal and vertical lines to project coordinates (ruler lines)
              ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
              ctx.lineWidth = 1;
              ctx.setLineDash([2, 5]);
              ctx.beginPath();
              // Top coordinate
              ctx.moveTo(x + width / 2, 0);
              ctx.lineTo(x + width / 2, y);
              // Bottom coordinate
              ctx.moveTo(x + width / 2, y + height);
              ctx.lineTo(x + width / 2, h);
              // Left coordinate
              ctx.moveTo(0, y + height / 2);
              ctx.lineTo(x, y + height / 2);
              // Right coordinate
              ctx.moveTo(x + width, y + height / 2);
              ctx.lineTo(w, y + height / 2);
              ctx.stroke();

              ctx.restore();
            }
          });

          // Draw custom wall detection visualization
          const wallObstacle = processed.find(p => p.class === 'wall');
          if (wallObstacle && wallObstacle.distanceFt !== undefined) {
            const canvasY = wallObstacle.bbox[1];
            const isWallHazard = wallObstacle.isHazard;

            ctx.save();
            ctx.beginPath();
            ctx.setLineDash([8, 6]);
            ctx.lineWidth = isWallHazard ? 4 : 2;
            ctx.strokeStyle = isWallHazard 
              ? (currentThemeStyle.dangerColor || '#ef4444') 
              : (currentThemeStyle.warningSecColor || '#f59e0b');

            ctx.moveTo(0, canvasY);
            ctx.lineTo(w, canvasY);
            ctx.stroke();

            // Soft wall hazard fill gradient for sensory feedback
            const grad = ctx.createLinearGradient(0, canvasY, 0, h);
            grad.addColorStop(0, isWallHazard ? 'rgba(239, 68, 68, 0.12)' : 'rgba(245, 158, 11, 0.05)');
            grad.addColorStop(1, isWallHazard ? 'rgba(239, 68, 68, 0.32)' : 'rgba(245, 158, 11, 0.12)');
            ctx.fillStyle = grad;
            ctx.fillRect(0, canvasY, w, h - canvasY);

            // Draw clean HUD indicator panel
            ctx.restore();
            ctx.save();
            ctx.fillStyle = isWallHazard 
              ? (currentThemeStyle.isHighContrast ? currentThemeStyle.dangerBg : '#ef4444')
              : (currentThemeStyle.isHighContrast ? currentThemeStyle.badgeBg : '#f59e0b');

            const distLabel = currentSettings.distanceUnit === 'feet' 
              ? `${wallObstacle.distanceFt} ft` 
              : `${wallObstacle.distanceM} m`;
            const header = isWallHazard ? `CRITICAL WALL: ${distLabel}` : `WALL / BARRIER: ${distLabel}`;

            ctx.font = 'bold 11px monospace';
            const labelWidth = ctx.measureText(header).width;

            ctx.fillRect(w / 2 - labelWidth / 2 - 10, Math.max(10, canvasY - 12), labelWidth + 20, 24);

            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.fillText(header, w / 2, Math.max(10, canvasY - 12) + 15);
            ctx.restore();

            // Draw wall detection vertical scan mapping lines when diagnostics is active
            if (showDiagnosticsRef.current) {
              ctx.save();
              ctx.strokeStyle = isWallHazard ? 'rgba(239, 68, 68, 0.25)' : 'rgba(16, 185, 129, 0.25)';
              ctx.lineWidth = 1;
              ctx.setLineDash([2, 5]);
              
              // 9 virtual laser scanline channels between 37.5% and 62.5% of width
              for (let i = 0; i <= 8; i++) {
                const cx = w * (0.375 + (i * 0.25) / 8);
                ctx.beginPath();
                ctx.moveTo(cx, h);
                ctx.lineTo(cx, canvasY);
                ctx.stroke();

                // Lidar reflection point ticks
                ctx.beginPath();
                ctx.arc(cx, canvasY, 3, 0, 2 * Math.PI);
                ctx.fillStyle = isWallHazard ? '#f87171' : '#34d399';
                ctx.fill();
              }

              // Floor scanner metadata logging panel
              ctx.fillStyle = 'rgba(10, 10, 10, 0.88)';
              ctx.fillRect(10, h - 85, 250, 75);
              ctx.strokeStyle = isWallHazard ? '#ef4444' : '#10b981';
              ctx.lineWidth = 1.5;
              ctx.strokeRect(10, h - 85, 250, 75);

              ctx.font = 'bold 10px monospace';
              ctx.fillStyle = isWallHazard ? '#f87171' : '#34d399';
              ctx.fillText('WALL SCANNER DIAGNOSTICS (FLOOR-TO-WALL)', 15, h - 70);
              
              ctx.font = '9px monospace';
              ctx.fillStyle = '#e5e5e5';
              ctx.fillText(`Intersection Scanline Y : ${Math.round(canvasY)}px`, 15, h - 54);
              ctx.fillText(`Contrast Thresh Filter  : 25 gradient units`, 15, h - 44);
              ctx.fillText(`Critical Collision Dist : < 4.0 feet`, 15, h - 34);
              ctx.fillText(`Real-time Est Distance  : ${wallObstacle.distanceFt} ft (${wallObstacle.distanceM} m)`, 15, h - 24);
              
              ctx.restore();
            }
          }

          // Main Live Diagnostics Board HUD
          if (showDiagnosticsRef.current) {
            ctx.save();
            ctx.fillStyle = 'rgba(10, 10, 10, 0.9)';
            ctx.strokeStyle = '#f59e0b';
            ctx.lineWidth = 1.5;
            ctx.fillRect(10, 50, 210, 210);
            ctx.strokeRect(10, 50, 210, 210);

            ctx.fillStyle = '#f59e0b';
            ctx.font = 'bold 11px monospace';
            ctx.fillText('CALIBRATION MONITOR HUD', 20, 68);

            ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.fillRect(15, 75, 200, 1);

            ctx.font = '9px monospace';
            ctx.fillStyle = '#a3a3a3';
            ctx.fillText(`CONFIDENCE RATIO : ${currentSettings.confidenceThreshold}`, 20, 92);
            ctx.fillText(`SIZE HAZARD THRES: ${currentSettings.hazardSizeThreshold}`, 20, 107);
            ctx.fillText(`COOLDOWN RATE    : ${currentSettings.cooldownPeriod}ms`, 20, 122);
            ctx.fillText(`WALL SENSOR SW   : ${currentSettings.wallDetectionEnabled ? 'ENABLED' : 'DISABLED'}`, 20, 137);
            ctx.fillText(`SCANNED CHANNELS : 9 (FLOOR MATRIX)`, 20, 152);
            ctx.fillText(`STABLE VIDEO RES : 640x480`, 20, 167);
            ctx.fillText(`STREAM REFRESH   : ${fps} FPS`, 20, 182);

            // Active boundary hazard status light
            const activeHazardsCount = processed.filter(p => p.isHazard).length;
            ctx.fillStyle = activeHazardsCount > 0 ? '#ef4444' : '#10b981';
            ctx.fillRect(20, 195, 190, 22);

            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 9px monospace';
            ctx.fillText(`HAZARDS DETECTED : ${activeHazardsCount}`, 26, 209);
            
            ctx.fillStyle = '#a3a3a3';
            ctx.font = '8px monospace';
            ctx.fillText('Calibrate by realigning distance presets', 20, 234);
            ctx.fillText('Dashed boxes indicate triggers', 20, 246);

            ctx.restore();
          }
        }
      } catch (err) {
        console.error("Frame processing failed:", err);
      }
    }

    // Keep loop spinning if scanning is enabled
    if (isScanningRef.current) {
      requestRef.current = requestAnimationFrame(detectFrame);
    }
  }, []);

  // Play Feed and kickoff detects
  const startCamera = useCallback(async () => {
    stopCamera();
    setCameraError(null);

    const constraints: MediaStreamConstraints = {
      video: {
        facingMode: facingMode,
        width: { ideal: 640 },
        height: { ideal: 480 },
      },
      audio: false
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().then(() => {
            if (isScanningRef.current) {
              detectFrame();
            }
          }).catch(err => {
            console.error("Video play failed:", err);
          });
          setupCanvasDimensions();
        };
      }
    } catch (err: any) {
      console.error("Camera access error:", err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError("Camera permission was denied. Please allow camera access in your browser settings.");
      } else {
        setCameraError(`Could not access camera (${err.message}). Try toggling the front/back camera switch.`);
      }
      onScanningStateChange(false);
    }
  }, [facingMode, stopCamera, onScanningStateChange, detectFrame]);

  // Master reactive Scan and Facing toggling controller
  useEffect(() => {
    if (isScanning && model) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isScanning, model, facingMode, startCamera, stopCamera]);

  // Handle window resized
  useEffect(() => {
    const handleResize = () => {
      setupCanvasDimensions();
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="flex flex-col h-full bg-neutral-950 border border-neutral-850 rounded-2xl overflow-hidden relative shadow-2xl" id="radar-camera-stage">
      {/* Upper Action Bar */}
      <div className="bg-neutral-900 border-b border-neutral-800 px-4 py-3 flex items-center justify-between" id="radar-top-bar">
        <div className="flex items-center gap-2">
          {isScanning ? (
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
            </span>
          ) : (
            <span className="h-3 w-3 rounded-full bg-neutral-600 block"></span>
          )}
          <h2 className="text-sm font-semibold tracking-wide text-neutral-300">
            Real-Time Eye Feed
          </h2>
        </div>

        <div className="flex items-center gap-2" id="radar-control-capsules">
          {/* FPS Counter */}
          {isScanning && (
            <span className="text-[10px] bg-neutral-800 text-neutral-400 px-2 py-1 rounded font-mono">
              FPS: {fps}
            </span>
          )}

          {/* Zones Toggle */}
          <button
            id="toggle-guide-grid-btn"
            onClick={() => setShowZones(!showZones)}
            className={`text-xs px-2.5 py-1 rounded border transition-all ${
              showZones 
                ? 'bg-emerald-950/20 border-emerald-500/50 text-emerald-400' 
                : 'bg-transparent border-neutral-855 text-neutral-400 hover:text-neutral-250'
            }`}
            title="Toggle Sector Visual Dividers"
          >
            Guide Grid: {showZones ? 'ON' : 'OFF'}
          </button>

          {/* Diagnostics Toggle */}
          <button
            id="toggle-diagnostics-btn"
            onClick={() => setShowDiagnostics(!showDiagnostics)}
            className={`text-xs px-2.5 py-1 rounded border transition-all ${
              showDiagnostics 
                ? 'bg-amber-950/20 border-amber-500/50 text-amber-400 font-bold' 
                : 'bg-transparent border-neutral-855 text-neutral-400 hover:text-neutral-250'
            }`}
            title="Toggle Sensory Calibration Diagrams"
          >
            Diagnostics: {showDiagnostics ? 'ACTIVE' : 'STBY'}
          </button>

          {/* Front/Back Camera Toggler */}
          <button
            id="toggle-camera-facing-btn"
            onClick={toggleFacingMode}
            className="p-1 px-2.5 rounded border border-neutral-855 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 flex items-center gap-1.5 active:scale-95 transition-all text-xs"
            title="Flip Lens Source"
            aria-label="Switch between front and back camera"
          >
            <SwitchCamera className="w-3.5 h-3.5" />
            Flip
          </button>
        </div>
      </div>

      {/* Main Screen feed and canvas layered exactly */}
      <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden min-h-[320px]" id="camera-viewport">
        {/* HTML5 Video Element */}
        <video
          id="webcam-feed-view"
          ref={videoRef}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${isScanning ? 'opacity-100' : 'opacity-25'}`}
          playsInline
          muted
          aria-label="Camera feedback pane"
        />

        {/* HTML5 Overlay Drawing Glass */}
        <canvas
          id="webcam-canvas-overlay"
          ref={canvasRef}
          className="absolute inset-0 w-full h-full object-cover pointer-events-none z-10"
        />

        {/* CAMERA PRE-START OR INACTIVE COVER CARD */}
        {!isScanning && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-zinc-950/90 z-20" id="camera-standby-cover">
            {!cameraError ? (
              <>
                <Camera className="w-16 h-16 text-neutral-700 mb-4 animate-pulse" />
                <h3 className="text-lg font-bold text-neutral-300 mb-1">Camera Feed Suspended</h3>
                <p className="text-xs text-neutral-500 max-w-xs mb-6">
                  Initiate scanning to start on-device computer vision and live audio warnings.
                </p>
                <button
                  id="activate-scanning-center-btn"
                  onClick={() => onScanningStateChange(true)}
                  className="bg-emerald-500 text-black font-bold tracking-wide uppercase px-6 py-3.5 rounded-full flex items-center gap-2 hover:bg-emerald-400 active:scale-95 transition-all shadow-lg"
                  aria-label="Start Scanner and Camera Access"
                >
                  <Play className="w-5 h-5 fill-current" />
                  Start Detection
                </button>
              </>
            ) : (
              <div className="max-w-xs" id="camera-error-banner">
                <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-3" />
                <h3 className="text-sm font-bold text-neutral-300 mb-1">Camera Inaccessible</h3>
                <p className="text-xs text-red-400 mb-6 font-medium">{cameraError}</p>
                <div className="flex gap-2 justify-center">
                  <button
                    id="retry-camera-btn"
                    onClick={startCamera}
                    className="bg-neutral-800 border border-neutral-700 hover:bg-neutral-700 text-white text-xs px-4 py-2 rounded-lg flex items-center gap-1.5 transition-all"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Retry Link
                  </button>
                  <button
                    id="switch-lens-error-btn"
                    onClick={toggleFacingMode}
                    className="bg-neutral-800 border border-neutral-700 hover:bg-neutral-700 text-white text-xs px-4 py-2 rounded-lg flex items-center gap-1.5 transition-all"
                  >
                    <SwitchCamera className="w-3.5 h-3.5" />
                    Flip Lens
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Hazard alert blinking vignette borders */}
        {isScanning && predictionsRef.current.some(p => p.isHazard) && (
          <div className="absolute inset-0 pointer-events-none border-[10px] border-red-500/25 animate-pulse z-15 shadow-[inset_0_0_50px_rgba(239,68,68,0.4)]" id="hazard-ambient-pulse" />
        )}
      </div>

      {/* Quick Status Pill Bar */}
      <div className="bg-neutral-900 border-t border-neutral-800 p-4 flex flex-col sm:flex-row gap-3 justify-between items-center" id="radar-footer-bar">
        <div className="flex flex-col sm:items-start text-center sm:text-left">
          <span className="text-xs font-bold text-neutral-400 tracking-wider uppercase">Active Status</span>
          <span className="text-sm font-bold" style={{ color: themeStyle.textColor }}>
            {isScanning 
              ? (predictionsRef.current.some(p => p.isHazard) 
                  ? '⚠️ HAZARD CLOSE DIRECTLY AHEAD!' 
                  : 'Scanning safely... no close hazard') 
              : 'Standby - Sleeping'}
          </span>
        </div>

        {isScanning && (
          <button
            id="deactivate-scanning-btn"
            onClick={() => onScanningStateChange(false)}
            className="w-full sm:w-auto bg-neutral-850 hover:bg-red-950 hover:text-red-300 border border-neutral-700 hover:border-red-600/30 text-neutral-300 text-xs px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 font-semibold transition-all active:scale-95"
            aria-label="Stop Obstacle Scanning"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
            Stop System
          </button>
        )}
      </div>
    </div>
  );
}
