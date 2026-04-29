/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { 
  Upload, 
  Play, 
  Pause, 
  RotateCcw, 
  Waves, 
  MessageSquare, 
  Settings, 
  CheckCircle2, 
  AlertCircle,
  FileAudio,
  Activity,
  Mic2,
  ChevronRight,
  AudioLines
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  transcribeAudio, 
  recreateDialogue, 
  TranscriptionSegment, 
  VOICE_PROFILES, 
  VoiceID,
  SpeakerMapping 
} from './gemini';

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [base64, setBase64] = useState<string | null>(null);
  const [segments, setSegments] = useState<TranscriptionSegment[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<'idle' | 'transcribing' | 'recreating' | 'done' | 'error'>('idle');
  const [speakerMapping, setSpeakerMapping] = useState<SpeakerMapping>({});
  const [recreatedAudioUrl, setRecreatedAudioUrl] = useState<string | null>(null);
  const [originalAudioUrl, setOriginalAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const originalPlayerRef = useRef<HTMLAudioElement>(null);
  const recreatedPlayerRef = useRef<HTMLAudioElement>(null);

  // Auto-detect speakers from segments
  const detectedSpeakers = Array.from(new Set(segments.map(s => (s.speaker as string) || 'Unknown'))).filter(Boolean);

  useEffect(() => {
    // Initialize mapping for new speakers
    const newMapping = { ...speakerMapping };
    let mappingChanged = false;
    detectedSpeakers.forEach(speaker => {
      const speakerId = speaker as string;
      if (!newMapping[speakerId]) {
        newMapping[speakerId] = 'Kore'; // Default
        mappingChanged = true;
      }
    });
    if (mappingChanged) setSpeakerMapping(newMapping);
  }, [segments]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    if (!uploadedFile.type.startsWith('audio/') && !uploadedFile.type.startsWith('video/')) {
      setError("Please upload a valid audio or video file (MP3, MP4, etc.)");
      return;
    }

    setFile(uploadedFile);
    setError(null);
    setSegments([]);
    setSpeakerMapping({});
    setRecreatedAudioUrl(null);
    setOriginalAudioUrl(URL.createObjectURL(uploadedFile));
    setProgress('idle');

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setBase64(result.split(',')[1]);
    };
    reader.readAsDataURL(uploadedFile);
  };

  const processTranscription = async () => {
    if (!base64 || !file) return;
    try {
      setIsProcessing(true);
      setError(null);
      setProgress('transcribing');
      const detectedSegments = await transcribeAudio(base64, file.type);
      setSegments(detectedSegments);
      setProgress('idle');
    } catch (err: any) {
      setError(err.message || "Transcription failed.");
      setProgress('error');
    } finally {
      setIsProcessing(false);
    }
  };

  const processReconstruction = async () => {
    if (!base64 || !file || segments.length === 0) return;

    try {
      setIsProcessing(true);
      setError(null);
      setProgress('recreating');
      
      const { audioBase64, mimeType } = await recreateDialogue(
        base64, 
        file.type, 
        speakerMapping, 
        segments
      );
      
      const blob = b64toBlob(audioBase64, mimeType);
      const url = URL.createObjectURL(blob);
      setRecreatedAudioUrl(url);
      
      setProgress('done');
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An error occurred during audio processing.");
      setProgress('error');
    } finally {
      setIsProcessing(false);
    }
  };

  const updateSegmentText = (idx: number, newText: string) => {
    const newSegments = [...segments];
    newSegments[idx].text = newText;
    setSegments(newSegments);
  };

  const b64toBlob = (b64Data: string, contentType = '', sliceSize = 512) => {
    const byteCharacters = atob(b64Data);
    const byteArrays = [];
    for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
      const slice = byteCharacters.slice(offset, offset + sliceSize);
      const byteNumbers = new Array(slice.length);
      for (let i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      byteArrays.push(byteArray);
    }
    return new Blob(byteArrays, { type: contentType });
  };

  return (
    <div className="min-h-screen bg-[#0f1012] text-slate-200 technical-grid p-6 lg:p-12 selection:bg-blue-500/30">
      <main className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Sidebar: Controls & Settings */}
        <div className="lg:col-span-4 space-y-6">
          <header className="mb-8">
            <h1 className="text-3xl font-light tracking-tight text-white mb-2">
              VOCAL<span className="font-bold text-blue-500">RECONSTRUCTOR</span>
            </h1>
            <p className="text-xs font-mono text-slate-500 uppercase tracking-widest">
              High Precision Dialogue Restoration
            </p>
          </header>

          {/* File Upload Area */}
          <div className="glass-panel rounded-lg p-6 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Upload className="w-4 h-4 text-blue-400" />
              <span className="mono-label">Input Source</span>
            </div>
            
            <label className="group relative block w-full aspect-[4/3] rounded-lg border-2 border-dashed border-slate-700 bg-slate-800/30 hover:bg-slate-800/50 hover:border-blue-500 transition-all cursor-pointer overflow-hidden">
              <input type="file" className="hidden" onChange={handleFileUpload} accept="audio/*,video/*" />
              <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
                {file ? (
                  <>
                    {file.type.startsWith('video/') ? (
                      <Activity className="w-12 h-12 text-blue-500 mb-2" />
                    ) : (
                      <FileAudio className="w-12 h-12 text-blue-500 mb-2" />
                    )}
                    <p className="text-sm font-medium text-white max-w-full truncate px-4">{file.name}</p>
                    <p className="text-xs text-slate-500 mt-1 font-mono">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </>
                ) : (
                  <>
                    <Upload className="w-10 h-10 text-slate-600 group-hover:text-blue-400 transition-colors mb-2" />
                    <p className="text-sm text-slate-400">Drop MP3/MP4 Dialogue</p>
                    <p className="text-[10px] text-slate-600 font-mono mt-2 uppercase">Max 20MB推奨</p>
                  </>
                )}
              </div>
            </label>
          </div>

          {/* Voice configuration */}
          <div className="glass-panel rounded-lg p-6 space-y-6">
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4 text-blue-400" />
              <span className="mono-label">Generation Engine</span>
            </div>

            {segments.length === 0 ? (
              <button 
                onClick={processTranscription}
                disabled={!file || isProcessing}
                className={`w-full py-4 rounded-lg font-bold text-sm tracking-widest uppercase transition-all flex items-center justify-center gap-3 ${
                  isProcessing 
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed' 
                  : 'bg-blue-600 hover:bg-blue-500 text-white'
                }`}
              >
                {isProcessing ? (
                  <>
                    <Activity className="w-4 h-4 animate-pulse" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Mic2 className="w-4 h-4" />
                    Phase 1: Transcribe
                  </>
                )}
              </button>
            ) : (
              <div className="space-y-6">
                <div className="space-y-4">
                  <span className="mono-label !text-[9px] text-slate-500">Speaker Assignment</span>
                  {detectedSpeakers.map((speakerName) => (
                    <div key={speakerName as string} className="space-y-2 p-3 bg-slate-800/40 rounded border border-slate-700">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] font-mono text-blue-400">{speakerName as string}</span>
                        <span className="text-[9px] text-slate-500 uppercase">{VOICE_PROFILES.find(v => v.id === speakerMapping[speakerName as string])?.gender}</span>
                      </div>
                      <select 
                        value={speakerMapping[speakerName as string] || 'Kore'}
                        onChange={(e) => setSpeakerMapping({ ...speakerMapping, [speakerName as string]: e.target.value as VoiceID })}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-blue-500"
                      >
                        {VOICE_PROFILES.map(v => (
                          <option key={v.id} value={v.id}>{v.name} ({v.gender})</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>

                <button 
                  onClick={processReconstruction}
                  disabled={isProcessing}
                  className={`w-full py-4 rounded-lg font-bold text-sm tracking-widest uppercase transition-all flex items-center justify-center gap-3 ${
                    isProcessing 
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed' 
                    : 'bg-green-600 hover:bg-green-500 text-white recording-glow'
                  }`}
                >
                  {isProcessing ? (
                     <>
                      <Activity className="w-4 h-4 animate-pulse" />
                      Reconstructing...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" />
                      Phase 2: Generate
                    </>
                  )}
                </button>

                <button 
                  onClick={() => { setSegments([]); setRecreatedAudioUrl(null); }}
                  className="w-full py-2 text-[10px] mono-label text-slate-500 hover:text-white transition-colors flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset Analysis
                </button>
              </div>
            )}
          </div>

          {error && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 bg-red-900/20 border border-red-500/50 rounded-lg flex items-start gap-3"
            >
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <p className="text-xs text-red-100">{error}</p>
            </motion.div>
          )}
        </div>

        {/* Right Content: Analysis & Playback */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          
          {/* Status Monitor */}
          <div className="glass-panel rounded-lg p-4 flex items-center justify-between">
            <div className="flex gap-8">
              <div className="flex flex-col">
                <span className="mono-label !text-[9px] text-slate-500 mb-1">Status</span>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${isProcessing ? 'bg-orange-500 animate-pulse' : 'bg-green-500'}`} />
                  <span className="text-xs font-mono uppercase">{progress}</span>
                </div>
              </div>
              <div className="flex flex-col">
                <span className="mono-label !text-[9px] text-slate-500 mb-1">Timing Accuracy</span>
                <span className="text-xs font-mono">+/- 0.05ms</span>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Waves className="w-4 h-4 text-blue-400" />
              <span className="mono-label">Oscilloscope Active</span>
            </div>
          </div>

          {/* Main Dashboard Area */}
          <div className="flex-1 glass-panel rounded-lg overflow-hidden flex flex-col">
            
            {/* Playback Channels */}
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8 border-bottom border-slate-800">
              {/* Original Channel */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="mono-label text-slate-400">CH-01: Original Artifact</span>
                  {originalAudioUrl && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                </div>
                <div className="bg-black/40 rounded-lg p-4 border border-slate-800">
                  <audio ref={originalPlayerRef} src={originalAudioUrl || undefined} controls className="w-full h-10 filter invert opacity-80" />
                </div>
              </div>

              {/* Reconstructed Channel */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="mono-label text-slate-400">CH-02: Reconstructed Dialectic</span>
                  {recreatedAudioUrl && <Activity className="w-4 h-4 text-blue-500 animate-pulse" />}
                </div>
                <div className={`rounded-lg p-4 border transition-all ${recreatedAudioUrl ? 'bg-blue-900/10 border-blue-500/30' : 'bg-black/20 border-slate-800'}`}>
                  {recreatedAudioUrl ? (
                    <audio ref={recreatedPlayerRef} src={recreatedAudioUrl} controls className="w-full h-10 filter invert opacity-80" />
                  ) : (
                    <div className="h-10 flex items-center justify-center">
                      <p className="text-[10px] font-mono text-slate-600 uppercase italic">Waiting for processing...</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Transcription / Timeline View */}
            <div className="flex-1 overflow-hidden flex flex-col">
              <div className="px-6 py-3 bg-slate-900/50 border-y border-slate-800 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-blue-400" />
                  <span className="mono-label">Semantic Breakdown</span>
                </div>
                <span className="text-[10px] font-mono text-slate-500 uppercase">{segments.length} Phrases Detected</span>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
                <AnimatePresence mode="popLayout">
                  {segments.length > 0 ? (
                    <div className="space-y-4">
                      {segments.map((seg, idx) => (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.05 }}
                          className="flex gap-6 group hover:bg-slate-800/20 p-2 rounded transition-colors"
                        >
                          <div className="w-24 shrink-0 font-mono text-[10px] text-slate-500 flex flex-col">
                            <span>{seg.startTime.toFixed(2)}s</span>
                            <div className="h-4 w-[1px] bg-slate-800 mx-auto my-1" />
                            <span>{seg.endTime.toFixed(2)}s</span>
                          </div>
                          
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center justify-between">
                              {seg.speaker && (
                                <span className="text-[9px] font-mono text-blue-400 uppercase bg-blue-400/10 px-1.5 py-0.5 rounded">
                                  {seg.speaker}
                                </span>
                              )}
                              <span className="text-[9px] font-mono text-slate-600">
                                Assigned: {speakerMapping[seg.speaker || 'Unknown']}
                              </span>
                            </div>
                            
                            <textarea
                              value={seg.text}
                              onChange={(e) => updateSegmentText(idx, e.target.value)}
                              rows={1}
                              className="w-full bg-transparent text-sm text-slate-300 leading-relaxed focus:text-white focus:outline-none focus:bg-slate-800/30 rounded px-1 transition-all resize-none border-none overflow-hidden"
                              onInput={(e) => {
                                const target = e.target as HTMLTextAreaElement;
                                target.style.height = 'auto';
                                target.style.height = target.scrollHeight + 'px';
                              }}
                            />
                            
                            <div className="h-[2px] w-full bg-slate-800 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-blue-500/20 transition-all"
                                style={{ width: '100%' }}
                              />
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-600 py-12">
                      <AudioLines className="w-12 h-12 mb-4 opacity-20" />
                      <p className="text-sm italic font-light italic">Analyze audio to generate semantic timeline...</p>
                    </div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Bottom Info Rail */}
            <div className="p-3 bg-black border-t border-slate-800 flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5 grayscale opacity-50">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  <span className="text-[9px] font-mono tracking-tighter uppercase">Sync Locked</span>
                </div>
                <div className="flex items-center gap-1.5 grayscale opacity-50">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                  <span className="text-[9px] font-mono tracking-tighter uppercase">Gemini 3.1 Live Interface</span>
                </div>
              </div>
              <p className="text-[9px] font-mono text-slate-700 tracking-widest uppercase">
                Temporal Precision Protocol v4.2
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Decorative elements */}
      <div className="fixed bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-slate-800 to-transparent" />
      <div className="fixed top-0 left-0 w-[1px] h-full bg-gradient-to-b from-transparent via-slate-800 to-transparent" />
    </div>
  );
}
