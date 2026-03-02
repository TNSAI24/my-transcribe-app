import React, { useState, useRef } from 'react';
import { Mic, Square, Copy, Check, Loader2, RotateCcw } from 'lucide-react';
import { GoogleGenerativeAI } from '@google/generative-ai';

const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

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
        processAudio(audioBlob);
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
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onloadend = async () => {
      const base64String = (reader.result as string).split(',')[1];
      try {
        const prompts = {
          bullets: "bullet points",
          paragraph: "paragraph",
          email: "formal email"
        };
        const model = ai.getGenerativeModel({ model: 'gemini-2.0-flash' });
        const result = await model.generateContentStream([
          { inlineData: { mimeType: blob.type || 'audio/webm', data: base64String } },
          { text: "Clean this audio. Format as: " + prompts[format as keyof typeof prompts] + ". Preserve SAP FICO, Vibe Coding, Raga, Kadugu, Perungayam." }
        ]);
        setIsProcessing(false);
        let fullText = '';
        for await (const chunk of result.stream) {
          fullText += chunk.text();
          setTranscript(fullText);
        }
      } catch (err) {
        setError('Error processing audio.');
        setIsProcessing(false);
      }
    };
  };

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(transcript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl p-8 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-800">Vibe Dictation</h1>
          <div className="flex gap-2">
            <select value={format} onChange={(e) => setFormat(e.target.value)} className="bg-slate-100 rounded-lg px-3 py-1 text-sm outline-none">
              <option value="bullets">Bullets</option>
              <option value="paragraph">Paragraph</option>
              <option value="email">Email</option>
            </select>
            <button onClick={handleRefresh} className="p-2 hover:bg-slate-100 rounded-full">
              <RotateCcw className="w-5 h-5 text-slate-500" />
            </button>
          </div>
        </div>
        <div className="relative h-64 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 p-4 overflow-auto">
          {transcript ? (
            <div className="prose prose-slate max-w-none">
              {transcript.split('\n').map((line, i) => <p key={i}>{line}</p>)}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-400">
              {isProcessing ? <Loader2 className="w-8 h-8 animate-spin" /> : "Start speaking..."}
            </div>
          )}
        </div>
        <div className="flex items-center justify-center gap-4">
          {!isRecording ? (
            <button onClick={startRecording} className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-full">
              <Mic className="w-5 h-5" /> Start Recording
            </button>
          ) : (
            <button onClick={stopRecording} className="flex items-center gap-2 bg-red-600 text-white px-6 py-3 rounded-full animate-pulse">
              <Square className="w-5 h-5" /> Stop Recording
            </button>
          )}
          {transcript && (
            <button onClick={copyToClipboard} className="flex items-center gap-2 bg-slate-800 text-white px-6 py-3 rounded-full">
              {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
              {copied ? 'Copied!' : 'Copy Text'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}