
import React, { useState, useRef } from 'react';
import { Mic, Square, Copy, Check, Loader2, RotateCcw } from 'lucide-react';
import { GoogleGenerativeAI } from '@google/generative-ai';

const ai = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY || '');

export default function App() {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [format, setFormat] = useState('bullets');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const handleRefresh = () => {
    setTranscript('');
    setError('');
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await processAudio(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setError('');
    } catch (err) {
      setError('Microphone access denied.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  const processAudio = async (blob: Blob) => {
    setIsProcessing(true);
    setError('');
    try {
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        try {
          const base64String = (reader.result as string).split(',')[1];
          const model = ai.getGenerativeModel({ model: 'gemini-2.5-flash'});
          
          // --- NEW: Dynamic Prompt Logic ---
          let promptText = `Clean this audio. Format as: ${format}. Preserve SAP FICO, Vibe Coding, Raga, Kadugu, Perungayam.`;
          
          if (format === 'prompt') {
            promptText = `Analyze the provided audio transcript. Extract the key information and output it STRICTLY in the following format with these exact labels:
**a. Objective:** [Determine the main goal]
**b. Context:** [Identify any background information]
**c. Task:** [Specify the exact action required]
**d. Output Format:** [Identify how the final result should look]

Do not include any other conversational text. Preserve terms like SAP FICO, Vibe Coding, Raga, Kadugu, Perungayam.`;
          }
          // ---------------------------------

          const result = await model.generateContent([
            { inlineData: { mimeType: blob.type, data: base64String } },
            { text: promptText }
          ]);

          setTranscript(result.response.text());
        } catch (genError: any) {
          setError(`AI Error: ${genError.message}`);
        } finally {
          setIsProcessing(false);
        }
      };
    } catch (err: any) {
      setError(`Processing failed: ${err.message}`);
      setIsProcessing(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(transcript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl p-8 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-800">Vibe Dictation</h1>
          <div className="flex items-center gap-2">
            <select 
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              className="bg-slate-100 border-none rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="bullets">Bullets</option>
              <option value="paragraph">Paragraph</option>
              <option value="email">Email</option>
              <option value="prompt">Prompt Builder</option>
            </select>
            <button onClick={handleRefresh} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
              <RotateCcw className="w-5 h-5 text-slate-600" />
            </button>
          </div>
        </div>

        <div className="relative h-64 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 p-4 overflow-auto">
          
          {/* NEW: The Smart Ghost Overlay */}
          {isRecording && format === 'prompt' && !isProcessing && (
            <div className="absolute inset-0 p-4 pointer-events-none text-slate-400 flex flex-col gap-2 z-10">
              <p className="font-semibold text-slate-500 mb-1">Speak to fill out your prompt:</p>
              <p>🎯 <span className="font-bold">Objective:</span> What is the ultimate goal?</p>
              <p>📝 <span className="font-bold">Context:</span> What is the background info?</p>
              <p>✅ <span className="font-bold">Task:</span> What exactly should the AI do?</p>
              <p>🎨 <span className="font-bold">Format:</span> How should the final output look?</p>
            </div>
          )}

          {/* EXISTING: Your Processing Animation */}
          {isProcessing ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              <p>Cleaning up your vibe...</p>
            </div>
          ) : transcript ? (
            <div className="prose prose-slate max-w-none whitespace-pre-wrap">{transcript}</div>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-400">
              {error ? <span className="text-red-500 font-medium">{error}</span> : "Start speaking..."}
            </div>
          )}
        </div>

        <div className="flex items-center justify-center gap-4">
          <button
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isProcessing}
            className={`flex items-center gap-2 px-8 py-4 rounded-full font-bold text-white transition-all transform hover:scale-105 ${
              isRecording ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-600 hover:bg-blue-700'
            } disabled:opacity-50 disabled:scale-100`}
          >
            {isRecording ? <><Square className="w-5 h-5 fill-current" /> Stop Recording</> : <><Mic className="w-5 h-5" /> Start Recording</>}
          </button>

          {transcript && (
            <div className="flex gap-2">
              <button 
                onClick={sendToGemini}
                className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors font-medium text-sm"
              >
                Send to Gemini
              </button>
              <button onClick={copyToClipboard} className="p-4 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors">
                {copied ? <Check className="w-6 h-6 text-green-600" /> : <Copy className="w-6 h-6 text-slate-600" />}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
