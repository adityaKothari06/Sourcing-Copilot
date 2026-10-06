'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  Tractor, 
  Sparkles, 
  Search, 
  Copy, 
  Check, 
  ExternalLink, 
  ThumbsUp, 
  ThumbsDown, 
  Mic, 
  MicOff, 
  History, 
  RotateCcw, 
  Briefcase, 
  MapPin, 
  Layers, 
  Building2, 
  Send, 
  MessageSquare, 
  CheckCircle2, 
  AlertCircle,
  HelpCircle,
  ChevronRight,
  Trash2,
  Languages
} from 'lucide-react';
import { SourcingPosition, PortalType, KeywordItem } from '@/lib/types';
import { devanagariToHinglish, containsDevanagari } from '@/lib/transliterate';

const SAMPLE_SCENARIOS = [
  {
    label: 'Rotavator & Tillage ASM (Maharashtra)',
    text: 'Client ko Maharashtra territory ke liye Area Sales Manager chahiye for Rotavator, MB Plough aur active tillage implements. 5 se 8 saal ka experience mandatory hai. Candidates Shaktiman, Lemken, Fieldking ya Mahindra background se hone chahiye. Dealer network expansion aur secondary sales dekhna hoga.',
  },
  {
    label: 'Harvester & Baler Service Head (Punjab)',
    text: 'Urgent requirement for Zonal Service Manager in Punjab and Haryana. Minimum 8-10 years experience handling combine harvesters, straw reapers, and round balers. Candidate must manage dealer service technicians, warranty claims, and field breakdown camps.',
  },
  {
    label: 'Power Tiller & Subsidy Manager (South India)',
    text: 'Looking for Territory Manager for Power Tillers and Weeders in Karnataka and Andhra Pradesh. 4-6 years experience in rural retail channel and SMAM / DBT government subsidy documentation. Candidates from VST Tillers, Honda Power, or local implement dealers preferred.',
  },
];

export default function SourcingCopilotPage() {
  const [inputText, setInputText] = useState('');
  const [inputType, setInputType] = useState<'text' | 'voice' | 'jd'>('text');
  const [loading, setLoading] = useState(false);
  const [activePosition, setActivePosition] = useState<SourcingPosition | null>(null);
  const [history, setHistory] = useState<SourcingPosition[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [activeTab, setActiveTab] = useState<PortalType>('naukri');
  const [candidatePoolMode, setCandidatePoolMode] = useState<'all' | 'ex_employees' | 'freshers'>('all');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [feedbackNotification, setFeedbackNotification] = useState<string | null>(null);

  // Voice recording & transcription state
  const [isRecording, setIsRecording] = useState(false);
  const [speechOutputMode, setSpeechOutputMode] = useState<'hinglish' | 'english' | 'hindi'>('hinglish');
  const [isTransliterating, setIsTransliterating] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const baseTextRef = useRef('');
  const latestTextRef = useRef('');

  // Remove accidental speech engine phrase repetition / stutter
  const cleanDuplicatedPhrases = (text: string): string => {
    if (!text) return '';
    // Collapse immediate duplicate single words: "Candidate Candidate" -> "Candidate"
    let cleaned = text.replace(/\b(\w+)(?:\s+\1\b)+/gi, '$1');
    // Collapse repeated 2-6 word sequences (e.g. "Candidate chahiye Candidate chahiye")
    cleaned = cleaned.replace(/\b((?:[\w\d.-]+\s+){1,5}[\w\d.-]+)\s+\1\b/gi, '$1');
    return cleaned;
  };

  // Filter for keyword matrix
  const [keywordCategoryFilter, setKeywordCategoryFilter] = useState<string>('all');

  // Load history on mount
  useEffect(() => {
    fetchHistory();
  }, []);

  async function fetchHistory() {
    try {
      const res = await fetch('/api/positions');
      const data = await res.json();
      if (data?.positions) {
        setHistory(data.positions);
        if (!activePosition && data.positions.length > 0) {
          setActivePosition(data.positions[0]);
        }
      }
    } catch (e) {
      console.error('Failed to load past positions:', e);
    }
  }

  // Handle explicit transliteration / translation of text
  const handleTransliterateText = async (
    targetMode: 'hinglish' | 'english' = 'hinglish',
    explicitText?: string
  ) => {
    const textToProcess = (explicitText !== undefined ? explicitText : latestTextRef.current || inputText).trim();
    if (!textToProcess) return;
    setIsTransliterating(true);
    try {
      const res = await fetch('/api/transliterate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: textToProcess, target: targetMode }),
      });
      const data = await res.json();
      if (data?.text) {
        setInputText(data.text);
        latestTextRef.current = data.text;
        notifyFeedback(
          targetMode === 'english'
            ? '🌐 Translated to English!'
            : '✨ Converted to Roman Hinglish!'
        );
      }
    } catch (err) {
      console.warn('Transliterate API failed, using client engine:', err);
      const fallbackConverted = devanagariToHinglish(textToProcess);
      setInputText(fallbackConverted);
      latestTextRef.current = fallbackConverted;
      notifyFeedback('✨ Converted to Hinglish!');
    } finally {
      setIsTransliterating(false);
    }
  };

  // Voice recognition setup with permission handling & de-duplication
  const toggleRecording = async () => {
    if (isRecording) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // ignore
        }
      }
      setIsRecording(false);
      return;
    }

    // Check browser speech recognition
    const windowWithSpeech = window as unknown as {
      webkitSpeechRecognition?: any;
      SpeechRecognition?: any;
    };
    const SpeechRecognition = windowWithSpeech.SpeechRecognition || windowWithSpeech.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser. You can type or paste your notes directly.');
      return;
    }

    // Explicitly request microphone permission from browser first
    if (navigator?.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // Release tracks so SpeechRecognition has full exclusive access
        stream.getTracks().forEach((track) => track.stop());
      } catch (err: any) {
        if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
          alert(
            'Microphone access was blocked by your browser.\n\n' +
            'How to enable:\n' +
            '1. Click the lock/settings icon 🔒 (or camera/mic icon) in the browser address bar next to http://localhost:3001\n' +
            '2. Change Microphone to "Allow"\n' +
            '3. Click "Voice Dictate" again.\n\n' +
            'You can also type or paste your notes directly into the text box!'
          );
          setIsRecording(false);
          return;
        }
      }
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      // hi-IN recognizes Indian accents, Hindi, and mixed Hinglish terms
      recognition.lang = 'hi-IN';

      // Capture pre-existing text so new speech appends cleanly without overwriting or duplicating
      const existing = (latestTextRef.current || inputText).trim();
      baseTextRef.current = existing ? `${existing} ` : '';
      latestTextRef.current = existing;

      recognition.onstart = () => {
        setIsRecording(true);
        setInputType('voice');
      };

      // FIXED: Build session transcript locally from event.results on each tick.
      // This eliminates the Mobile Chrome/Android bug where resultIndex resets to 0 and duplicates prior words!
      recognition.onresult = (event: any) => {
        let sessionFinal = '';
        let sessionInterim = '';

        for (let i = 0; i < event.results.length; i++) {
          const res = event.results[i];
          const part = res[0]?.transcript || '';
          if (res.isFinal) {
            sessionFinal += (sessionFinal ? ' ' : '') + part.trim();
          } else {
            sessionInterim += (sessionInterim ? ' ' : '') + part.trim();
          }
        }

        const rawSpokenSentence = (sessionFinal + (sessionInterim ? ' ' + sessionInterim : '')).trim();
        const deduplicatedSentence = cleanDuplicatedPhrases(rawSpokenSentence);

        // If user wants Hinglish, convert Devanagari in real-time
        const formattedSentence =
          speechOutputMode === 'hinglish'
            ? devanagariToHinglish(deduplicatedSentence)
            : deduplicatedSentence;

        const newText = (baseTextRef.current + formattedSentence).trim();
        latestTextRef.current = newText;
        setInputText(newText);
      };

      recognition.onerror = (event: any) => {
        if (event.error === 'no-speech' || event.error === 'aborted') {
          return; // Ignore silence or aborts
        }
        console.warn('Speech recognition status:', event.error);
        setIsRecording(false);

        if (event.error === 'not-allowed') {
          alert(
            'Microphone access is not allowed.\n\n' +
            'Please click the lock 🔒 icon in your browser address bar next to http://localhost:3001 and set Microphone to "Allow".'
          );
        }
      };

      recognition.onend = () => {
        setIsRecording(false);
        const currentText = latestTextRef.current.trim();
        // Polish Hinglish or English output when dictation concludes
        if (currentText && (speechOutputMode === 'hinglish' || speechOutputMode === 'english')) {
          handleTransliterateText(speechOutputMode, currentText);
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error('Failed to start speech recognition:', err);
      setIsRecording(false);
    }
  };

  const handleGenerate = async () => {
    if (!inputText.trim()) {
      alert('Please enter or dictate a job brief, spoken note, or JD.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: inputText, inputType }),
      });

      const data = await res.json();
      if (data?.position) {
        setActivePosition(data.position);
        setHistory((prev) => [data.position, ...prev]);
        notifyFeedback('Search strategy generated with multi-portal queries!');
      } else {
        alert(data?.error || 'Failed to generate queries');
      }
    } catch (e: any) {
      console.error(e);
      alert('An error occurred during query generation');
    } finally {
      setLoading(false);
    }
  };

  const handleVoteKeyword = async (keyword: KeywordItem, vote: 'up' | 'down') => {
    if (!activePosition) return;

    try {
      // Optimistic UI update
      setActivePosition((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          keywords: prev.keywords.map((k) => {
            if (k.id === keyword.id) {
              return {
                ...k,
                userRating: vote,
                upvotes: vote === 'up' ? k.upvotes + 1 : k.upvotes,
                downvotes: vote === 'down' ? k.downvotes + 1 : k.downvotes,
              };
            }
            return k;
          }),
        };
      });

      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          positionId: activePosition.id,
          keywordText: keyword.text,
          category: keyword.category,
          portal: activeTab,
          vote,
        }),
      });

      if (res.ok) {
        notifyFeedback(
          vote === 'up'
            ? `👍 Marked "${keyword.text}" as effective for ${activeTab.toUpperCase()}`
            : `👎 Marked "${keyword.text}" as ineffective/noisy`
        );
      }
    } catch (e) {
      console.error('Failed to submit keyword vote', e);
    }
  };

  const handleRateSearch = async (rating: 'excellent' | 'moderate' | 'poor') => {
    if (!activePosition) return;

    try {
      setActivePosition((prev) => (prev ? { ...prev, searchRating: rating } : null));
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'rate_search',
          positionId: activePosition.id,
          rating,
        }),
      });

      notifyFeedback('Thank you! Search performance recorded.');
    } catch (e) {
      console.error(e);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const notifyFeedback = (msg: string) => {
    setFeedbackNotification(msg);
    setTimeout(() => setFeedbackNotification(null), 3500);
  };

  const handleDeletePosition = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to remove this position from history?')) return;
    try {
      await fetch(`/api/positions?id=${id}`, { method: 'DELETE' });
      setHistory((prev) => prev.filter((p) => p.id !== id));
      if (activePosition?.id === id) {
        setActivePosition(history.find((p) => p.id !== id) || null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filteredKeywords = activePosition?.keywords.filter((kw) => {
    if (keywordCategoryFilter === 'all') return true;
    return kw.category === keywordCategoryFilter;
  }) || [];

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans">
      {/* Toast Notification */}
      {feedbackNotification && (
        <div className="fixed top-5 right-5 z-50 bg-emerald-600 text-white px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2 text-sm font-semibold animate-in fade-in slide-in-from-top-3">
          <CheckCircle2 className="w-4 h-4" />
          <span>{feedbackNotification}</span>
        </div>
      )}

      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-40 px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-orange-600 to-red-600 flex items-center justify-center shadow-lg shadow-orange-500/20">
            <Tractor className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-white tracking-tight">Sourcing Copilot</span>
              <span className="text-[10px] bg-amber-500/20 text-amber-300 font-bold px-2 py-0.5 rounded-md border border-amber-500/30 uppercase tracking-wider">
                Autonomous Sourcing Service
              </span>
            </div>
            <p className="text-xs text-slate-400">Tractor & Farm Implements Talent Intelligence Engine</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700"
          >
            <History className="w-3.5 h-3.5" />
            <span>History ({history.length})</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Input Form (4 cols on lg) */}
        <div className="lg:col-span-5 space-y-5">
          <div className="bg-slate-800/70 border border-slate-700/80 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>Position Intake</span>
              </h2>
              <div className="flex items-center gap-1 bg-slate-900/80 p-0.5 rounded-lg border border-slate-700 text-[11px]">
                <button
                  type="button"
                  onClick={() => setInputType('text')}
                  className={`px-2 py-0.5 rounded font-medium transition-colors ${
                    inputType === 'text' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Quick Brief
                </button>
                <button
                  type="button"
                  onClick={() => setInputType('jd')}
                  className={`px-2 py-0.5 rounded font-medium transition-colors ${
                    inputType === 'jd' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Full JD
                </button>
              </div>
            </div>

            <p className="text-xs text-slate-400 mb-3 leading-relaxed">
              Dictate spoken notes in Hindi/Hinglish, paste a WhatsApp brief, or paste a client JD. The engine deconstructs domain equipment, competitors, and alternative titles.
            </p>

            {/* Speaking & Output Mode Selector */}
            <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Voice Output Mode:
              </span>
              <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-700/80">
                <button
                  type="button"
                  onClick={() => setSpeechOutputMode('hinglish')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                    speechOutputMode === 'hinglish'
                      ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Speak Hindi -> Get clean Roman Hinglish"
                >
                  🗣️ Hindi ➔ Hinglish
                </button>
                <button
                  type="button"
                  onClick={() => setSpeechOutputMode('english')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                    speechOutputMode === 'english'
                      ? 'bg-blue-600 text-white font-bold shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Speak Hindi -> Auto-translate to English"
                >
                  🌐 English
                </button>
                <button
                  type="button"
                  onClick={() => setSpeechOutputMode('hindi')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                    speechOutputMode === 'hindi'
                      ? 'bg-slate-700 text-white font-bold shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Keep original Devanagari Hindi"
                >
                  🇮🇳 Hindi
                </button>
              </div>
            </div>

            {/* Input Text Area */}
            <div className="relative">
              <textarea
                value={inputText}
                onChange={(e) => {
                  setInputText(e.target.value);
                  latestTextRef.current = e.target.value;
                }}
                placeholder="Speak or paste here... E.g. 'Client ko Maharashtra ke liye Area Sales Manager chahiye, 5-8 yrs, Rotavator & MB Plough background from Shaktiman or Lemken...'"
                rows={6}
                className="w-full bg-slate-900/90 border border-slate-700 rounded-xl p-3.5 pb-12 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all resize-y"
              />

              {/* Bottom Actions Floating Inside Textarea */}
              <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between pointer-events-none">
                <div className="flex items-center gap-1.5 pointer-events-auto">
                  {/* 1-Click Convert to Hinglish if Hindi Devanagari is present */}
                  {containsDevanagari(inputText) && (
                    <button
                      type="button"
                      onClick={() => handleTransliterateText('hinglish')}
                      disabled={isTransliterating}
                      className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-xs animate-pulse"
                      title="Convert Hindi Devanagari text to Roman Hinglish"
                    >
                      <Sparkles className="w-3 h-3 text-amber-400" />
                      <span>{isTransliterating ? 'Converting...' : '✨ Convert to Hinglish'}</span>
                    </button>
                  )}

                  {inputText.trim() && (
                    <button
                      type="button"
                      onClick={() => {
                        setInputText('');
                        latestTextRef.current = '';
                      }}
                      className="p-1.5 rounded-lg bg-slate-800/90 hover:bg-red-950/80 text-slate-400 hover:text-red-400 border border-slate-700 text-xs transition-colors cursor-pointer"
                      title="Clear text"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Voice Dictate Button */}
                <div className="pointer-events-auto">
                  <button
                    type="button"
                    onClick={toggleRecording}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                      isRecording
                        ? 'bg-red-600 text-white animate-pulse shadow-lg shadow-red-600/40'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 shadow-xs'
                    }`}
                    title={isRecording ? 'Click to stop dictation' : 'Click to dictate (No repeated words!)'}
                  >
                    {isRecording ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5 text-amber-400" />}
                    <span>{isRecording ? 'Listening (Tap to stop)...' : 'Voice Dictate'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Load Example Scenarios */}
            <div className="mt-3.5">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Quick Test Templates:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {SAMPLE_SCENARIOS.map((sc, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setInputText(sc.text);
                      latestTextRef.current = sc.text;
                      setInputType('text');
                    }}
                    className="text-[11px] text-left px-2.5 py-1 rounded-lg bg-slate-900/80 hover:bg-slate-700 border border-slate-700/60 text-slate-300 transition-colors"
                  >
                    ⚡ {sc.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Submit Button */}
            <div className="mt-5">
              <button
                type="button"
                onClick={handleGenerate}
                disabled={loading}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-orange-500/25 transition-all disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                    <span>Analyzing Domain & Building Queries...</span>
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4 text-slate-950" />
                    <span>Generate Multi-Portal Sourcing Strategy</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Sourcing Best Practices Card */}
          <div className="bg-slate-800/40 border border-slate-800 rounded-2xl p-4 text-xs text-slate-400 space-y-2">
            <div className="flex items-center gap-2 text-slate-300 font-semibold">
              <HelpCircle className="w-4 h-4 text-amber-400" />
              <span>How This Solves Zero/Vague Search Results</span>
            </div>
            <p>
              • <strong>Portal Jargon:</strong> Candidates from Shaktiman or Fieldking may not write &quot;ASM&quot;; they might use &quot;Territory Incharge&quot; or &quot;Area Manager&quot;. The Copilot auto-injects all known Indian agricultural designations.
            </p>
            <p>
              • <strong>Free Google X-Ray:</strong> You don&apos;t need expensive LinkedIn licenses. The generated X-Ray query finds candidates publicly indexed on Google.
            </p>
          </div>
        </div>

        {/* Right Column: Sourcing Strategy & Portal Strings (7 cols on lg) */}
        <div className="lg:col-span-7 space-y-5">
          {loading ? (
            <div className="bg-slate-800/90 border border-amber-500/30 rounded-2xl p-8 text-center space-y-4 shadow-lg animate-pulse">
              <div className="inline-flex p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                <Tractor className="w-8 h-8 animate-bounce" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-bold text-white">Synthesizing Domain Requirements...</h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Extracting target equipment, competitor OEMs, regional hubs, and generating Boolean queries for Naukri, LinkedIn, and Google X-Ray.
                </p>
              </div>
            </div>
          ) : activePosition ? (
            <>
              {/* Role Intelligence Summary Banner */}
              <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-slate-700/80">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 bg-amber-400/10 px-2.5 py-0.5 rounded-full border border-amber-400/20">
                      Requisition Identified
                    </span>
                    <h1 className="text-xl font-black text-white mt-1">
                      {activePosition.parsed.title}
                    </h1>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs bg-slate-900 px-3 py-1 rounded-lg border border-slate-700 text-slate-300 font-medium">
                      🎯 {(() => {
                        const min = Math.min(activePosition.parsed.experienceYears.min, activePosition.parsed.experienceYears.max);
                        const max = Math.max(activePosition.parsed.experienceYears.min, activePosition.parsed.experienceYears.max);
                        return min === max ? `${min}+ Years Exp` : `${min}-${max} Years Exp`;
                      })()}
                    </span>
                    {activePosition.parsed.locations.length > 0 && (
                      <span className="text-xs bg-slate-900 px-3 py-1 rounded-lg border border-slate-700 text-slate-300 font-medium flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-red-400" />
                        {activePosition.parsed.locations.slice(0, 3).join(', ')}
                      </span>
                    )}
                    {activePosition.parsed.qualification && (
                      <span className="text-xs bg-slate-900 px-3 py-1 rounded-lg border border-slate-700 text-amber-300 font-medium flex items-center gap-1">
                        🎓 {activePosition.parsed.qualification}
                      </span>
                    )}
                    <span className="text-xs bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-700 text-slate-400 font-medium capitalize">
                      💼 {activePosition.parsed.seniorityLevel} Level
                    </span>
                  </div>
                </div>

                {/* Key Attributes Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 text-xs">
                  {/* Equipment Focus */}
                  <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-700/60 space-y-2">
                    <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                      <Layers className="w-3.5 h-3.5 text-blue-400" />
                      Target Equipment / Implements Focus:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {activePosition.parsed.equipmentFocus.map((eq, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded-md bg-blue-950/70 border border-blue-800/50 text-blue-200 text-[11px] font-medium"
                        >
                          {eq}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Competitor OEMs */}
                  <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-700/60 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5 text-emerald-400" />
                        Target Competitor OEMs to Poach:
                      </span>
                      <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800/40">
                        {activePosition.parsed.targetCompanies.length} Indian OEMs
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                      {activePosition.parsed.targetCompanies.map((comp, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded-md bg-emerald-950/70 border border-emerald-800/50 text-emerald-200 text-[11px] font-medium"
                        >
                          {comp}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Alternative Designations Targeted */}
                {activePosition.parsed.standardTitles.length > 0 && (
                  <div className="bg-slate-900/40 p-2.5 rounded-xl border border-slate-700/40 text-xs space-y-1.5">
                    <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                      <Briefcase className="w-3.5 h-3.5 text-amber-400" />
                      Alternative Job Titles Included in Search:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {activePosition.parsed.standardTitles.map((st, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-slate-300 text-[11px]"
                        >
                          {st}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Multi-Portal Query Generator Station */}
              <div className="bg-slate-800/90 border border-slate-700 rounded-2xl overflow-hidden shadow-sm">
                {/* Tabs Bar */}
                <div className="flex border-b border-slate-700 bg-slate-900/70 p-1.5 gap-1.5 overflow-x-auto">
                  <button
                    onClick={() => setActiveTab('naukri')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                      activeTab === 'naukri'
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    <span>Naukri Resdex</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('google_xray')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                      activeTab === 'google_xray'
                        ? 'bg-amber-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    <span>Google X-Ray (Free CVs)</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('linkedin')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                      activeTab === 'linkedin'
                        ? 'bg-indigo-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    <span>LinkedIn Search</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('referral')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                      activeTab === 'referral'
                        ? 'bg-emerald-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    <span>WhatsApp / Referral</span>
                  </button>
                </div>

                {/* Sourcing Candidate Pool Filter Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2.5 px-5 py-3 bg-slate-900/90 border-b border-slate-700/80">
                  <div className="flex items-center gap-1.5 text-xs text-slate-300 font-semibold">
                    <span>Target Candidate Pool:</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setCandidatePoolMode('all')}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        candidatePoolMode === 'all'
                          ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                          : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700/60'
                      }`}
                    >
                      🎯 All Lateral / Employed
                    </button>
                    <button
                      type="button"
                      onClick={() => setCandidatePoolMode('ex_employees')}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        candidatePoolMode === 'ex_employees'
                          ? 'bg-emerald-500 text-slate-950 font-bold shadow-xs'
                          : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700/60'
                      }`}
                      title="Candidates who left their job, serving notice period, or immediate joiners"
                    >
                      ⚡ Left Job / Notice Period
                    </button>
                    <button
                      type="button"
                      onClick={() => setCandidatePoolMode('freshers')}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        candidatePoolMode === 'freshers'
                          ? 'bg-indigo-500 text-white font-bold shadow-xs'
                          : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700/60'
                      }`}
                      title="Freshers, GET, MT, and Trainee engineers"
                    >
                      🌱 Freshers & Trainees
                    </button>
                  </div>
                </div>

                {/* Tab Content Panels */}
                <div className="p-5">
                  {/* NAUKRI TAB */}
                  {activeTab === 'naukri' && (() => {
                    const activeNaukriQuery = candidatePoolMode === 'ex_employees'
                      ? (activePosition.queries.naukri.exEmployeeQuery || activePosition.queries.naukri.booleanQuery)
                      : candidatePoolMode === 'freshers'
                      ? (activePosition.queries.naukri.fresherQuery || activePosition.queries.naukri.booleanQuery)
                      : activePosition.queries.naukri.booleanQuery;

                    return (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-bold text-white">Naukri Resdex Boolean Query</h3>
                              {candidatePoolMode === 'ex_employees' && (
                                <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800/60 px-2 py-0.5 rounded font-semibold">
                                  ⚡ Left Job / Immediate Joiners
                                </span>
                              )}
                              {candidatePoolMode === 'freshers' && (
                                <span className="text-[10px] bg-indigo-950 text-indigo-300 border border-indigo-800/60 px-2 py-0.5 rounded font-semibold">
                                  🌱 Freshers & Trainees
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-400">Copy and paste directly into Naukri Keywords search box</p>
                          </div>
                          <button
                            onClick={() => copyToClipboard(activeNaukriQuery, 'naukri_bool')}
                            className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            {copiedKey === 'naukri_bool' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                            <span>{copiedKey === 'naukri_bool' ? 'Copied!' : 'Copy Boolean'}</span>
                          </button>
                        </div>

                        <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-700 font-mono text-xs text-blue-200 leading-relaxed break-all select-all">
                          {activeNaukriQuery}
                        </div>

                        {/* Sub-fields for Resdex filters */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                          <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-700/70">
                            <div className="flex justify-between items-center mb-1">
                              <span className="font-semibold text-slate-300">Designation Filter:</span>
                              <button
                                onClick={() => copyToClipboard(activePosition.queries.naukri.designationSearch, 'naukri_desig')}
                                className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1"
                              >
                                {copiedKey === 'naukri_desig' ? 'Copied' : 'Copy'}
                              </button>
                            </div>
                            <p className="font-mono text-slate-400">{activePosition.queries.naukri.designationSearch}</p>
                          </div>

                          <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-700/70">
                            <div className="flex justify-between items-center mb-1">
                              <span className="font-semibold text-slate-300">Exclude Keywords (NOT):</span>
                              <button
                                onClick={() => copyToClipboard(activePosition.queries.naukri.excludeTerms.join(' OR '), 'naukri_excl')}
                                className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1"
                              >
                                {copiedKey === 'naukri_excl' ? 'Copied' : 'Copy'}
                              </button>
                            </div>
                            <p className="font-mono text-slate-400">{activePosition.queries.naukri.excludeTerms.join(', ')}</p>
                          </div>
                        </div>

                        <div className="pt-2 flex items-center justify-between">
                          <a
                            href="https://resdex.naukri.com/"
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 font-semibold"
                          >
                            <span>Open Naukri Resdex in new tab</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </div>
                    );
                  })()}

                  {/* GOOGLE X-RAY TAB */}
                  {activeTab === 'google_xray' && (() => {
                    const activeXrayQuery = candidatePoolMode === 'ex_employees'
                      ? (activePosition.queries.googleXray.exEmployeeQuery || activePosition.queries.googleXray.searchQuery)
                      : candidatePoolMode === 'freshers'
                      ? (activePosition.queries.googleXray.fresherQuery || activePosition.queries.googleXray.searchQuery)
                      : activePosition.queries.googleXray.searchQuery;

                    const activeXrayUrl = candidatePoolMode === 'ex_employees'
                      ? (activePosition.queries.googleXray.exEmployeeUrl || activePosition.queries.googleXray.directUrl)
                      : candidatePoolMode === 'freshers'
                      ? (activePosition.queries.googleXray.fresherUrl || activePosition.queries.googleXray.directUrl)
                      : activePosition.queries.googleXray.directUrl;

                    return (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-bold text-white">Google X-Ray Candidate Sourcing</h3>
                              {candidatePoolMode === 'ex_employees' && (
                                <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800/60 px-2 py-0.5 rounded font-semibold">
                                  ⚡ Ex-Employees & Left Job
                                </span>
                              )}
                              {candidatePoolMode === 'freshers' && (
                                <span className="text-[10px] bg-indigo-950 text-indigo-300 border border-indigo-800/60 px-2 py-0.5 rounded font-semibold">
                                  🌱 Freshers & Trainees
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-400">Zero cost. Discovers indexed candidate profiles across the open web.</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => copyToClipboard(activeXrayQuery, 'xray_query')}
                              className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                            >
                              {copiedKey === 'xray_query' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                              <span>{copiedKey === 'xray_query' ? 'Copied' : 'Copy Query'}</span>
                            </button>

                            <a
                              href={activeXrayUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-amber-500/20"
                            >
                              <span>Launch Google Search Now</span>
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        </div>

                        <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-700 font-mono text-xs text-amber-200 leading-relaxed break-all select-all">
                          {activeXrayQuery}
                        </div>

                        <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-700/60 text-xs text-slate-300">
                          💡 <strong>Pro Recruiter Tip:</strong> Clicking &quot;Launch Google Search Now&quot; searches Google specifically for candidate profiles in Indian Tractor & Implement OEMs. You can view their full experience and reach out on LinkedIn for free without needing a paid Recruiter license.
                        </div>
                      </div>
                    );
                  })()}

                  {/* LINKEDIN TAB */}
                  {activeTab === 'linkedin' && (() => {
                    const activeLiQuery = candidatePoolMode === 'ex_employees'
                      ? (activePosition.queries.linkedin.exEmployeeQuery || activePosition.queries.linkedin.booleanQuery)
                      : candidatePoolMode === 'freshers'
                      ? (activePosition.queries.linkedin.fresherQuery || activePosition.queries.linkedin.booleanQuery)
                      : activePosition.queries.linkedin.booleanQuery;

                    const activeLiUrl = candidatePoolMode === 'ex_employees'
                      ? (activePosition.queries.linkedin.exEmployeeSearchUrl || activePosition.queries.linkedin.searchUrl)
                      : candidatePoolMode === 'freshers'
                      ? (activePosition.queries.linkedin.fresherSearchUrl || activePosition.queries.linkedin.searchUrl)
                      : activePosition.queries.linkedin.searchUrl;

                    return (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-bold text-white">LinkedIn People Search</h3>
                              {candidatePoolMode === 'ex_employees' && (
                                <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800/60 px-2 py-0.5 rounded font-semibold">
                                  ⚡ Ex-Employees & Notice Period
                                </span>
                              )}
                              {candidatePoolMode === 'freshers' && (
                                <span className="text-[10px] bg-indigo-950 text-indigo-300 border border-indigo-800/60 px-2 py-0.5 rounded font-semibold">
                                  🌱 Freshers & Trainees
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-400">Targeted title, equipment, and OEM query for LinkedIn People search</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => copyToClipboard(activeLiQuery, 'li_query')}
                              className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                            >
                              {copiedKey === 'li_query' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                              <span>{copiedKey === 'li_query' ? 'Copied' : 'Copy'}</span>
                            </button>

                            <a
                              href={activeLiUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-indigo-600/20"
                            >
                              <span>Open in LinkedIn</span>
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        </div>

                        <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-700 font-mono text-xs text-indigo-200 leading-relaxed break-all select-all">
                          {activeLiQuery}
                        </div>
                      </div>
                    );
                  })()}

                  {/* REFERRAL / WHATSAPP TAB */}
                  {activeTab === 'referral' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-bold text-white">WhatsApp & Referral Network Outreach</h3>
                          <p className="text-xs text-slate-400">Quick template to broadcast to dealership owners and ex-candidates</p>
                        </div>
                        <button
                          onClick={() => copyToClipboard(activePosition.queries.referral.whatsappTemplate, 'wa_copy')}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          {copiedKey === 'wa_copy' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedKey === 'wa_copy' ? 'Copied Message' : 'Copy WhatsApp Text'}</span>
                        </button>
                      </div>

                      <pre className="bg-slate-950 p-3.5 rounded-xl border border-slate-700 font-sans text-xs text-emerald-200 whitespace-pre-wrap leading-relaxed">
                        {activePosition.queries.referral.whatsappTemplate}
                      </pre>
                    </div>
                  )}
                </div>
              </div>

              {/* KEYWORD FEEDBACK MATRIX (WHAT WORKED VS WHAT DIDN'T) */}
              <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-700">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <ThumbsUp className="w-4 h-4 text-emerald-400" />
                      <span>Keyword Feedback & Tuning Station</span>
                    </h3>
                    <p className="text-xs text-slate-400">
                      Rate which keywords produced quality profiles and which produced garbage. The system stores this to tune future searches!
                    </p>
                  </div>

                  {/* Category Filter Chips */}
                  <div className="flex flex-wrap items-center gap-1 text-[11px]">
                    {['all', 'equipment', 'company', 'role', 'skill', 'exclusion'].map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setKeywordCategoryFilter(cat)}
                        className={`px-2 py-0.5 rounded-md font-medium uppercase tracking-wider transition-colors cursor-pointer ${
                          keywordCategoryFilter === cat
                            ? 'bg-slate-200 text-slate-950 font-bold'
                            : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-700'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Keywords Grid with Interactive Upvote / Downvote */}
                <div className="flex flex-wrap gap-2">
                  {filteredKeywords.map((kw) => {
                    const isUpvoted = kw.userRating === 'up';
                    const isDownvoted = kw.userRating === 'down';

                    return (
                      <div
                        key={kw.id}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                          isUpvoted
                            ? 'bg-emerald-950/80 border-emerald-500 text-emerald-200 shadow-sm'
                            : isDownvoted
                            ? 'bg-red-950/80 border-red-500/80 text-red-300 opacity-60 line-through'
                            : 'bg-slate-900/90 border-slate-700 text-slate-200 hover:border-slate-600'
                        }`}
                      >
                        <span className="font-semibold">{kw.text}</span>
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider bg-slate-800 px-1 py-0.2 rounded">
                          {kw.category}
                        </span>

                        {/* Vote Buttons */}
                        <div className="flex items-center gap-1 ml-1 pl-1.5 border-l border-slate-700/60">
                          <button
                            type="button"
                            onClick={() => handleVoteKeyword(kw, 'up')}
                            className={`p-1 rounded hover:bg-slate-800 transition-colors cursor-pointer ${
                              isUpvoted ? 'text-emerald-400' : 'text-slate-400 hover:text-emerald-300'
                            }`}
                            title="Worked well / Yielded good candidates"
                          >
                            <ThumbsUp className="w-3.5 h-3.5" />
                          </button>
                          {kw.upvotes > 0 && <span className="text-[10px] text-emerald-400">{kw.upvotes}</span>}

                          <button
                            type="button"
                            onClick={() => handleVoteKeyword(kw, 'down')}
                            className={`p-1 rounded hover:bg-slate-800 transition-colors cursor-pointer ${
                              isDownvoted ? 'text-red-400' : 'text-slate-400 hover:text-red-300'
                            }`}
                            title="Irrelevant / Produced noisy results"
                          >
                            <ThumbsDown className="w-3.5 h-3.5" />
                          </button>
                          {kw.downvotes > 0 && <span className="text-[10px] text-red-400">{kw.downvotes}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Overall Search Run Outcome Rating */}
                <div className="pt-3 border-t border-slate-700 flex flex-wrap items-center justify-between gap-3">
                  <span className="text-xs text-slate-400">
                    How did this entire search query perform on your portal?
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleRateSearch('excellent')}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                        activePosition.searchRating === 'excellent'
                          ? 'bg-emerald-600 text-white font-bold'
                          : 'bg-slate-900 border border-slate-700 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <span>🌟 Found 4+ Good CVs</span>
                    </button>
                    <button
                      onClick={() => handleRateSearch('moderate')}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                        activePosition.searchRating === 'moderate'
                          ? 'bg-amber-600 text-white font-bold'
                          : 'bg-slate-900 border border-slate-700 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <span>⚠️ Moderate (1-3 CVs)</span>
                    </button>
                    <button
                      onClick={() => handleRateSearch('poor')}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                        activePosition.searchRating === 'poor'
                          ? 'bg-red-600 text-white font-bold'
                          : 'bg-slate-900 border border-slate-700 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <span>❌ Zero Results</span>
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* Empty State */
            <div className="bg-slate-800/50 border border-dashed border-slate-700 rounded-2xl p-12 text-center flex flex-col items-center justify-center">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-4 text-amber-400">
                <Tractor className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-white mb-1">
                No Position Analyzed Yet
              </h3>
              <p className="text-xs text-slate-400 max-w-md leading-relaxed mb-4">
                Use the left intake box to record or paste a new requirement. The engine will instantly format Boolean strings for Naukri, LinkedIn, and Google X-Ray.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* History Slide-over Drawer */}
      {showHistory && (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity"
            onClick={() => setShowHistory(false)}
          />
          <div className="relative w-full max-w-md bg-slate-900 border-l border-slate-800 h-full p-6 overflow-y-auto flex flex-col justify-between shadow-2xl">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
                <div className="flex items-center gap-2">
                  <History className="w-5 h-5 text-amber-400" />
                  <h3 className="text-base font-bold text-white">Past Requisitions</h3>
                </div>
                <button
                  onClick={() => setShowHistory(false)}
                  className="text-slate-400 hover:text-white text-xs font-semibold p-1"
                >
                  ✕ Close
                </button>
              </div>

              {history.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-8">No past positions yet.</p>
              ) : (
                <div className="space-y-3">
                  {history.map((pos) => (
                    <div
                      key={pos.id}
                      onClick={() => {
                        setActivePosition(pos);
                        setShowHistory(false);
                      }}
                      className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all ${
                        activePosition?.id === pos.id
                          ? 'bg-slate-800 border-amber-500/80 shadow-sm'
                          : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-xs font-bold text-white line-clamp-1">{pos.title}</h4>
                        <button
                          type="button"
                          onClick={(e) => handleDeletePosition(pos.id, e)}
                          className="text-slate-500 hover:text-red-400 p-1 rounded"
                          title="Delete position"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">{pos.rawInput}</p>
                      <div className="flex items-center gap-2 mt-2 text-[10px] text-slate-500">
                        <span>{new Date(pos.createdAt).toLocaleDateString()}</span>
                        {pos.searchRating && (
                          <span className="text-amber-400 font-semibold uppercase">
                            Rating: {pos.searchRating}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-slate-800 text-center">
              <p className="text-[11px] text-slate-500">
                All search feedback is stored locally in <code>data/db.json</code>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
