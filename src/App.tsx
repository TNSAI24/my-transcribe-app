import { useState, useRef } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import './App.css';

// 1. Initialize the AI with your exact environment variable
const ai = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY || '');

function App() {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  
  // NEW: State to hold and display errors
  const [errorMessage, setErrorMessage] = useState('');
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      setErrorMessage(''); // Clear previous errors when starting a new recording
      setTranscript('');
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
        setIsProcessing(true);
        try {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          await processAudioWithGemini(audioBlob);
        } catch (error: any) {
          console.error("Processing Error:", error);
          setErrorMessage(error.message || "An error occurred while processing the audio.");
        } finally {
          setIsProcessing(false);
          stream.getTracks().forEach(track => track.stop());
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error: any) {
      console.error("Microphone Error:", error);
      setErrorMessage("Could not access the microphone. Please check your permissions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const processAudioWithGemini = async (audioBlob: Blob) => {
    const reader = new FileReader();
    reader.readAsDataURL(audioBlob);
    
    reader.onloadend = async () => {
      const base64Audio = reader.result as string;
      const base64Data = base64Audio.split(',')[1];

      // NEW: The Safety Net (try...catch block)
      try {
        const model = ai.getGenerativeModel({
          model: 'gemini-2.0-flash',
          systemInstruction: "You are a highly accurate dictation assistant. Carefully transcribe the user's speech. Pay special attention to technical and specific terms like SAP FICO, Vibe Coding, Kadugu, and Perungayam."
        });

        const result = await model.generateContent([
          {
            inlineData: {
              mimeType: audioBlob.type,
              data: base64Data
            }
          },
          "Please transcribe this audio accurately."
        ]);

        setTranscript(result.response.text());
        
      } catch (error: any) {
        console.error("Gemini API Error:", error);
        // If Google rejects the request, we catch it here and display it on the screen!
        setErrorMessage(`Google AI Error: ${error.message}`);
      }
    };
  };

  return (
    <div className="container" style={{ maxWidth: '600px', margin: '0 auto', padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>Vibe Dictation</h1>
      
      {/* NEW: The Error Display Box */}
      {errorMessage && (
        <div style={{ backgroundColor: '#ffebee', color: '#c62828', padding: '15px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #ef9a9a' }}>
          <strong>Error Caught:</strong> {errorMessage}
        </div>
      )}

      <div className="controls" style={{ marginBottom: '20px' }}>
        {!isRecording ? (
          <button onClick={startRecording} disabled={isProcessing} style={{ padding: '10px 20px', fontSize: '16px', cursor: 'pointer', borderRadius: '5px', backgroundColor: '#e0e0e0', border: 'none' }}>
            {isProcessing ? 'Processing Audio...' : 'Start Recording'}
          </button>
        ) : (
          <button onClick={stopRecording} style={{ padding: '10px 20px', fontSize: '16px', backgroundColor: '#d32f2f', color: 'white', cursor: 'pointer', borderRadius: '5px', border: 'none' }}>
            Stop Recording
          </button>
        )}
      </div>

      <div className="output-area" style={{ padding: '20px', border: '1px solid #ccc', borderRadius: '8px', minHeight: '150px', whiteSpace: 'pre-wrap', backgroundColor: '#f9f9f9' }}>
        {transcript || <span style={{ color: '#888' }}>Your transcription will appear here...</span>}
      </div>
    </div>
  );
}

export default App;
