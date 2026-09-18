import { useState, useRef, useEffect } from 'react';
import Head from 'next/head';
import ReactMarkdown from 'react-markdown';
import { 
  Sparkles, 
  Send, 
  Mic, 
  MicOff, 
  Image as ImageIcon, 
  ShieldCheck, 
  Compass, 
  RefreshCw,
  ExternalLink,
  Bot,
  Plus,
  Trash2,
  Database,
  Copy,
  Check,
  ChevronRight,
  Menu,
  X,
  MessageSquare,
  Lightbulb
} from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  image?: string;
  timestamp?: string;
}

interface ChatSession {
  id: string;
  title: string;
  date: string;
  messages: Message[];
}

export default function AssistantStudio() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>('');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'general' | 'pre-task' | 'fact-check'>('general');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showMemoryModal, setShowMemoryModal] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [crmStats, setCrmStats] = useState({ total: 0, highIntent: 0 });

  const [customMemory, setCustomMemory] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-open sidebar on desktop only
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
      setSidebarOpen(true);
    }
  }, []);

  const syncLiveStats = async () => {
    try {
      const res = await fetch('/api/sync-stats');
      const data = await res.json();
      if (data.connected) {
        setCrmStats({ total: data.total, highIntent: data.highIntent });
        const baseVault = [
          `- Active Goal: $1,000/month by closing MVP & custom tool clients`,
          `- LeadScout V3: ${data.total} active leads, ${data.highIntent} high intent`,
          `- Core Live Stack: Vercel, Supabase, Next.js, Netlify`
        ].join('\n');
        const savedUserNotes = localStorage.getItem('selimos_user_notes') || '';
        const fullMemory = savedUserNotes ? `${baseVault}\n${savedUserNotes}` : baseVault;
        setCustomMemory(fullMemory);
        localStorage.setItem('selimos_custom_memory', fullMemory);
      }
    } catch (e) {
      console.error('Failed to sync live stats:', e);
    }
  };

  useEffect(() => {
    const savedSessions = localStorage.getItem('selimos_sessions');
    if (savedSessions) {
      try {
        const parsed = JSON.parse(savedSessions);
        if (parsed.length > 0) {
          setSessions(parsed);
          setCurrentSessionId(parsed[0].id);
        } else {
          createNewSession();
        }
      } catch (e) {
        createNewSession();
      }
    } else {
      createNewSession();
    }
    syncLiveStats();
  }, []);

  useEffect(() => {
    if (sessions.length > 0) {
      localStorage.setItem('selimos_sessions', JSON.stringify(sessions));
    }
  }, [sessions]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [sessions, currentSessionId, loading]);

  const activeSession = sessions.find((s) => s.id === currentSessionId) || sessions[0];

  const createNewSession = () => {
    const newId = Date.now().toString();
    const newSession: ChatSession = {
      id: newId,
      title: 'New Advisory Session',
      date: new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
      messages: [
        {
          role: 'assistant',
          content: 'Salam Selim! I am fully synchronized with your LeadScout database and live tools.\n\nWhich lead, task, or technical decision are we reviewing?',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]
    };
    setSessions((prev) => [newSession, ...prev]);
    setCurrentSessionId(newId);
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  };

  const deleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const filtered = sessions.filter((s) => s.id !== id);
    if (filtered.length === 0) createNewSession();
    else {
      setSessions(filtered);
      if (currentSessionId === id) setCurrentSessionId(filtered[0].id);
    }
  };

  const saveMemoryVault = () => {
    localStorage.setItem('selimos_custom_memory', customMemory);
    setShowMemoryModal(false);
  };

  const toggleSpeechRecognition = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech recognition is not supported on this browser. Please use Chrome.');
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';

    if (!isRecording) {
      recognition.start();
      setIsRecording(true);
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
        setIsRecording(false);
      };
      recognition.onerror = () => setIsRecording(false);
      recognition.onend = () => setIsRecording(false);
    } else {
      recognition.stop();
      setIsRecording(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setSelectedImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const copyToClipboard = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const sendMessage = async (promptOverride?: string) => {
    const textToSend = promptOverride || input;
    if (!textToSend.trim() && !selectedImage) return;

    const userMessage: Message = {
      role: 'user',
      content: textToSend,
      image: selectedImage || undefined,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const isFirstUserMessage = activeSession?.messages.filter(m => m.role === 'user').length === 0;
    const updatedTitle = isFirstUserMessage ? textToSend.slice(0, 26) + '...' : activeSession.title;
    const updatedMessages = [...(activeSession?.messages || []), userMessage];

    setSessions((prev) =>
      prev.map((s) => (s.id === currentSessionId ? { ...s, title: updatedTitle, messages: updatedMessages } : s))
    );

    setInput('');
    const imagePayload = selectedImage;
    setSelectedImage(null);
    setLoading(true);

    try {
      const historyPayload = updatedMessages
        .slice(1, -1)
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: textToSend,
          image: imagePayload,
          mode,
          history: historyPayload,
          customMemory
        })
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const assistantMessage: Message = {
        role: 'assistant',
        content: data.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setSessions((prev) =>
        prev.map((s) =>
          s.id === currentSessionId
            ? { ...s, messages: [...updatedMessages, assistantMessage] }
            : s
        )
      );
      syncLiveStats();
    } catch (err: any) {
      const errorMsg: Message = {
        role: 'assistant',
        content: `Advisory Error: ${err.message}.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setSessions((prev) =>
        prev.map((s) => (s.id === currentSessionId ? { ...s, messages: [...updatedMessages, errorMsg] } : s))
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="bg-slate-50 text-slate-900 font-sans flex overflow-hidden selection:bg-cyan-100 selection:text-cyan-950 relative"
      style={{ height: '100dvh' }}
    >
      <Head>
        <title>SelimOS Co-Pilot | Executive Studio</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
      </Head>

      {/* MOBILE BACKDROP OVERLAY */}
      {sidebarOpen && (
        <div 
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 lg:hidden transition-opacity"
        />
      )}

      {/* SIDEBAR (Drawer on Mobile / Docked on Desktop) */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-72 bg-white border-r border-slate-200 flex flex-col justify-between transition-transform duration-300 ease-in-out shrink-0 shadow-xl lg:shadow-none ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0 lg:w-72'
        }`}
      >
        <div className="p-4 space-y-4 overflow-y-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-cyan-600 text-white flex items-center justify-center font-black shadow-md shadow-cyan-600/20">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-sm font-black text-slate-900 leading-tight">SelimOS Studio</h1>
                <span className="text-[11px] text-cyan-700 font-bold">Live Supabase Sync</span>
              </div>
            </div>

            <button
              onClick={() => setSidebarOpen(false)}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 lg:hidden"
              aria-label="Close Sidebar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <button
            onClick={createNewSession}
            className="w-full py-2.5 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition"
          >
            <Plus className="h-4 w-4" />
            <span>New Advisory Chat</span>
          </button>

          {/* Memory Vault Card */}
          <div className="bg-cyan-50/70 border border-cyan-200 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between text-xs font-extrabold text-cyan-900">
              <span className="flex items-center gap-1.5">
                <Database className="h-3.5 w-3.5 text-cyan-700" />
                <span>Memory Vault</span>
              </span>
              <button
                onClick={() => {
                  syncLiveStats();
                  setShowMemoryModal(true);
                }}
                className="text-[11px] text-cyan-700 hover:underline font-bold flex items-center gap-1"
              >
                <RefreshCw className="h-2.5 w-2.5" />
                <span>Sync</span>
              </button>
            </div>
            <div className="text-[11px] text-slate-700 font-medium space-y-0.5">
              <p className="font-bold text-cyan-950">🎯 Live Pipeline: {crmStats.total || 'Syncing...'} leads</p>
              <p className="text-slate-500">🔥 {crmStats.highIntent} High-Intent (80+ Score)</p>
            </div>
          </div>

          {/* Sessions List */}
          <div className="space-y-1">
            <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400 px-1">
              Advisory History
            </span>
            <div className="space-y-1 max-h-[36vh] sm:max-h-[42vh] overflow-y-auto pr-1">
              {sessions.map((s) => (
                <div
                  key={s.id}
                  onClick={() => {
                    setCurrentSessionId(s.id);
                    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                      setSidebarOpen(false);
                    }
                  }}
                  className={`group w-full text-left p-2.5 rounded-xl text-xs transition flex items-center justify-between cursor-pointer ${
                    currentSessionId === s.id
                      ? 'bg-cyan-50 text-cyan-950 font-bold border border-cyan-200'
                      : 'text-slate-600 hover:bg-slate-100 font-medium'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate pr-2">
                    <MessageSquare className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <span className="truncate">{s.title}</span>
                  </div>
                  <button
                    onClick={(e) => deleteSession(s.id, e)}
                    className="opacity-60 lg:opacity-0 group-hover:opacity-100 hover:text-red-600 transition p-1"
                    title="Delete Chat"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Live Properties Footer Links */}
        <div className="p-3 border-t border-slate-200 bg-slate-50/50 space-y-1.5 text-[11px]">
          <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400 px-1">Live Properties</span>
          <div className="space-y-1">
            <a href="https://toolsverse-kappa.vercel.app/" target="_blank" rel="noreferrer" className="flex items-center justify-between p-1.5 rounded-lg hover:bg-white text-slate-700 font-semibold transition border border-transparent hover:border-slate-200">
              <span>ToolVerse</span> <ExternalLink className="h-3 w-3 text-slate-400" />
            </a>
            <a href="https://myimagetools.netlify.app/" target="_blank" rel="noreferrer" className="flex items-center justify-between p-1.5 rounded-lg hover:bg-white text-slate-700 font-semibold transition border border-transparent hover:border-slate-200">
              <span>MyImageTools</span> <ExternalLink className="h-3 w-3 text-slate-400" />
            </a>
            <a href="https://agency-hub-pink.vercel.app/" target="_blank" rel="noreferrer" className="flex items-center justify-between p-1.5 rounded-lg hover:bg-white text-slate-700 font-semibold transition border border-transparent hover:border-slate-200">
              <span>LeadScout HQ</span> <ExternalLink className="h-3 w-3 text-slate-400" />
            </a>
          </div>
        </div>
      </aside>

      {/* MAIN WORKSPACE */}
      <div className="flex-1 flex flex-col h-full overflow-hidden w-full min-w-0">
        
        {/* RESPONSIVE TOP HEADER */}
        <header className="h-14 sm:h-16 border-b border-slate-200 bg-white/95 px-3 sm:px-5 flex items-center justify-between shrink-0 shadow-2xs gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-1.5 sm:p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 lg:hidden shrink-0"
              aria-label="Open Sidebar"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <h2 className="text-xs sm:text-sm font-extrabold text-slate-900 truncate max-w-[130px] sm:max-w-xs md:max-w-sm">
                {activeSession?.title}
              </h2>
              <p className="text-[10px] sm:text-[11px] text-slate-500 font-medium truncate hidden xs:block">
                Rajshahi, BD · Live Sync
              </p>
            </div>
          </div>

          {/* Mode Selector Pill Buttons */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0">
            <button
              onClick={() => setMode('general')}
              className={`px-2 sm:px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 sm:gap-1.5 ${
                mode === 'general' ? 'bg-white text-slate-900 shadow-2xs font-extrabold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sparkles className="h-3.5 w-3.5 text-blue-600 shrink-0" />
              <span className="hidden sm:inline">Strategy</span>
            </button>

            <button
              onClick={() => setMode('pre-task')}
              className={`px-2 sm:px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 sm:gap-1.5 ${
                mode === 'pre-task' ? 'bg-white text-slate-900 shadow-2xs font-extrabold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Compass className="h-3.5 w-3.5 text-cyan-600 shrink-0" />
              <span className="hidden sm:inline">Pre-Task</span>
            </button>

            <button
              onClick={() => setMode('fact-check')}
              className={`px-2 sm:px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 sm:gap-1.5 ${
                mode === 'fact-check' ? 'bg-white text-slate-900 shadow-2xs font-extrabold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
              <span className="hidden sm:inline">QA</span>
            </button>
          </div>
        </header>

        {/* SCROLLABLE CHAT MESSAGES */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-4 sm:space-y-6 max-w-4xl w-full mx-auto">
          {activeSession?.messages.length <= 2 && (
            <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
              <div className="flex items-center gap-2 text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                <Lightbulb className="h-4 w-4 text-cyan-600" />
                <span>Instant High-Converting Actions</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-bold">
                <button
                  onClick={() => sendMessage('Write a 3-sentence high-converting Reddit DM for lead #1. Do not use corporate fluff.')}
                  className="text-left p-3 rounded-xl border border-slate-200 hover:border-cyan-500 hover:bg-cyan-50/40 transition flex items-center justify-between text-slate-800"
                >
                  <span className="truncate pr-2">📝 Draft 3-Sentence DM for Lead #1</span>
                  <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />
                </button>

                <button
                  onClick={() => sendMessage('Show me my top 3 highest-intent leads right now with their bottleneck and budget.')}
                  className="text-left p-3 rounded-xl border border-slate-200 hover:border-cyan-500 hover:bg-cyan-50/40 transition flex items-center justify-between text-slate-800"
                >
                  <span className="truncate pr-2">🔥 Review Top Ranked Leads</span>
                  <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />
                </button>
              </div>
            </div>
          )}

          {activeSession?.messages.map((m, idx) => (
            <div
              key={idx}
              className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'} space-y-1`}
            >
              <div className="flex items-center gap-2 text-[10px] sm:text-[11px] font-bold text-slate-400 px-1">
                <span>{m.role === 'user' ? 'Selim Reza' : 'SelimOS Strategic Advisor'}</span>
                {m.timestamp && <span>· {m.timestamp}</span>}
              </div>

              <div
                className={`p-3.5 sm:p-5 rounded-2xl max-w-[92%] sm:max-w-2xl text-xs sm:text-sm leading-relaxed relative group shadow-xs ${
                  m.role === 'user'
                    ? 'bg-cyan-600 text-white rounded-br-xs font-medium'
                    : 'bg-white border border-slate-200 text-slate-800 rounded-bl-xs'
                }`}
              >
                {m.image && (
                  <img src={m.image} alt="Attachment" className="rounded-xl mb-3 max-h-56 sm:max-h-72 object-contain border border-slate-200 w-full" />
                )}

                <div className="prose prose-xs sm:prose-sm max-w-none text-slate-800 leading-relaxed space-y-2 break-words">
                  <ReactMarkdown
                    components={{
                      p: ({ node, ...props }) => <p className="mb-2 last:mb-0" {...props} />,
                      strong: ({ node, ...props }) => <strong className="font-bold text-slate-900" {...props} />,
                      ul: ({ node, ...props }) => <ul className="list-disc pl-4 space-y-1 my-2" {...props} />,
                      ol: ({ node, ...props }) => <ol className="list-decimal pl-4 space-y-1 my-2" {...props} />,
                      li: ({ node, ...props }) => <li className="text-slate-700" {...props} />,
                      a: ({ node, ...props }) => (
                        <a
                          className="text-cyan-700 underline font-semibold hover:text-cyan-800 break-all"
                          target="_blank"
                          rel="noopener noreferrer"
                          {...props}
                        />
                      ),
                      hr: () => <hr className="my-3 border-slate-200" />,
                    }}
                  >
                    {m.content}
                  </ReactMarkdown>
                </div>

                {m.role === 'assistant' && (
                  <button
                    onClick={() => copyToClipboard(m.content, idx)}
                    className="absolute top-2.5 right-2.5 p-1 sm:p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-500 opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition"
                    title="Copy Answer"
                  >
                    {copiedIndex === idx ? <Check className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-emerald-600" /> : <Copy className="h-3 w-3 sm:h-3.5 sm:w-3.5" />}
                  </button>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2 text-xs font-bold text-cyan-800 bg-cyan-50/80 p-3 rounded-2xl border border-cyan-200 w-fit shadow-xs">
              <RefreshCw className="h-3.5 w-3.5 animate-spin text-cyan-600 shrink-0" />
              <span>Analyzing live database and drafting response...</span>
            </div>
          )}

          <div ref={chatEndRef} />
        </main>

        {/* RESPONSIVE BOTTOM INPUT DOCK */}
        <footer className="border-t border-slate-200 bg-white p-2.5 sm:p-4 shrink-0">
          <div className="max-w-4xl mx-auto space-y-2">
            {selectedImage && (
              <div className="flex items-center gap-2 p-1.5 sm:p-2 bg-slate-100 rounded-xl border border-slate-200 w-fit">
                <img src={selectedImage} alt="Attachment" className="h-8 w-8 sm:h-10 sm:w-10 object-cover rounded-lg" />
                <span className="text-[11px] sm:text-xs text-slate-700 font-semibold">Image attached</span>
                <button onClick={() => setSelectedImage(null)} className="text-xs text-red-600 font-bold ml-1 hover:underline">Remove</button>
              </div>
            )}

            <div className="flex items-center gap-1.5 sm:gap-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageUpload}
                accept="image/*"
                className="hidden"
              />

              <button
                onClick={() => fileInputRef.current?.click()}
                title="Upload screenshot"
                className="p-2 sm:p-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 transition shrink-0"
              >
                <ImageIcon className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>

              <button
                onClick={toggleSpeechRecognition}
                title={isRecording ? 'Listening...' : 'Voice Note'}
                className={`p-2 sm:p-2.5 rounded-xl border transition shrink-0 ${
                  isRecording 
                    ? 'bg-red-500 text-white border-red-600 animate-pulse' 
                    : 'border-slate-200 hover:bg-slate-100 text-slate-600'
                }`}
              >
                {isRecording ? <MicOff className="h-4 w-4 sm:h-5 sm:w-5" /> : <Mic className="h-4 w-4 sm:h-5 sm:w-5" />}
              </button>

              <input
                type="text"
                placeholder={
                  mode === 'pre-task'
                    ? 'Describe task before starting...'
                    : 'Ask your co-pilot, review leads...'
                }
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                className="flex-1 min-w-0 bg-slate-50 border border-slate-300 rounded-xl px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-cyan-600 focus:bg-white transition font-medium"
              />

              <button
                onClick={() => sendMessage()}
                disabled={loading || (!input.trim() && !selectedImage)}
                className="px-3 sm:px-4 py-2 sm:py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition disabled:opacity-40 shadow-xs shrink-0"
              >
                <Send className="h-4 w-4" />
                <span className="hidden sm:inline">Send</span>
              </button>
            </div>
          </div>
        </footer>
      </div>

      {/* RESPONSIVE MEMORY VAULT MODAL */}
      {showMemoryModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-4 sm:p-6 space-y-3 sm:space-y-4 shadow-xl max-h-[90dvh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="h-5 w-5 text-cyan-600" />
                <h3 className="text-sm sm:text-base font-extrabold text-slate-900">Personal Memory Vault</h3>
              </div>
              <button onClick={() => setShowMemoryModal(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-[11px] sm:text-xs text-slate-500">
              Auto-synced with live Supabase counts. Custom notes below are injected into the AI on every prompt.
            </p>

            <textarea
              rows={5}
              value={customMemory}
              onChange={(e) => setCustomMemory(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs text-slate-900 font-mono focus:border-cyan-600 focus:outline-hidden"
              placeholder="- New Project: Client X on Upwork&#10;- Custom Domain: selimdev.com"
            />

            <div className="flex flex-col sm:flex-row justify-between items-center gap-2 pt-1">
              <button
                onClick={syncLiveStats}
                className="text-xs font-bold text-cyan-700 hover:underline flex items-center gap-1 order-2 sm:order-1"
              >
                <RefreshCw className="h-3 w-3" />
                <span>Re-sync Live Stats</span>
              </button>

              <div className="flex gap-2 w-full sm:w-auto justify-end order-1 sm:order-2">
                <button
                  onClick={() => setShowMemoryModal(false)}
                  className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl text-xs font-bold border border-slate-200 hover:bg-slate-100 text-slate-700"
                >
                  Close
                </button>
                <button
                  onClick={saveMemoryVault}
                  className="flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white shadow-xs"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
