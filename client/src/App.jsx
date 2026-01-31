import React, { useState } from 'react';
import { useInterview } from './hooks/useInterview';
import ChatBubble from './components/ChatBubble';
import StatusIndicator from './components/StatusIndicator';
import ErrorDisplay from './components/ErrorDisplay';
import InterviewSetup from './components/InterviewSetup';
import './App.css';

function App() {
  const { status, messages, isRecording, error, start, stop, exportTranscript } = useInterview();
  const [showSetup, setShowSetup] = useState(true);

  const handleStartInterview = (config) => {
    setShowSetup(false);
    start(config);
  };

  const handleStop = () => {
    if (window.confirm('Are you sure you want to stop the interview?')) {
      stop();
      setShowSetup(true);
    }
  };

  if (showSetup) {
    return <InterviewSetup onStart={handleStartInterview} />;
  }

  return (
    <div className="app">
      <header className="header">
        <h1>
          <span style={{ fontSize: '1.5rem' }} role="img" aria-label="microphone">🎙️</span>
          Interview Simulator
        </h1>
        <StatusIndicator status={status} />
      </header>

      <main className="main-container">
        {error && <ErrorDisplay error={error} />}

        <div id="transcript" role="log" aria-live="polite" aria-label="Interview transcript">
          {messages.map((msg) => (
            <ChatBubble key={msg.id} message={msg} />
          ))}
        </div>
      </main>

      <footer className="controls">
        <button
          id="btnStop"
          onClick={handleStop}
          disabled={!isRecording}
          aria-label="Stop interview session"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <rect x="6" y="4" width="4" height="16"></rect>
            <rect x="14" y="4" width="4" height="16"></rect>
          </svg>
          Stop
        </button>

        {messages.length > 1 && (
          <button
            id="btnExport"
            onClick={exportTranscript}
            disabled={isRecording}
            aria-label="Export interview transcript"
            className="btn-secondary"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            Export
          </button>
        )}
      </footer>
    </div>
  );
}

export default App;