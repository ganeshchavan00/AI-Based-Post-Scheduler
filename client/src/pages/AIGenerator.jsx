import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { 
  Sparkles, 
  Bot, 
  Send, 
  Copy, 
  Check, 
  RefreshCw, 
  AlertCircle, 
  Hash, 
  Info, 
  Edit3,
  Zap,
  CheckCircle2,
  ExternalLink
} from 'lucide-react';

const TONES = [
  { id: 'promotional', label: 'Promotional', desc: 'High energy, CTA driven', icon: '🚀' },
  { id: 'professional', label: 'Professional', desc: 'Clear, authoritative, corporate', icon: '💼' },
  { id: 'casual', label: 'Casual', desc: 'Friendly, conversational', icon: '☕' },
  { id: 'educational', label: 'Educational', desc: 'Informative, step-by-step', icon: '🎓' },
  { id: 'creative', label: 'Creative', desc: 'Storytelling, narrative', icon: '🎨' },
];

const PLATFORMS = [
  { id: 'instagram', label: 'Instagram', desc: 'Hook + Emojis + Line Breaks', limit: 'Visual hook' },
  { id: 'linkedin', label: 'LinkedIn', desc: 'Professional Insights + Discussion', limit: '150-300 words' },
  { id: 'facebook', label: 'Facebook', desc: 'Community + Warm Inviting Story', limit: 'Engaging story' },
  { id: 'twitter', label: 'X (Twitter)', desc: 'Punchy & Concise (<280 chars)', limit: '280 chars' },
];

const SAMPLE_PROMPTS = [
  {
    title: 'Instagram Coffee Shop Opening',
    platform: 'instagram',
    tone: 'promotional',
    audience: 'Coffee lovers & local community',
    prompt: 'Write a promotional Instagram caption for my new coffee shop opening. Mention special opening discounts and invite people to visit.',
  },
  {
    title: 'LinkedIn Product Announcement',
    platform: 'linkedin',
    tone: 'professional',
    audience: 'Software engineers & founders',
    prompt: 'Announce our new AI Social Media Post Scheduler platform on LinkedIn. Highlight automated scheduling, Google Gemini caption generation, and multi-platform publishing.',
  },
  {
    title: 'Facebook Community Meetup',
    platform: 'facebook',
    tone: 'casual',
    audience: 'Local tech community and students',
    prompt: 'Create an inviting Facebook post for our community tech meetup this Saturday. Mention free pizza, networking, and a hands-on coding session.',
  },
  {
    title: 'X / Twitter Engineering Tip',
    platform: 'twitter',
    tone: 'educational',
    audience: 'Web developers',
    prompt: 'Write a punchy X (Twitter) post about writing clean code and scaling modern web apps with React and Node.js.',
  },
];

export default function AIGenerator() {
  const navigate = useNavigate();

  // Generator parameters
  const [prompt, setPrompt] = useState('');
  const [platform, setPlatform] = useState('instagram');
  const [tone, setTone] = useState('promotional');
  const [audience, setAudience] = useState('Coffee lovers & local community');
  const [keywordInput, setKeywordInput] = useState('');
  const [keywords, setKeywords] = useState(['GrandOpening', 'SpecialDiscount']);

  // Output state
  const [generatedCaption, setGeneratedCaption] = useState('');
  const [generatedHashtags, setGeneratedHashtags] = useState([]);
  const [isMock, setIsMock] = useState(false);
  const [modelNotice, setModelNotice] = useState('');
  const [activeModel, setActiveModel] = useState('gemini-3.8-flash');
  const [aiStatus, setAiStatus] = useState(null);
  
  // Loading & error states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copiedCaption, setCopiedCaption] = useState(false);
  const [copiedTags, setCopiedTags] = useState(false);

  // Check backend Gemini configuration status on load
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await api.get('/ai/status');
        setAiStatus(response.data.status);
        if (response.data.status?.model) {
          setActiveModel(response.data.status.model);
        }
      } catch (err) {
        console.warn('Could not fetch AI status:', err.message);
      }
    };
    fetchStatus();
  }, []);

  // Add keyword
  const handleAddKeyword = () => {
    const clean = keywordInput.trim();
    if (clean && !keywords.includes(clean)) {
      setKeywords([...keywords, clean]);
    }
    setKeywordInput('');
  };

  const removeKeyword = (kw) => {
    setKeywords(keywords.filter((k) => k !== kw));
  };

  // Load sample prompt
  const applySamplePrompt = (sample) => {
    setPrompt(sample.prompt);
    setPlatform(sample.platform);
    setTone(sample.tone);
    setAudience(sample.audience);
    setError('');
  };

  /**
   * Primary action: Generate Caption from user's prompt using the real Google Gemini API
   */
  const handleGenerateCaption = async (explicitFallback = false) => {
    if (!prompt.trim()) {
      setError('Please enter a description or prompt for the social media caption you want to create.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      // POST to existing backend AI endpoint (/api/ai/generate)
      const response = await api.post('/ai/generate', {
        prompt: prompt.trim(),
        topic: prompt.trim(), // backward compatibility with backend
        platform,
        tone,
        audience: audience.trim(),
        keywords,
        type: 'all', // generates complete caption and relevant hashtags
        count: 6,
        useFallback: explicitFallback,
      });

      if (response.data?.success) {
        setGeneratedCaption(response.data.caption || '');
        setGeneratedHashtags(response.data.hashtags || []);
        setIsMock(Boolean(response.data.isMock));
        setModelNotice(response.data.notice || '');
        if (response.data.model) {
          setActiveModel(response.data.model);
        }
      } else {
        throw new Error(response.data?.message || 'Failed to generate caption.');
      }
    } catch (err) {
      console.error('Caption generation request failed:', err);
      const serverMessage = err.response?.data?.message || err.message || 'Live generation failed.';
      setError(serverMessage);
      // If live generation failed, do NOT present fake mock output as Gemini output
      if (!explicitFallback) {
        setGeneratedCaption('');
        setGeneratedHashtags([]);
      }
    } finally {
      setLoading(false);
    }
  };

  // Copy helpers
  const handleCopyCaption = () => {
    if (!generatedCaption) return;
    navigator.clipboard.writeText(generatedCaption);
    setCopiedCaption(true);
    setTimeout(() => setCopiedCaption(false), 2000);
  };

  const handleCopyTags = () => {
    if (!generatedHashtags.length) return;
    const text = generatedHashtags.map((t) => `#${t}`).join(' ');
    navigator.clipboard.writeText(text);
    setCopiedTags(true);
    setTimeout(() => setCopiedTags(false), 2000);
  };

  // Export to Post Composer
  const handleExportToPost = () => {
    navigate('/create-post', {
      state: {
        generatedContent: generatedCaption,
        generatedHashtags: generatedHashtags,
      },
    });
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 md:p-8 space-y-6">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            AI Content Studio
            {aiStatus?.configured ? (
              <span className="text-[11px] px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-emerald-600" />
                Live Gemini ({activeModel})
              </span>
            ) : (
              <span className="text-[11px] px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 font-medium">
                Template Fallback Mode
              </span>
            )}
          </h1>
          <p className="text-xs text-slate-500">
            Enter a prompt to automatically generate high-converting social media captions and hashtags using Google Gemini ({activeModel})
          </p>
        </div>

        <button
          onClick={() => navigate('/create-post')}
          className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 font-medium cursor-pointer"
        >
          Go to Post Composer &rarr;
        </button>
      </div>

      {/* Error Banner with Honest Transparency */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs space-y-2 shadow-xs">
          <div className="flex items-start justify-between gap-2.5">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-rose-900">Live Gemini Generation Failed</p>
                <p className="text-xs text-rose-800 leading-relaxed">{error}</p>
                {(error.toLowerCase().includes('quota') || error.toLowerCase().includes('rate limit')) && (
                  <p className="text-[11px] text-rose-700 leading-relaxed pt-1">
                    Google Gemini API rate limit or quota exceeded. Free tier limits may be temporarily exhausted. Check your usage at{' '}
                    <a
                      href="https://aistudio.google.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline font-semibold hover:text-rose-950 inline-flex items-center gap-0.5"
                    >
                      Google AI Studio <ExternalLink className="w-3 h-3" />
                    </a>
                  </p>
                )}
                {(error.toLowerCase().includes('key') || error.toLowerCase().includes('configured')) && (
                  <p className="text-[11px] text-rose-700 leading-relaxed pt-1">
                    Make sure <code className="bg-rose-100 px-1 py-0.5 rounded font-mono">GEMINI_API_KEY</code> is set in <code className="bg-rose-100 px-1 py-0.5 rounded font-mono">server/.env</code>. Obtain a key at{' '}
                    <a
                      href="https://aistudio.google.com/app/apikey"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline font-semibold hover:text-rose-950 inline-flex items-center gap-0.5"
                    >
                      Google AI Studio <ExternalLink className="w-3 h-3" />
                    </a>
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={() => setError('')}
              className="text-rose-500 hover:text-rose-800 text-xs font-semibold cursor-pointer"
            >
              &times;
            </button>
          </div>

          <div className="pt-1 flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setError('');
                handleGenerateCaption(true); // explicit fallback mode
              }}
              className="px-3 py-1.5 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-900 text-xs font-semibold transition-colors cursor-pointer"
            >
              Generate using Local Template Fallback Instead &rarr;
            </button>
          </div>
        </div>
      )}

      {/* Two Column Layout: Generator Inputs (Left) & Output Workspace (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: Form Controls (6 cols) */}
        <div className="lg:col-span-6 space-y-5">
          <div className="p-6 rounded-xl bg-white border border-slate-200 shadow-xs space-y-5">
            
            {/* 1. Prompt Input (Clear Textarea) */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-800 flex items-center justify-between">
                <span>Describe the post you want to create (User Prompt) <span className="text-rose-500">*</span></span>
                <span className="text-[11px] font-normal text-slate-400">Google Gemini ({activeModel})</span>
              </label>
              <textarea
                rows={4}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g. Write a promotional Instagram caption for my new coffee shop opening. Mention special opening discounts and invite people to visit."
                className="w-full p-3.5 rounded-lg bg-white border border-slate-200 text-slate-900 placeholder-slate-400 text-xs leading-relaxed focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-colors"
              />

              {/* Sample Prompts */}
              <div className="space-y-1 pt-1">
                <span className="text-[11px] text-slate-400 font-medium">Click to try a sample prompt:</span>
                <div className="flex flex-wrap gap-1.5">
                  {SAMPLE_PROMPTS.map((sample, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => applySamplePrompt(sample)}
                      className="text-[11px] px-2.5 py-1 rounded-md bg-slate-50 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 text-slate-600 border border-slate-200 transition-colors text-left cursor-pointer"
                    >
                      {sample.title}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 2. Platform Selector */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-800 block">
                Target Platform <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {PLATFORMS.map((p) => {
                  const isSelected = platform === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPlatform(p.id)}
                      className={`p-2.5 rounded-lg border text-center transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-blue-50 text-blue-700 border-blue-400 font-semibold shadow-xs ring-1 ring-blue-300'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <span className="text-xs font-semibold block">{p.label}</span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">{p.limit}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. Tone of Voice Selector */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-800 block">Tone of Voice (Optional)</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {TONES.map((t) => {
                  const isSelected = tone === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTone(t.id)}
                      className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-blue-50 text-blue-700 border-blue-300 font-semibold shadow-xs'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 text-xs font-semibold">
                        <span>{t.icon}</span>
                        <span>{t.label}</span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">{t.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 4. Target Audience */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-800 block">Target Audience (Optional)</label>
              <input
                type="text"
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                placeholder="e.g. Coffee lovers, college students, tech professionals, founders"
                className="w-full px-3.5 py-2 rounded-lg bg-white border border-slate-200 text-slate-900 text-xs focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            {/* 5. Keywords to Include */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-800 block">Keywords & Offers to Include (Optional)</label>
              <div className="flex flex-wrap gap-1.5 min-h-[26px]">
                {keywords.map((kw, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-blue-50 border border-blue-200 text-blue-700 text-xs font-medium"
                  >
                    {kw}
                    <button
                      type="button"
                      onClick={() => removeKeyword(kw)}
                      className="hover:text-rose-600 cursor-pointer text-slate-400"
                    >
                      &times;
                    </button>
                  </span>
                ))}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={keywordInput}
                  onChange={(e) => setKeywordInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddKeyword();
                    }
                  }}
                  placeholder="Type a keyword and press Add (e.g. 20% Off)"
                  className="flex-1 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-900 text-xs placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
                <button
                  type="button"
                  onClick={handleAddKeyword}
                  className="px-3.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium border border-slate-200 cursor-pointer"
                >
                  Add
                </button>
              </div>
            </div>

            {/* Prominent Generate Caption Action Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => handleGenerateCaption(false)}
                disabled={loading}
                className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-md shadow-blue-500/10 flex items-center justify-center gap-2 transition-all disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Generating Caption with Google Gemini ({activeModel})...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-blue-200" />
                    <span className="text-sm">Generate Caption</span>
                  </>
                )}
              </button>
            </div>

          </div>
        </div>

        {/* Right Column: Generated Output & Export Workspace (6 cols) */}
        <div className="lg:col-span-6 space-y-5 sticky top-20">
          
          {/* Main Output Box */}
          <div className="p-6 rounded-xl bg-white border border-slate-200 shadow-xs space-y-4">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Bot className="w-4 h-4 text-blue-600" />
                <h2 className="font-bold text-slate-900 text-xs">Generated Caption Workspace</h2>
              </div>
              {generatedCaption && (
                isMock ? (
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 font-medium">
                    Template Fallback Mode
                  </span>
                ) : (
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    Live Gemini ({activeModel})
                  </span>
                )
              )}
            </div>

            {/* Notice if in Fallback Mode */}
            {modelNotice && (
              <div className={`p-3 rounded-lg text-[11px] border leading-relaxed ${
                isMock 
                  ? 'bg-amber-50 border-amber-200 text-amber-800' 
                  : 'bg-blue-50/70 border-blue-200 text-blue-800'
              }`}>
                {modelNotice}
              </div>
            )}

            {/* Generated Caption Area (Editable Textarea) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                  <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                  Editable Caption
                </span>
                {generatedCaption && (
                  <button
                    type="button"
                    onClick={handleCopyCaption}
                    className="text-blue-600 hover:text-blue-700 flex items-center gap-1 text-[11px] font-medium cursor-pointer"
                  >
                    {copiedCaption ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedCaption ? 'Copied' : 'Copy Caption'}</span>
                  </button>
                )}
              </div>

              {generatedCaption ? (
                <textarea
                  rows={8}
                  value={generatedCaption}
                  onChange={(e) => setGeneratedCaption(e.target.value)}
                  className="w-full p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 text-xs focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 leading-relaxed font-sans resize-y"
                />
              ) : (
                <div className="p-8 rounded-lg bg-slate-50 border border-dashed border-slate-200 text-center space-y-2">
                  <Sparkles className="w-7 h-7 text-slate-400 mx-auto" />
                  <p className="text-xs text-slate-700 font-semibold">Your caption will appear here</p>
                  <p className="text-[11px] text-slate-400 max-w-xs mx-auto leading-relaxed">
                    Enter your prompt on the left, pick your target platform, and click &ldquo;Generate Caption&rdquo; to produce platform-tailored copy.
                  </p>
                </div>
              )}
            </div>

            {/* Generated Hashtags Area */}
            {generatedHashtags.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                    <Hash className="w-3.5 h-3.5 text-blue-600" />
                    Relevant Hashtags
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyTags}
                    className="text-blue-600 hover:text-blue-700 flex items-center gap-1 text-[11px] font-medium cursor-pointer"
                  >
                    {copiedTags ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedTags ? 'Copied' : 'Copy All'}</span>
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {generatedHashtags.map((tag, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded-md bg-blue-50 border border-blue-200 text-blue-700 text-xs font-mono"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Action Bar: Regenerate & Export to Post Composer */}
            {generatedCaption && (
              <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row gap-2.5">
                {/* Regenerate Button */}
                <button
                  type="button"
                  onClick={() => handleGenerateCaption(isMock)}
                  disabled={loading}
                  className="py-2.5 px-4 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs border border-slate-200 flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  <span>Regenerate</span>
                </button>

                {/* Export to Post Composer Button */}
                <button
                  type="button"
                  onClick={handleExportToPost}
                  className="flex-1 py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs shadow-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Export to Post Composer &rarr;</span>
                </button>
              </div>
            )}

          </div>

          {/* Academic Transparency Note */}
          <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200 text-xs text-blue-900 space-y-1">
            <div className="flex items-center gap-1.5 text-blue-800 font-semibold">
              <Info className="w-4 h-4 text-blue-600" />
              <span>AI Review & Transparency Guideline</span>
            </div>
            <p className="text-[11px] text-blue-700 leading-relaxed">
              Every caption is generated directly from your prompt and tailored for the selected platform. You can edit the caption directly in the workspace above before exporting it to schedule.
            </p>
          </div>

        </div>

      </div>

    </div>
  );
}
