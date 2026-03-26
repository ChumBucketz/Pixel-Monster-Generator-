/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RefreshCw, Download, Trash2, Settings2, Share2, Info, MousePointer2, Hand, ZoomIn, ZoomOut, Layers, FileText, ChevronDown } from 'lucide-react';

const CANVAS_DISPLAY_SIZE = 512;

export default function App() {
  const [gridSize, setGridSize] = useState(32);
  const [pixels, setPixels] = useState<number[][]>([]);
  const [color, setColor] = useState('#00ff00');
  const [density, setDensity] = useState(0.4);
  const [styleStrength, setStyleStrength] = useState(0.7);
  const [brushSize, setBrushSize] = useState(1);
  const [archetype, setArchetype] = useState<'standard' | 'blob' | 'humanoid' | 'insect' | 'flyer' | 'worm' | 'giant' | 'twin'>('standard');
  const [isSymmetrical, setIsSymmetrical] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [tool, setTool] = useState<'brush' | 'hand'>('brush');
  const [isGenerating, setIsGenerating] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mainAreaRef = useRef<HTMLDivElement>(null);
  const isDrawingRef = useRef(false);
  const isPanningRef = useRef(false);
  const lastPanPosRef = useRef({ x: 0, y: 0 });
  const strokeModeRef = useRef<number>(1); // 1 for draw, 0 for erase

  // Initialize empty grid and regenerate on parameter changes
  useEffect(() => {
    generateMonster();
  }, [density, styleStrength, archetype, gridSize]);

  // Handle non-passive wheel events for zooming
  useEffect(() => {
    const mainArea = mainAreaRef.current;
    if (!mainArea) return;

    const handleWheelNative = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        setZoom(prev => Math.min(4, Math.max(0.5, prev + delta)));
      } else {
        setPan(prev => ({ x: prev.x - e.deltaX, y: prev.y - e.deltaY }));
      }
    };

    mainArea.addEventListener('wheel', handleWheelNative, { passive: false });
    return () => mainArea.removeEventListener('wheel', handleWheelNative);
  }, []);

  // Mirror canvas when symmetry is toggled ON
  useEffect(() => {
    if (isSymmetrical && pixels.length > 0 && pixels.length === gridSize) {
      const newPixels = [...pixels.map(row => [...row])];
      for (let y = 0; y < gridSize; y++) {
        if (!newPixels[y]) continue;
        for (let x = 0; x < Math.floor(gridSize / 2); x++) {
          const mirrorX = gridSize - 1 - x;
          if (newPixels[y][x] === 1) {
            newPixels[y][mirrorX] = 1;
          } else if (newPixels[y][mirrorX] === 1) {
            newPixels[y][x] = 1;
          }
        }
      }
      setPixels(newPixels);
    }
  }, [isSymmetrical, gridSize]);

  const generateMonster = useCallback(() => {
    setIsGenerating(true);
    const newPixels = Array(gridSize).fill(0).map(() => Array(gridSize).fill(0));

    const widthToGen = isSymmetrical ? Math.ceil(gridSize / 2) : gridSize;
    const centerX = isSymmetrical ? widthToGen - 1 : Math.floor(gridSize / 2);
    const centerY = Math.floor(gridSize / 2);
    const scale = gridSize / 32;

    // Helper to draw an ellipse with style-aware noise
    const drawEllipse = (cx: number, cy: number, w: number, h: number, prob: number = 1) => {
      for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < widthToGen; x++) {
          const dx = (x - cx) / (w / 2);
          const dy = (y - cy) / (h / 2);
          const distSq = dx * dx + dy * dy;

          // Base threshold based on style strength
          const edgeSoftness = 0.5 * (1 - styleStrength);
          const threshold = 1.0 - (Math.random() * edgeSoftness);
          
          // Noise factor: higher when style is abstract
          const noiseFactor = (1 - styleStrength) * 0.8;
          const randomValue = Math.random();
          
          let isFilled = false;
          if (styleStrength < 0.2) {
            // Very abstract: scattered noise with a slight center bias
            isFilled = randomValue < (prob * density * (1 - distSq * 0.5));
          } else {
            // Transitioning to illustrative: solid core with noisy edges
            isFilled = distSq < (threshold * prob);
            
            // Add some "holes" or "speckles" if not fully illustrative
            if (isFilled && randomValue < noiseFactor * 0.2) {
              isFilled = false;
            }
          }

          if (isFilled) {
            newPixels[y][x] = 1;
          }
        }
      }
    };

    // Helper for random walk appendages with style-aware pathing
    const addAppendage = (startX: number, startY: number, length: number, dirX: number, dirY: number) => {
      let curX = startX;
      let curY = startY;
      for (let l = 0; l < length; l++) {
        const randomness = 0.6 * (1 - styleStrength);
        
        if (Math.random() > randomness) {
          curX += dirX;
        } else {
          curX += (Math.random() > 0.5 ? 1 : -1);
        }

        if (Math.random() > randomness) {
          curY += dirY;
        } else {
          curY += (Math.random() > 0.5 ? 1 : -1);
        }

        if (curX >= 0 && curX < widthToGen && curY >= 0 && curY < gridSize) {
          newPixels[curY][curX] = 1;
          
          if (styleStrength > 0.6 && Math.random() > 0.7) {
            const tx = curX + (Math.random() > 0.5 ? 1 : -1);
            const ty = curY + (Math.random() > 0.5 ? 1 : -1);
            if (tx >= 0 && tx < widthToGen && ty >= 0 && ty < gridSize) {
              newPixels[ty][tx] = 1;
            }
          }
        } else break;
      }
    };

    // 1. Core Body Generation based on Archetype
    const sizeMod = 0.7 + (styleStrength * 0.3);
    
    switch (archetype) {
      case 'standard':
        drawEllipse(centerX, centerY, (8 + Math.random() * 6) * sizeMod * scale, (10 + Math.random() * 8) * sizeMod * scale, density);
        break;
      case 'blob':
        drawEllipse(centerX, centerY + Math.floor(4 * scale), (12 + Math.random() * 8) * sizeMod * scale, (10 + Math.random() * 6) * sizeMod * scale, density * 1.2);
        break;
      case 'humanoid':
        // Head
        drawEllipse(centerX, centerY - Math.floor(8 * scale), 6 * styleStrength * sizeMod * scale, 6 * styleStrength * sizeMod * scale, density);
        // Torso
        drawEllipse(centerX, centerY, 8 * styleStrength * sizeMod * scale, 12 * styleStrength * sizeMod * scale, density);
        // Legs
        if (styleStrength > 0.3) {
          addAppendage(centerX - Math.floor(2 * scale), centerY + Math.floor(4 * scale), 10 * styleStrength * scale, 0, 1);
          addAppendage(centerX + Math.floor(2 * scale), centerY + Math.floor(4 * scale), 10 * styleStrength * scale, 0, 1);
        }
        break;
      case 'insect':
        drawEllipse(centerX, centerY, 6 * styleStrength * sizeMod * scale, 10 * styleStrength * sizeMod * scale, density);
        // Many legs
        if (styleStrength > 0.2) {
          const legs = 3 + Math.floor(styleStrength * 4);
          for (let i = 0; i < legs; i++) {
            addAppendage(centerX, centerY - Math.floor(4 * scale) + i * Math.floor(3 * scale), 8 * styleStrength * scale, -1, Math.random() > 0.5 ? 1 : -1);
          }
        }
        break;
      case 'flyer':
        drawEllipse(centerX, centerY, 6 * styleStrength * sizeMod * scale, 6 * styleStrength * sizeMod * scale, density);
        // Wings
        if (styleStrength > 0.3) {
          const wingSpan = Math.floor((5 + styleStrength * 10) * scale);
          for (let i = 0; i < wingSpan; i++) {
            const wy = centerY - Math.floor(2 * scale) + (Math.random() * 4 * scale - 2 * scale);
            const wx = centerX - i;
            if (wx >= 0 && wy >= 0 && wy < gridSize) newPixels[Math.floor(wy)][Math.floor(wx)] = 1;
          }
        }
        break;
      case 'worm':
        drawEllipse(centerX, centerY, 4 * styleStrength * sizeMod * scale, 24 * styleStrength * sizeMod * scale, density);
        break;
      case 'giant':
        drawEllipse(centerX, centerY + Math.floor(4 * scale), 18 * styleStrength * sizeMod * scale, 18 * styleStrength * sizeMod * scale, density);
        drawEllipse(centerX, centerY - Math.floor(10 * scale), 4 * styleStrength * sizeMod * scale, 4 * styleStrength * sizeMod * scale, density);
        break;
      case 'twin':
        drawEllipse(centerX - Math.floor(4 * scale), centerY, 6 * styleStrength * sizeMod * scale, 10 * styleStrength * sizeMod * scale, density);
        drawEllipse(centerX + Math.floor(4 * scale), centerY, 6 * styleStrength * sizeMod * scale, 10 * styleStrength * sizeMod * scale, density);
        break;
    }

    // 1.5 Add "Glitch" noise for abstract styles
    if (styleStrength < 0.5) {
      const glitchCount = Math.floor((1 - styleStrength) * 15 * scale);
      for (let i = 0; i < glitchCount; i++) {
        const gx = Math.floor(Math.random() * widthToGen);
        const gy = Math.floor(Math.random() * gridSize);
        const gLen = Math.floor((2 + Math.random() * 5) * scale);
        const horizontal = Math.random() > 0.5;
        
        for (let j = 0; j < gLen; j++) {
          const px = horizontal ? gx + j : gx;
          const py = horizontal ? gy : gy + j;
          if (px >= 0 && px < widthToGen && py >= 0 && py < gridSize) {
            newPixels[py][px] = 1;
          }
        }
      }

      // Add floating particles/sparks
      const sparkCount = Math.floor((1 - styleStrength) * 30 * scale);
      for (let i = 0; i < sparkCount; i++) {
        const sx = Math.floor(Math.random() * widthToGen);
        const sy = Math.floor(Math.random() * gridSize);
        if (sx >= 0 && sx < widthToGen && sy >= 0 && sy < gridSize) {
          newPixels[sy][sx] = 1;
        }
      }
    }

    // 2. Add random extra appendages
    if (archetype === 'standard' || archetype === 'blob' || archetype === 'worm' || archetype === 'giant') {
      const numAppendages = styleStrength < 0.3 ? 5 + Math.floor(Math.random() * 10) : 2 + Math.floor(Math.random() * 4);
      for (let i = 0; i < numAppendages; i++) {
        let found = styleStrength < 0.2; 
        let startX = 0, startY = 0;
        if (!found) {
          for (let attempt = 0; attempt < 100; attempt++) {
            const tx = Math.floor(Math.random() * widthToGen);
            const ty = Math.floor(Math.random() * gridSize);
            if (newPixels[ty][tx] === 1) { startX = tx; startY = ty; found = true; break; }
          }
        }
        if (found) {
          addAppendage(startX, startY, styleStrength < 0.4 ? Math.floor((2 + Math.random() * 4) * scale) : Math.floor((3 + Math.random() * 8) * scale), Math.random() > 0.5 ? 1 : -1, Math.random() > 0.5 ? 1 : -1);
        }
      }
    }

    // 3. Mirroring
    if (isSymmetrical) {
      for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < widthToGen; x++) {
          if (newPixels[y][x] === 1) newPixels[y][gridSize - 1 - x] = 1;
        }
      }
    }

    // 4. Eyes & Mouth
    if (styleStrength > 0.3) {
      const eyeY = archetype === 'humanoid' ? centerY - Math.floor(8 * scale) : centerY - Math.floor(2 * scale) - Math.floor(Math.random() * 4 * scale);
      const eyeXOffset = Math.floor((2 + Math.random() * 4) * scale);
      const placeEye = (ex: number, ey: number) => {
        if (ey >= 0 && ey < gridSize && ex >= 0 && ex < gridSize) newPixels[ey][ex] = 0;
      };

      if (isSymmetrical) {
        const ex1 = Math.floor(gridSize / 2) - eyeXOffset;
        const ex2 = Math.floor(gridSize / 2) + eyeXOffset - 1;
        placeEye(ex1, eyeY);
        placeEye(ex2, eyeY);
      } else {
        const ex = Math.floor(gridSize / 2) + (Math.random() * 6 * scale - 3 * scale);
        placeEye(Math.floor(ex), eyeY);
      }

      if (styleStrength > 0.5) {
        const mouthY = eyeY + Math.floor((3 + Math.random() * 3) * scale);
        const mouthWidth = Math.floor((1 + Math.random() * 3) * scale);
        for (let mx = -mouthWidth; mx <= mouthWidth; mx++) {
          const curX = Math.floor(gridSize / 2) + mx;
          if (curX >= 0 && curX < gridSize && mouthY < gridSize) newPixels[mouthY][curX] = 0;
        }
      }
    }

    setPixels(newPixels);
    setTimeout(() => setIsGenerating(false), 300);
  }, [density, styleStrength, isSymmetrical, archetype]);

  useEffect(() => {
    if (canvasRef.current && pixels.length > 0) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, gridSize, gridSize);
        ctx.fillStyle = color;
        pixels.forEach((row, y) => {
          row.forEach((pixel, x) => {
            if (pixel === 1) {
              ctx.fillRect(x, y, 1, 1);
            }
          });
        });
      }
    }
  }, [pixels, color, gridSize]);

  const downloadImage = () => {
    if (!canvasRef.current) return;
    const link = document.createElement('a');
    link.download = 'pixel-monster.png';
    link.href = canvasRef.current.toDataURL();
    link.click();
  };

  const handleCanvasInteraction = (e: React.MouseEvent | React.TouchEvent) => {
    if (!canvasRef.current || tool !== 'brush') return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    let clientX, clientY;

    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const x = Math.floor(((clientX - rect.left) / rect.width) * gridSize);
    const y = Math.floor(((clientY - rect.top) / rect.height) * gridSize);

    if (x >= 0 && x < gridSize && y >= 0 && y < gridSize && pixels[y]) {
      const newPixels = [...pixels.map(row => [...row])];
      const newValue = strokeModeRef.current;
      let changed = false;

      // Apply brush size
      const radius = Math.floor((brushSize - 1) / 2);
      const startOffset = -radius;
      const endOffset = brushSize % 2 === 0 ? radius + 1 : radius;

      for (let dy = startOffset; dy <= endOffset; dy++) {
        for (let dx = startOffset; dx <= endOffset; dx++) {
          const px = x + dx;
          const py = y + dy;

          if (px >= 0 && px < gridSize && py >= 0 && py < gridSize && newPixels[py]) {
            if (newPixels[py][px] !== newValue) {
              newPixels[py][px] = newValue;
              changed = true;
              if (isSymmetrical) {
                const mirrorX = gridSize - 1 - px;
                if (newPixels[py][mirrorX] !== undefined) {
                  newPixels[py][mirrorX] = newValue;
                }
              }
            }
          }
        }
      }
      
      if (changed) {
        setPixels(newPixels);
      }
    }
  };

  const onMouseDown = (e: React.MouseEvent) => {
    if (!canvasRef.current) return;
    
    if (tool === 'hand' || e.button === 1) { // Middle mouse or hand tool
      isPanningRef.current = true;
      lastPanPosRef.current = { x: e.clientX, y: e.clientY };
      return;
    }

    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * gridSize);
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * gridSize);

    if (x >= 0 && x < gridSize && y >= 0 && y < gridSize && pixels[y]) {
      strokeModeRef.current = pixels[y][x] === 1 ? 0 : 1;
      isDrawingRef.current = true;
      handleCanvasInteraction(e);
    }
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (isPanningRef.current) {
      const dx = e.clientX - lastPanPosRef.current.x;
      const dy = e.clientY - lastPanPosRef.current.y;
      setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      lastPanPosRef.current = { x: e.clientX, y: e.clientY };
    } else if (isDrawingRef.current) {
      handleCanvasInteraction(e);
    }
  };

  const onMouseUp = () => {
    isDrawingRef.current = false;
    isPanningRef.current = false;
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoom(prev => Math.min(4, Math.max(0.5, prev + delta)));
    } else {
      setPan(prev => ({ x: prev.x - e.deltaX, y: prev.y - e.deltaY }));
    }
  };

  return (
    <div className="h-screen bg-[#1e1e1e] text-[#e0e0e0] font-sans selection:bg-blue-500 selection:text-white overflow-hidden flex flex-col">
      {/* Top Navigation Bar (Figma Style) */}
      <header className="h-12 border-b border-[#383838] bg-[#2c2c2c] flex items-center justify-between px-2 z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 flex items-center justify-center hover:bg-[#3d3d3d] rounded-md transition-colors cursor-pointer">
            <Settings2 className="w-5 h-5 text-zinc-400" />
          </div>
          <div className="h-6 w-[1px] bg-[#383838] mx-1" />
          <div className="flex items-center gap-2 px-2">
            <span className="text-[13px] font-medium text-white">Monster_Gen.v1</span>
            <span className="text-[11px] text-zinc-500">/ Draft</span>
          </div>
        </div>

        {/* Center Toolbar (Figma Style) */}
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1 bg-[#2c2c2c] p-1 rounded-lg border border-[#383838]">
          <button 
            onClick={() => setTool('brush')}
            className={`p-1.5 rounded-md transition-colors ${tool === 'brush' ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:bg-[#3d3d3d]'}`}
          >
            <MousePointer2 className="w-4 h-4" />
          </button>
          <button 
            onClick={() => setTool('hand')}
            className={`p-1.5 rounded-md transition-colors ${tool === 'hand' ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:bg-[#3d3d3d]'}`}
          >
            <Hand className="w-4 h-4" />
          </button>
          <div className="w-[1px] h-4 bg-[#383838] mx-1" />
          <button 
            onClick={generateMonster}
            className="p-1.5 hover:bg-[#3d3d3d] rounded-md text-zinc-400"
          >
            <RefreshCw className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
          </button>
          <button 
            onClick={() => setPixels(Array(gridSize).fill(0).map(() => Array(gridSize).fill(0)))}
            className="p-1.5 hover:bg-[#3d3d3d] rounded-md text-zinc-400"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <div className="w-[1px] h-4 bg-[#383838] mx-1" />
          <button className="p-1.5 hover:bg-[#3d3d3d] rounded-md text-zinc-400">
            <Share2 className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 mr-2">
            <span className="text-[11px] text-zinc-400 font-medium">{Math.round(zoom * 100)}%</span>
            <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} className="p-1 hover:bg-[#3d3d3d] rounded text-zinc-500 hover:text-white">
              <ChevronDown className="w-3 h-3" />
            </button>
          </div>
          <button 
            onClick={downloadImage}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-[12px] font-medium rounded-md transition-colors flex items-center gap-2"
          >
            <Download className="w-3.5 h-3.5" />
            Export
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar: Archetypes */}
        <aside className="w-60 border-r border-[#383838] bg-[#2c2c2c] flex flex-col overflow-hidden">
          <div className="p-4 border-b border-[#383838]">
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-4">Archetypes</h2>
            <div className="grid grid-cols-2 gap-2">
              {(['standard', 'blob', 'humanoid', 'insect', 'flyer', 'worm', 'giant', 'twin'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setArchetype(t)}
                  className={`py-2 text-[10px] rounded-md border transition-all flex flex-col items-center gap-1 ${archetype === t ? 'bg-[#3d3d3d] border-blue-500 text-white' : 'border-transparent text-zinc-400 hover:bg-[#3d3d3d]'}`}
                >
                  <div className="w-4 h-4 rounded-full bg-zinc-700" />
                  {t}
                </button>
              ))}
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4">
            <div className="flex items-center gap-2 text-[10px] text-zinc-500 mb-4">
              <Info className="w-3 h-3" />
              <span>Select an archetype to define the base structure of your entity.</span>
            </div>
          </div>
        </aside>

        {/* Main Canvas Area */}
        <main 
          ref={mainAreaRef}
          className="flex-1 relative bg-[#1e1e1e] flex items-center justify-center overflow-hidden p-20"
        >
          {/* Background Grid Dots */}
          <div className="absolute inset-0 opacity-[0.15] pointer-events-none" 
               style={{ 
                 backgroundImage: 'radial-gradient(#555 1px, transparent 1px)', 
                 backgroundSize: '24px 24px',
                 backgroundPosition: `${pan.x}px ${pan.y}px`
               }} />
          
          <div className="relative" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>
            <motion.div 
              initial={false}
              animate={{ scale: isGenerating ? 0.99 : 1 }}
              className="relative bg-black border border-[#383838] shadow-2xl overflow-hidden"
              style={{ width: CANVAS_DISPLAY_SIZE, height: CANVAS_DISPLAY_SIZE }}
            >
              <canvas
                ref={canvasRef}
                width={gridSize}
                height={gridSize}
                className={`pixel-grid ${tool === 'hand' ? 'cursor-grab active:cursor-grabbing' : 'cursor-crosshair'}`}
                onMouseDown={onMouseDown}
                onMouseMove={onMouseMove}
                onMouseUp={onMouseUp}
                onMouseLeave={onMouseUp}
                onTouchStart={(e) => {
                  if (!canvasRef.current || tool !== 'brush') return;
                  const rect = canvasRef.current.getBoundingClientRect();
                  const touch = e.touches[0];
                  const x = Math.floor(((touch.clientX - rect.left) / rect.width) * gridSize);
                  const y = Math.floor(((touch.clientY - rect.top) / rect.height) * gridSize);
                  if (x >= 0 && x < gridSize && y >= 0 && y < gridSize && pixels[y]) {
                    strokeModeRef.current = pixels[y][x] === 1 ? 0 : 1;
                    handleCanvasInteraction(e);
                  }
                }}
                onTouchMove={handleCanvasInteraction}
                style={{ 
                  width: '100%', 
                  height: '100%',
                  imageRendering: 'pixelated'
                }}
              />
            </motion.div>

            {/* Canvas Labels */}
            <div className="absolute -top-6 left-0 text-[10px] text-zinc-500 font-medium flex items-center gap-2">
              <span className="bg-[#2c2c2c] px-1.5 py-0.5 rounded border border-[#383838]">{gridSize} x {gridSize} px</span>
              {isSymmetrical && <span className="text-blue-500">Symmetrical</span>}
            </div>
          </div>

          {/* Zoom Controls (Floating) */}
          <div className="absolute bottom-6 right-6 bg-[#2c2c2c] border border-[#383838] rounded-lg p-1 flex items-center gap-1 shadow-xl z-20">
            <button onClick={() => setZoom(Math.max(0.5, zoom - 0.1))} className="w-8 h-8 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-[#3d3d3d] rounded-md transition-colors">
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <div className="w-[1px] h-4 bg-[#383838]" />
            <button onClick={() => setZoom(Math.min(4, zoom + 0.1))} className="w-8 h-8 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-[#3d3d3d] rounded-md transition-colors">
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>
        </main>

        {/* Right Sidebar: Properties */}
        <aside className="w-60 border-l border-[#383838] bg-[#2c2c2c] flex flex-col overflow-y-auto">
          <div className="p-4 space-y-8">
            {/* Layout Section */}
            <section className="space-y-4">
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Layout</h2>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] text-zinc-300">Screen Size</span>
                  <div className="flex bg-[#1a1a1a] rounded p-0.5 border border-[#383838]">
                    {[32, 64].map((size) => (
                      <button
                        key={size}
                        onClick={() => setGridSize(size)}
                        className={`px-2 py-1 text-[10px] rounded transition-all ${gridSize === size ? 'bg-[#3d3d3d] text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[12px] text-zinc-300">Symmetry</span>
                  <button 
                    onClick={() => setIsSymmetrical(!isSymmetrical)}
                    className={`w-8 h-4 rounded-full transition-colors relative ${isSymmetrical ? 'bg-blue-500' : 'bg-zinc-700'}`}
                  >
                    <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${isSymmetrical ? 'left-4.5' : 'left-0.5'}`} />
                  </button>
                </div>

                <div className="space-y-3">
                  <label className="text-[12px] text-zinc-300 flex justify-between">
                    <span>Brush Size</span>
                    <span className="text-blue-400">{brushSize}px</span>
                  </label>
                  <input 
                    type="range" 
                    min="1" 
                    max="4" 
                    step="1" 
                    value={brushSize} 
                    onChange={(e) => setBrushSize(parseInt(e.target.value))}
                    className="w-full accent-blue-500 h-1 bg-[#1a1a1a] rounded-full appearance-none cursor-pointer"
                  />
                </div>
              </div>
            </section>

            {/* Generation Section */}
            <section className="space-y-4">
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Generation</h2>
              
              <div className="space-y-3">
                <label className="text-[12px] text-zinc-300 flex justify-between">
                  <span>Density</span>
                  <span className="text-blue-400">{Math.round(density * 100)}%</span>
                </label>
                <input 
                  type="range" 
                  min="0.1" 
                  max="0.8" 
                  step="0.05" 
                  value={density} 
                  onChange={(e) => setDensity(parseFloat(e.target.value))}
                  className="w-full accent-blue-500 h-1 bg-[#1a1a1a] rounded-full appearance-none cursor-pointer"
                />
              </div>

              <div className="space-y-3">
                <label className="text-[12px] text-zinc-300 flex justify-between">
                  <span>Style</span>
                  <span className="text-blue-400">{styleStrength < 0.4 ? 'Abstract' : styleStrength < 0.7 ? 'Hybrid' : 'Illustrative'}</span>
                </label>
                <input 
                  type="range" 
                  min="0" 
                  max="1" 
                  step="0.1" 
                  value={styleStrength} 
                  onChange={(e) => setStyleStrength(parseFloat(e.target.value))}
                  className="w-full accent-blue-500 h-1 bg-[#1a1a1a] rounded-full appearance-none cursor-pointer"
                />
              </div>

              <button 
                onClick={generateMonster}
                disabled={isGenerating}
                className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white text-[12px] font-medium rounded-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
                Regenerate
              </button>
            </section>

            {/* Fill Section */}
            <section className="space-y-4">
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Fill</h2>
              <div className="flex gap-2 flex-wrap">
                {['#00ff00', '#ff00ff', '#00ffff', '#ffff00', '#ffffff', '#ff3333'].map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={`w-6 h-6 rounded-md border transition-all ${color === c ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-[#383838] hover:border-zinc-500'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
                <div className="relative w-6 h-6">
                  <input 
                    type="color" 
                    value={color} 
                    onChange={(e) => setColor(e.target.value)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="w-full h-full rounded-md border border-[#383838] flex items-center justify-center text-[10px] text-zinc-500">
                    +
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 px-2 py-1.5 bg-[#1a1a1a] rounded border border-[#383838]">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
                <span className="text-[11px] font-mono text-zinc-400 uppercase">{color}</span>
              </div>
            </section>
          </div>

          <div className="mt-auto p-4 border-t border-[#383838] bg-[#252525]">
            <div className="flex items-center gap-2 text-[10px] text-zinc-500">
              <Info className="w-3 h-3" />
              <span>Entity_ID: {Math.random().toString(36).substring(7).toUpperCase()}</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

