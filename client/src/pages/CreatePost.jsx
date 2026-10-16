import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { createPost, clearPostMessages } from '../features/posts/postsSlice';
import { fetchAccounts } from '../features/social/socialSlice';
import { 
  Sparkles, 
  Send, 
  Clock, 
  FileText, 
  Image as ImageIcon, 
  X, 
  Check, 
  AlertCircle, 
  Loader2, 
  Calendar, 
  Globe, 
  MessageCircle, 
  Repeat, 
  Heart, 
  Bookmark, 
  ThumbsUp, 
  MessageSquare, 
  ArrowLeft,
  Hash
} from 'lucide-react';

const PLATFORMS = [
  { id: 'twitter', name: 'Twitter / X', activeBg: 'bg-blue-50 text-blue-700 border-blue-300 font-semibold' },
  { id: 'linkedin', name: 'LinkedIn', activeBg: 'bg-blue-50 text-blue-700 border-blue-300 font-semibold' },
  { id: 'facebook', name: 'Facebook', activeBg: 'bg-blue-50 text-blue-700 border-blue-300 font-semibold' },
  { id: 'instagram', name: 'Instagram', activeBg: 'bg-blue-50 text-blue-700 border-blue-300 font-semibold' },
];

const QUICK_TAGS = ['Tech', 'AI', 'FullStack', 'Innovation', 'WebDev', 'Coding'];

export default function CreatePost() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const fileInputRef = useRef(null);

  const { user } = useSelector((state) => state.auth);
  const { submitting, error } = useSelector((state) => state.posts);
  const { accounts } = useSelector((state) => state.social);

  // Form State
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState(['twitter', 'linkedin']);
  const [hashtags, setHashtags] = useState(['Tech', 'AI']);
  const [hashtagInput, setHashtagInput] = useState('');
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [actionType, setActionType] = useState('draft'); // 'draft', 'scheduled', 'publish'
  const [scheduledAt, setScheduledAt] = useState('');
  const [previewPlatform, setPreviewPlatform] = useState('twitter');
  const [clientError, setClientError] = useState('');

  // Handle prefilled AI content if redirected from AI Generator
  useEffect(() => {
    if (location.state?.generatedContent) {
      setContent(location.state.generatedContent);
    }
    if (location.state?.generatedHashtags) {
      setHashtags(location.state.generatedHashtags);
    }
  }, [location.state]);

  useEffect(() => {
    dispatch(clearPostMessages());
    if (!accounts || accounts.length === 0) {
      dispatch(fetchAccounts());
    }
  }, [dispatch, accounts]);

  // Clean up object URL memory leak
  useEffect(() => {
    return () => {
      if (mediaPreview) URL.revokeObjectURL(mediaPreview);
    };
  }, [mediaPreview]);

  // Handle platform toggles
  const togglePlatform = (id) => {
    if (selectedPlatforms.includes(id)) {
      if (selectedPlatforms.length === 1) return; // Keep at least one
      setSelectedPlatforms(selectedPlatforms.filter((p) => p !== id));
    } else {
      setSelectedPlatforms([...selectedPlatforms, id]);
    }
  };

  // Handle hashtag additions
  const handleAddHashtag = (tag) => {
    const clean = tag.replace(/^#/, '').trim();
    if (clean && !hashtags.includes(clean)) {
      setHashtags([...hashtags, clean]);
    }
    setHashtagInput('');
  };

  const removeHashtag = (tag) => {
    setHashtags(hashtags.filter((t) => t !== tag));
  };

  // Handle image selection
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setClientError('File exceeds 5MB size limit.');
        return;
      }
      setMediaFile(file);
      setMediaPreview(URL.createObjectURL(file));
      setClientError('');
    }
  };

  const removeMedia = () => {
    setMediaFile(null);
    if (mediaPreview) URL.revokeObjectURL(mediaPreview);
    setMediaPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setClientError('');

    if (!content.trim()) {
      setClientError('Post content cannot be empty.');
      return;
    }

    if (actionType === 'publish' && selectedPlatforms.length === 0) {
      setClientError('Please select at least one social media platform to publish.');
      return;
    }

    if ((actionType === 'publish' || actionType === 'scheduled') && selectedPlatforms.includes('instagram') && !mediaFile) {
      setClientError('Instagram requires at least one image or video attachment. Text-only posts are not supported by Instagram.');
      return;
    }

    if (actionType === 'scheduled') {
      if (!scheduledAt) {
        setClientError('Please pick a future date and time for scheduled posting.');
        return;
      }
      const selectedDate = new Date(scheduledAt);
      if (selectedDate <= new Date()) {
        setClientError('Scheduled date and time must be set in the future.');
        return;
      }
    }

    const formData = new FormData();
    formData.append('title', title);
    formData.append('content', content);
    formData.append(
      'status',
      actionType === 'scheduled' ? 'scheduled' : actionType === 'publish' ? 'published' : 'draft'
    );
    if (actionType === 'scheduled') {
      formData.append('scheduledAt', new Date(scheduledAt).toISOString());
    }

    formData.append('hashtags', JSON.stringify(hashtags));
    formData.append('selectedPlatforms', JSON.stringify(selectedPlatforms));

    if (mediaFile) {
      formData.append('media', mediaFile);
    }

    const result = await dispatch(createPost(formData));
    if (!result.error) {
      navigate('/posts');
    }
  };

  // Minimum date for datetime-local picker (Current time + 5 minutes)
  const getMinDateTime = () => {
    const now = new Date(Date.now() + 5 * 60000);
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 md:p-8 space-y-6">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg bg-white border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors cursor-pointer shadow-xs"
            title="Go back"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Create & Schedule Post
            </h1>
            <p className="text-xs text-slate-500">Compose, attach media, select platforms, and preview social rendering</p>
          </div>
        </div>

        <button
          onClick={() => navigate('/posts')}
          className="text-xs text-blue-600 hover:text-blue-700 font-medium cursor-pointer"
        >
          View Post History &rarr;
        </button>
      </div>

      {/* Alerts */}
      {(clientError || error) && (
        <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{clientError || error}</span>
        </div>
      )}

      {/* Two Column Layout: Editor (Left) & Preview (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: Post Composer Form (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <form onSubmit={handleSubmit} className="p-6 rounded-xl bg-white border border-slate-200 shadow-xs space-y-5">
            
            {/* Target Platforms */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700 block">Target Platforms</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {PLATFORMS.map((platform) => {
                  const isSelected = selectedPlatforms.includes(platform.id);
                  const acc = accounts?.find((a) => a.provider === platform.id);
                  return (
                    <button
                      key={platform.id}
                      type="button"
                      onClick={() => togglePlatform(platform.id)}
                      className={`py-2 px-2.5 rounded-lg border text-xs font-medium flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                        isSelected
                          ? platform.activeBg
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                    >
                      <div className="flex items-center gap-1">
                        {isSelected && <Check className="w-3 h-3" />}
                        <span>{platform.name}</span>
                      </div>
                      <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono ${
                        acc && !acc.isSimulated 
                          ? 'bg-emerald-100 text-emerald-800' 
                          : acc && acc.isSimulated 
                          ? 'bg-amber-100 text-amber-800' 
                          : 'bg-slate-200 text-slate-500'
                      }`}>
                        {acc && !acc.isSimulated ? 'Live OAuth' : acc && acc.isSimulated ? 'Simulated' : 'Unlinked'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>


            {/* Optional Topic / Title */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 block">Post Title / Topic (Optional)</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Major Product Launch or AI Update"
                maxLength={120}
                className="w-full px-3.5 py-2.5 rounded-lg bg-white border border-slate-200 text-slate-900 placeholder-slate-400 text-xs focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-colors"
              />
            </div>

            {/* Content Textarea */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700 block">Post Content</label>
                <span className={`text-[11px] font-mono ${content.length > 4800 ? 'text-amber-600 font-semibold' : 'text-slate-400'}`}>
                  {content.length}/5000
                </span>
              </div>
              <textarea
                rows={6}
                required
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="What would you like to share? Write your post or paste AI-generated captions here..."
                maxLength={5000}
                className="w-full p-3.5 rounded-lg bg-white border border-slate-200 text-slate-900 placeholder-slate-400 text-xs leading-relaxed focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-colors resize-y"
              />
            </div>

            {/* Hashtags Input & Chips */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700 block">Hashtags</label>
              
              {/* Active Hashtags */}
              <div className="flex flex-wrap gap-1.5 min-h-[28px]">
                {hashtags.map((tag, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-blue-50 border border-blue-200 text-blue-700 text-xs font-medium"
                  >
                    #{tag}
                    <button
                      type="button"
                      onClick={() => removeHashtag(tag)}
                      className="hover:text-rose-600 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>

              {/* Tag Input */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Hash className="w-3.5 h-3.5" />
                  </div>
                  <input
                    type="text"
                    value={hashtagInput}
                    onChange={(e) => setHashtagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ',') {
                        e.preventDefault();
                        handleAddHashtag(hashtagInput);
                      }
                    }}
                    placeholder="Type hashtag and press Enter"
                    className="w-full pl-8 pr-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-900 text-xs placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleAddHashtag(hashtagInput)}
                  className="px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium border border-slate-200 cursor-pointer"
                >
                  Add
                </button>
              </div>

              {/* Quick Tags Suggestions */}
              <div className="flex items-center gap-1.5 flex-wrap pt-1 text-[11px] text-slate-500">
                <span>Quick tags:</span>
                {QUICK_TAGS.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => handleAddHashtag(tag)}
                    className="hover:text-blue-600 transition-colors cursor-pointer"
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            </div>

            {/* Media Upload Area */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700 block">Media Attachment (Optional)</label>
              
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,video/mp4"
                onChange={handleFileChange}
                className="hidden"
              />

              {mediaPreview ? (
                <div className="relative rounded-lg overflow-hidden border border-slate-200 max-h-60 group">
                  <img
                    src={mediaPreview}
                    alt="Post attachment"
                    className="w-full h-full object-cover max-h-60"
                  />
                  <div className="absolute top-2 right-2">
                    <button
                      type="button"
                      onClick={removeMedia}
                      className="p-1.5 rounded-full bg-slate-900/80 hover:bg-rose-600 text-white transition-colors shadow-md cursor-pointer"
                      title="Remove image"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="absolute bottom-2 left-2 px-2.5 py-1 rounded-md bg-slate-900/80 text-[11px] text-white">
                    {mediaFile?.name} ({(mediaFile?.size / 1024 / 1024).toFixed(2)} MB)
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="p-6 rounded-xl border-2 border-dashed border-slate-200 hover:border-blue-400 bg-slate-50/60 hover:bg-blue-50/30 text-center cursor-pointer transition-colors group space-y-1.5"
                >
                  <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center mx-auto border border-blue-100">
                    <ImageIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-700 group-hover:text-blue-600">
                      Click to upload an image or video
                    </p>
                    <p className="text-[11px] text-slate-400">Supports JPEG, PNG, WEBP, GIF, MP4 (Max 5MB)</p>
                  </div>
                </div>
              )}
            </div>

            {/* Publishing & Scheduling Mode Selector */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <label className="text-xs font-semibold text-slate-700 block">Dispatch Mode</label>
              
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setActionType('draft')}
                  className={`py-2 px-3 rounded-lg border text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    actionType === 'draft'
                      ? 'bg-white text-slate-900 border-slate-300 font-semibold shadow-xs'
                      : 'bg-slate-100/70 border-slate-200 text-slate-600 hover:bg-white'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Draft</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActionType('scheduled')}
                  className={`py-2 px-3 rounded-lg border text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    actionType === 'scheduled'
                      ? 'bg-blue-50 text-blue-700 border-blue-300 font-semibold shadow-xs'
                      : 'bg-slate-100/70 border-slate-200 text-slate-600 hover:bg-white'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Schedule</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActionType('publish')}
                  className={`py-2 px-3 rounded-lg border text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    actionType === 'publish'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-300 font-semibold shadow-xs'
                      : 'bg-slate-100/70 border-slate-200 text-slate-600 hover:bg-white'
                  }`}
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Publish</span>
                </button>
              </div>

              {/* Date & Time Picker if Scheduled */}
              {actionType === 'scheduled' && (
                <div className="pt-2 border-t border-slate-200 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-blue-600" />
                      Select Date & Time
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono">
                      Local Time ({Intl.DateTimeFormat().resolvedOptions().timeZone})
                    </span>
                  </div>
                  <input
                    type="datetime-local"
                    required={actionType === 'scheduled'}
                    min={getMinDateTime()}
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-900 text-xs focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                  <p className="text-[11px] text-slate-500">
                    The background scheduler polls every 15s to publish content when due.
                  </p>
                </div>
              )}
            </div>

            {/* Submit Action */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs shadow-xs flex items-center justify-center gap-2 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving Post...</span>
                  </>
                ) : (
                  <>
                    {actionType === 'scheduled' ? (
                      <Clock className="w-4 h-4" />
                    ) : actionType === 'publish' ? (
                      <Send className="w-4 h-4" />
                    ) : (
                      <FileText className="w-4 h-4" />
                    )}
                    <span>
                      {actionType === 'scheduled'
                        ? 'Confirm & Schedule Post'
                        : actionType === 'publish'
                        ? 'Publish Post Immediately'
                        : 'Save Post as Draft'}
                    </span>
                  </>
                )}
              </button>
            </div>

          </form>
        </div>

        {/* Right Column: Live Interactive Social Preview (5 cols) */}
        <div className="lg:col-span-5 space-y-4 sticky top-20">
          
          {/* Preview Navigation Tabs */}
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider text-slate-500 font-semibold">
              Live Preview
            </span>
            <div className="flex gap-1 p-1 rounded-lg bg-white border border-slate-200 text-xs shadow-xs">
              <button
                type="button"
                onClick={() => setPreviewPlatform('twitter')}
                className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                  previewPlatform === 'twitter'
                    ? 'bg-blue-50 text-blue-700 font-semibold border border-blue-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Twitter / X
              </button>
              <button
                type="button"
                onClick={() => setPreviewPlatform('linkedin')}
                className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                  previewPlatform === 'linkedin'
                    ? 'bg-blue-50 text-blue-700 font-semibold border border-blue-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                LinkedIn
              </button>
            </div>
          </div>

          {/* Social Preview Container */}
          {previewPlatform === 'twitter' ? (
            /* Twitter / X Mock Card (Clean Light SaaS Card) */
            <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs space-y-3 font-sans">
              
              {/* Tweet Header */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center font-bold text-white text-xs">
                    {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-slate-900 text-xs leading-tight">{user?.name || 'Your Name'}</span>
                      <span className="text-slate-500 text-[11px]">@{user?.name?.toLowerCase().replace(/\s+/g, '') || 'username'}</span>
                      <span className="text-slate-400 text-[11px]">&bull; Just now</span>
                    </div>
                    <span className="text-[10px] text-slate-500">Social Media Post Scheduler</span>
                  </div>
                </div>
                <div className="text-slate-700 font-bold text-sm">𝕏</div>
              </div>

              {/* Tweet Body */}
              <div className="text-slate-800 text-xs whitespace-pre-wrap leading-relaxed">
                {content || <span className="text-slate-400 italic">Your post text will appear here...</span>}
              </div>

              {/* Hashtags display */}
              {hashtags.length > 0 && (
                <div className="flex flex-wrap gap-1 text-blue-600 text-[11px]">
                  {hashtags.map((h, i) => (
                    <span key={i}>#{h}</span>
                  ))}
                </div>
              )}

              {/* Media Preview in Tweet */}
              {mediaPreview && (
                <div className="rounded-lg overflow-hidden border border-slate-200 mt-2 max-h-60 bg-slate-100">
                  <img src={mediaPreview} alt="Tweet preview" className="w-full h-full object-cover max-h-60" />
                </div>
              )}

              {/* Tweet Action Icons */}
              <div className="flex items-center justify-between text-slate-500 text-xs pt-3 border-t border-slate-100 px-1">
                <span className="flex items-center gap-1.5 hover:text-blue-600 cursor-pointer">
                  <MessageCircle className="w-3.5 h-3.5" /> 12
                </span>
                <span className="flex items-center gap-1.5 hover:text-emerald-600 cursor-pointer">
                  <Repeat className="w-3.5 h-3.5" /> 5
                </span>
                <span className="flex items-center gap-1.5 hover:text-rose-600 cursor-pointer">
                  <Heart className="w-3.5 h-3.5" /> 84
                </span>
                <span className="flex items-center gap-1.5 hover:text-blue-600 cursor-pointer">
                  <Bookmark className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>
          ) : (
            /* LinkedIn Mock Card */
            <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs space-y-3 font-sans">
              
              {/* LinkedIn Header */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center font-bold text-white text-xs">
                    {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-xs leading-tight flex items-center gap-1">
                      {user?.name || 'Your Name'}
                      <span className="text-slate-400 text-[11px] font-normal">&bull; 1st</span>
                    </h4>
                    <p className="text-[11px] text-slate-500 leading-tight">Software Engineer &bull; Tech Innovator</p>
                    <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                      Just now &bull; <Globe className="w-3 h-3" />
                    </p>
                  </div>
                </div>
                <span className="text-[11px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-bold border border-blue-200">
                  in
                </span>
              </div>

              {/* Title / Topic if provided */}
              {title && (
                <h5 className="font-bold text-slate-900 text-xs">{title}</h5>
              )}

              {/* LinkedIn Content */}
              <div className="text-slate-800 text-xs whitespace-pre-wrap leading-relaxed">
                {content || <span className="text-slate-400 italic">Your professional update will appear here...</span>}
              </div>

              {/* Hashtags */}
              {hashtags.length > 0 && (
                <div className="flex flex-wrap gap-1 text-blue-600 text-[11px] font-medium">
                  {hashtags.map((h, i) => (
                    <span key={i}>#{h}</span>
                  ))}
                </div>
              )}

              {/* Media in LinkedIn */}
              {mediaPreview && (
                <div className="rounded-lg overflow-hidden border border-slate-200 mt-2 max-h-60 bg-slate-100">
                  <img src={mediaPreview} alt="LinkedIn preview" className="w-full h-full object-cover max-h-60" />
                </div>
              )}

              {/* LinkedIn Engagement Bar */}
              <div className="flex items-center justify-between text-slate-500 text-xs pt-3 border-t border-slate-100 px-1">
                <span className="flex items-center gap-1.5 hover:text-blue-600 cursor-pointer">
                  <ThumbsUp className="w-3.5 h-3.5 text-blue-600" /> Like
                </span>
                <span className="flex items-center gap-1.5 hover:text-blue-600 cursor-pointer">
                  <MessageSquare className="w-3.5 h-3.5" /> Comment
                </span>
                <span className="flex items-center gap-1.5 hover:text-blue-600 cursor-pointer">
                  <Repeat className="w-3.5 h-3.5" /> Repost
                </span>
                <span className="flex items-center gap-1.5 hover:text-blue-600 cursor-pointer">
                  <Send className="w-3.5 h-3.5" /> Send
                </span>
              </div>
            </div>
          )}

          {/* Quick Tip Card */}
          <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200 text-xs text-blue-900 space-y-1">
            <p className="font-semibold flex items-center gap-1.5 text-blue-800">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              Pro Tip
            </p>
            <p className="text-[11px] text-blue-700 leading-relaxed">
              Posts scheduled here are automatically processed by the background engine. You can also generate viral copy in the AI Studio and export directly into this editor!
            </p>
          </div>

        </div>

      </div>

    </div>
  );
}
