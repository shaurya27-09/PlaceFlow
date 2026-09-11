import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Sparkles,
  Send,
  Bot,
  User,
  Zap,
  HelpCircle,
  TrendingUp,
  Award,
  Users,
  CheckCircle2,
  XCircle,
  Briefcase,
  Database,
  ShieldCheck,
  AlertCircle,
  RefreshCw,
  Building2,
  GraduationCap
} from 'lucide-react';

interface Message {
  id: string;
  sender: 'ai' | 'user';
  text: string;
  timestamp: string;
  provider?: string;
  driveContext?: string;
}

export const AiAssistantPage: React.FC = () => {
  const {
    students,
    drives,
    companies,
    applications,
    offers,
    offerPolicy,
    activeStudentId,
    setActiveStudentId,
    activeStudent,
    isSupabaseConfigured,
    supabaseConnected
  } = useApp();

  const [selectedStudentId, setSelectedStudentId] = useState<string>(
    activeStudentId || (students[0]?.id ?? 'std-1')
  );
  const [selectedDriveId, setSelectedDriveId] = useState<string>(
    drives[0]?.id ?? 'drv-1'
  );
  const [inputQuery, setInputQuery] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'm-1',
      sender: 'ai',
      text: "Hello! I am your **PlaceFlow Placement Decision Explainer AI**, connected to Gemini API and grounded strictly in the placement data stored in Supabase.\n\n🔒 **Important Governance Rule:** I **never decide eligibility** or create new outcomes. I **only explain existing placement and policy decisions** recorded in the database.\n\nTry asking:\n• *\"Why am I not eligible?\"*\n• *\"Explain why I am blocked from this company.\"*\n• *\"What criteria mismatch caused my ineligibility?\"*",
      timestamp: 'Just now',
      provider: 'gemini-3.6-flash'
    }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Sync with context active student
  useEffect(() => {
    if (activeStudentId && activeStudentId !== selectedStudentId) {
      setSelectedStudentId(activeStudentId);
    }
  }, [activeStudentId]);

  const currentStudent = students.find(s => s.id === selectedStudentId) || students[0];
  const currentDrive = drives.find(d => d.id === selectedDriveId) || drives[0];

  const scrollToBottom = () => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Specific query templates covering different placement inquiries
  const samplePrompts = [
    'How many students are placed?',
    'How many students are unplaced?',
    'Which company offers the highest package?',
    'Which branch has the highest placement rate?',
    'How many students are eligible for Microsoft?',
    'Why is Rahul Sharma not eligible for Microsoft?',
    'What are the minimum requirements recorded for this drive?'
  ];

  const handleQuery = async (queryText: string) => {
    const currentQuestion = queryText.trim();
    if (!currentQuestion || isLoading) return;

    // Log the current question to client console
    console.log('AI QUESTION:', currentQuestion);

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      sender: 'user',
      text: currentQuestion,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      driveContext: currentDrive ? currentDrive.companyName : undefined
    };

    setMessages(prev => [...prev, userMsg]);
    setInputQuery('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          question: currentQuestion,
          message: currentQuestion,
          studentId: currentStudent?.id,
          driveId: currentDrive?.id,
          clientData: {
            students,
            drives,
            applications,
            offers,
            companies,
            offerPolicy
          }
        })
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || data?.error) {
        console.error('Technical error querying PlaceFlow AI:', data?.error || `HTTP ${response.status}`);
        const aiMsg: Message = {
          id: `ai-${Date.now()}`,
          sender: 'ai',
          text: data?.response || data?.text || 'PlaceFlow AI is temporarily unavailable. Please try again.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          provider: 'placeflow-service'
        };
        setMessages(prev => [...prev, aiMsg]);
        return;
      }

      const responseText = data?.response || data?.text || 'PlaceFlow AI is temporarily unavailable. Please try again.';

      const aiMsg: Message = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: responseText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        provider: data.provider || 'gemini-3.7-flash'
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (err: any) {
      console.error('Technical error querying PlaceFlow AI:', err);
      const aiMsg: Message = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: 'PlaceFlow AI is temporarily unavailable. Please try again.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        provider: 'service-notice'
      };
      setMessages(prev => [...prev, aiMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-5 pb-12">
      {/* Page Title and Badges */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              Gemini Placement Decision Explainer
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
                Gemini 3.7 Flash
              </span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Explains existing eligibility and offer policy outcomes strictly from database records. Never decides eligibility.
            </p>
          </div>
        </div>

        {/* Database & Governance Indicators */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold">
            <Database className="w-3.5 h-3.5 text-emerald-500" />
            <span>Data: Supabase DB</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 text-indigo-700 dark:text-indigo-300 text-[11px] font-bold">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />
            <span>Read-Only Explainer</span>
          </div>
        </div>
      </div>

      {/* Context Selector Bar: Student and Drive Selection */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
        <div className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
          <GraduationCap className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <span>Active Context for Decision Explanation:</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          {/* Select Student */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
              Context Student Profile (Candidate):
            </label>
            <select
              value={selectedStudentId}
              onChange={e => {
                setSelectedStudentId(e.target.value);
                setActiveStudentId(e.target.value);
              }}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-medium text-slate-900 dark:text-white"
            >
              {students.map(s => {
                const backlogsText = s.backlogs > 0 ? ` [${s.backlogs} Backlog${s.backlogs > 1 ? 's' : ''}]` : ' [0 Backlogs]';
                const cgpaText = `CGPA: ${s.cgpa}`;
                return (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.branch}, {cgpaText}{backlogsText}, Att: {s.attendance}%)
                  </option>
                );
              })}
            </select>
          </div>

          {/* Select Placement Drive */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
              Target Placement Drive (Recruiter):
            </label>
            <select
              value={selectedDriveId}
              onChange={e => setSelectedDriveId(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-medium text-slate-900 dark:text-white"
            >
              {drives.map(d => (
                <option key={d.id} value={d.id}>
                  {d.companyName} — {d.role} (₹{d.packageLPA} LPA | Min {d.minCgpa} CGPA | Max {d.maxBacklogs} Backlogs)
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Selected Context Snapshot Card */}
        {currentStudent && currentDrive && (
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex flex-wrap items-center justify-between gap-2 text-[11px]">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900 dark:text-white">
                {currentStudent.name}:
              </span>
              <span className="text-slate-600 dark:text-slate-300">
                CGPA <strong className="text-slate-900 dark:text-white">{currentStudent.cgpa}</strong> •{' '}
                Backlogs <strong className={currentStudent.backlogs > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}>{currentStudent.backlogs}</strong> •{' '}
                Attendance <strong className="text-slate-900 dark:text-white">{currentStudent.attendance}%</strong> •{' '}
                Branch <strong className="text-slate-900 dark:text-white">{currentStudent.branch}</strong>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900 dark:text-white">
                {currentDrive.companyName} Criteria:
              </span>
              <span className="text-slate-600 dark:text-slate-300">
                Min CGPA <strong className="text-slate-900 dark:text-white">{currentDrive.minCgpa}</strong> •{' '}
                Max Backlogs <strong className="text-slate-900 dark:text-white">{currentDrive.maxBacklogs}</strong> •{' '}
                Min Att <strong className="text-slate-900 dark:text-white">{currentDrive.minAttendance}%</strong>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Suggested Explainer Prompts */}
      <div className="space-y-1.5">
        <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          Suggested Decision Inquiries:
        </span>
        <div className="flex flex-wrap gap-2">
          {samplePrompts.map((prompt, i) => (
            <button
              key={i}
              onClick={() => handleQuery(prompt)}
              className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors shadow-2xs text-left"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      {/* Chat Container */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col h-[520px]">
        {/* Messages Area */}
        <div className="flex-1 p-5 overflow-y-auto space-y-4">
          {messages.map(msg => (
            <div
              key={msg.id}
              className={`flex gap-3 text-xs leading-relaxed max-w-2xl ${
                msg.sender === 'user' ? 'ml-auto flex-row-reverse' : ''
              }`}
            >
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 font-bold ${
                msg.sender === 'user'
                  ? 'bg-slate-900 dark:bg-slate-800 text-white'
                  : 'bg-blue-600 text-white shadow-sm'
              }`}>
                {msg.sender === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>

              <div>
                <div className={`p-4 rounded-2xl ${
                  msg.sender === 'user'
                    ? 'bg-blue-600 text-white rounded-tr-none'
                    : 'bg-slate-50 dark:bg-slate-800/80 text-slate-800 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700/80 rounded-tl-none'
                }`}>
                  <div className="whitespace-pre-line font-medium leading-relaxed">
                    {msg.text}
                  </div>
                </div>
                <div className={`flex items-center gap-2 mt-1 px-1 text-[10px] text-slate-400 ${
                  msg.sender === 'user' ? 'justify-end' : 'justify-start'
                }`}>
                  <span>{msg.timestamp}</span>
                  {msg.provider && (
                    <span className="px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 font-mono text-[9px]">
                      {msg.provider}
                    </span>
                  )}
                  {msg.driveContext && (
                    <span className="text-slate-400">
                      • Re: {msg.driveContext}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-3 text-xs">
              <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-bounce"></span>
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-bounce [animation-delay:0.2s]"></span>
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-bounce [animation-delay:0.4s]"></span>
                <span className="text-[11px] text-slate-400 ml-1 font-medium">Interrogating Supabase placement records...</span>
              </div>
            </div>
          )}

          <div ref={chatBottomRef} />
        </div>

        {/* Input Bar */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
          <form
            onSubmit={e => {
              e.preventDefault();
              handleQuery(inputQuery);
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              id="ai-query-input"
              value={inputQuery}
              onChange={e => setInputQuery(e.target.value)}
              placeholder={`Ask Gemini to explain eligibility for ${currentStudent?.name || 'student'} against ${currentDrive?.companyName || 'drive'}...`}
              className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              id="ai-send-query-btn"
              disabled={!inputQuery.trim() || isLoading}
              className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-md shadow-blue-500/25 flex items-center gap-1.5 shrink-0"
            >
              <span>Explain</span>
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
