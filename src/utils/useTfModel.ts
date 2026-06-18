/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback } from 'react';

declare global {
  interface Window {
    tf?: any;
    cocoSsd?: {
      load: (config?: any) => Promise<any>;
    };
  }
}

export function useTfModel() {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [model, setModel] = useState<any | null>(null);
  const [status, setStatus] = useState<string>('Initializing...');

  const loadScripts = useCallback(async () => {
    try {
      setStatus('Loading computer vision engine (1/2)...');
      
      // Load TensorFlow.js
      if (!window.tf) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.20.0/dist/tf.min.js';
          script.async = true;
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Failed to load TensorFlow.js core. Check internet connection.'));
          document.body.appendChild(script);
        });
      }

      setStatus('Loading object detection intelligence (2/2)...');

      // Load COCO-SSD
      if (!window.cocoSsd) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3/dist/coco-ssd.min.js';
          script.async = true;
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Failed to load COCO-SSD model. Check internet connection.'));
          document.body.appendChild(script);
        });
      }

      setStatus('Compiling AI model locally...');
      
      if (window.cocoSsd) {
        // Load the model and cache it
        const loadedModel = await window.cocoSsd.load({
          base: 'lite_mobilenet_v2' // use a very fast & lightweight model suitable for mobile / real-time
        });
        setModel(loadedModel);
        setLoading(false);
        setStatus('Ready');
      } else {
        throw new Error('COCO-SSD script loaded but not found on window object.');
      }
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'An unknown error occurred while setting up the AI engine.');
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadScripts();
  }, [loadScripts]);

  return { model, loading, error, status };
}
