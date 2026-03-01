import React, { useState, useRef } from 'react';
import { Mic, Square, Copy, Check, Loader2 } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';

// Initialize Gemini API
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export default function App() {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      setError('');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await processAudio(audioBlob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Error accessing microphone:', err);
      setError('Could not access microphone. Please ensure permissions are granted.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const processAudio = async (blob: Blob) => {
    setIsProcessing(true);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        const base64data = reader.result as string;
        const base64String = base64data.split(',')[1];

        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: [
            {
              parts: [
                {
                  inlineData: {
                    mimeType: blob.type || 'audio/webm',
                    data: base64String,
                  },
                },
                {
                  text: `Transcribe the provided audio and instantly clean the text. 
Remove stutters, filler words, and fix grammar. 
Format the output as clear bullet points.
CRITICAL: You must preserve the following specific technical and regional terms without trying to 'correct' them: SAP FICO, Vibe Coding, Raga, Kadugu, Perungayam.
CRITICAL: Output ONLY the final bulleted list. Do not include any introductory phrases, greetings, or concluding remarks. Provide absolutely zero conversational filler.`,
                },
              ],
            },
          ],
        });

        setTranscript(response.text || '');
        setIsProcessing(false);
      };
    } catch (err) {
      console.error('Error processing audio:', err);
      setError('Failed to process audio. Please try again.');
      setIsProcessing(false);
    }
  };

  const copyToClipboard = async () => {
    if (!transcript) return;
    try {
      await navigator.clipboard.writeText(transcript);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 flex flex-col items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-3xl flex flex-col gap-6">
        {/* Header - hidden on small screens */}
        <div className="hidden sm:block text-center space-y-2 mb-4">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Dictation & Cleanup</h1>
          <p className="text-zinc-500">
            Record your audio. We'll transcribe, clean up stutters, and format it into bullet points.
          </p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100 text-sm">
            {error}
          </div>
        )}

        {/* Main Controls */}
        <div className="flex flex-col items-center gap-4">
          {!isRecording ? (
            <button
              onClick={startRecording}
              disabled={isProcessing}
              className="flex items-center justify-center gap-3 w-full sm:w-auto px-8 py-5 sm:py-4 bg-zinc-900 hover:bg-zinc-800 text-white rounded-2xl sm:rounded-full font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md text-lg sm:text-base"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-6 h-6 sm:w-5 sm:h-5 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Mic className="w-6 h-6 sm:w-5 sm:h-5" />
                  Start Dictation
                </>
              )}
            </button>
          ) : (
            <button
              onClick={stopRecording}
              className="flex items-center justify-center gap-3 w-full sm:w-auto px-8 py-5 sm:py-4 bg-red-500 hover:bg-red-600 text-white rounded-2xl sm:rounded-full font-medium transition-all shadow-md animate-pulse text-lg sm:text-base"
            >
              <Square className="w-6 h-6 sm:w-5 sm:h-5 fill-current" />
              Stop Dictation
            </button>
          )}
        </div>

        {/* Transcript Area */}
        {(transcript || isProcessing) && (
          <div className="flex flex-col gap-4 w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="relative bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm min-h-[200px] sm:min-h-[300px]">
              {isProcessing ? (
                <div className="absolute inset-0 flex items-center justify-center text-zinc-400">
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 animate-spin" />
                    <span className="text-sm font-medium">Cleaning and formatting...</span>
                  </div>
                </div>
              ) : (
                <div className="prose prose-zinc max-w-none">
                  <div className="whitespace-pre-wrap font-sans text-zinc-800 leading-relaxed text-base sm:text-lg">
                    {transcript}
                  </div>
                </div>
              )}
            </div>

            {/* Copy Button */}
            {transcript && !isProcessing && (
              <button
                onClick={copyToClipboard}
                className="flex items-center justify-center gap-2 w-full px-6 py-4 sm:py-3 bg-zinc-900 sm:bg-white sm:border sm:border-zinc-200 sm:hover:bg-zinc-50 text-white sm:text-zinc-700 rounded-2xl sm:rounded-xl font-medium transition-colors shadow-md sm:shadow-sm text-lg sm:text-base"
              >
                {copied ? (
                  <>
                    <Check className="w-6 h-6 sm:w-5 sm:h-5 sm:text-emerald-500" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-6 h-6 sm:w-5 sm:h-5" />
                    Copy to Clipboard
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
