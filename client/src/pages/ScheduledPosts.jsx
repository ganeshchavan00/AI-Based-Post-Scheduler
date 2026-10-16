import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  fetchPosts,
  deletePost,
  cancelSchedule,
  reschedulePost,
  publishPostNow,
  runDueScheduler,
  clearPostMessages,
} from '../features/posts/postsSlice';
import {
  Clock,
  Calendar,
  Send,
  Trash2,
  RefreshCw,
  PlusCircle,
  XCircle,
  AlertCircle,
  CheckCircle2,
  CalendarClock,
  Play,
  X,
} from 'lucide-react';

export default function ScheduledPosts() {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const { posts, loading, actionLoadingId, error, successMessage } = useSelector(
    (state) => state.posts
  );

  // Local state
  const [platformFilter, setPlatformFilter] = useState('all');
  const [rescheduleModalPost, setRescheduleModalPost] = useState(null);
  const [newScheduleDate, setNewScheduleDate] = useState('');
  const [modalError, setModalError] = useState(null);
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);

  // Fetch only scheduled posts
  const loadScheduledPosts = () => {
    dispatch(
      fetchPosts({
        status: 'scheduled',
        platform: platformFilter,
        page: 1,
        limit: 50,
      })
    );
  };

  useEffect(() => {
    loadScheduledPosts();
  }, [dispatch, platformFilter]);

  // Dismiss banner after 4 seconds
  useEffect(() => {
    if (successMessage || error) {
      const timer = setTimeout(() => {
        dispatch(clearPostMessages());
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [successMessage, error, dispatch]);

  // Publish Now action
  const handlePublishNow = async (id) => {
    if (window.confirm('Do you want to publish this post immediately and bypass the scheduled time?')) {
      const result = await dispatch(publishPostNow(id));
      if (!result.error) {
        loadScheduledPosts();
      }
    }
  };

  // Cancel Schedule action
  const handleCancelSchedule = async (id, toDraft = false) => {
    const promptMsg = toDraft
      ? 'Cancel schedule and return this post to drafts?'
      : 'Cancel this scheduled post?';
    if (window.confirm(promptMsg)) {
      await dispatch(cancelSchedule({ id, toDraft }));
      loadScheduledPosts();
    }
  };

  // Delete action
  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this scheduled post? This cannot be undone.')) {
      await dispatch(deletePost(id));
      loadScheduledPosts();
    }
  };

  // Open reschedule modal
  const openRescheduleModal = (post) => {
    setRescheduleModalPost(post);
    setModalError(null);
    if (post.scheduledAt) {
      const d = new Date(post.scheduledAt);
      d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
      setNewScheduleDate(d.toISOString().slice(0, 16));
    } else {
      const nextHour = new Date(Date.now() + 60 * 60 * 1000);
      nextHour.setMinutes(nextHour.getMinutes() - nextHour.getTimezoneOffset());
      setNewScheduleDate(nextHour.toISOString().slice(0, 16));
    }
  };

  // Submit reschedule
  const handleRescheduleSubmit = async (e) => {
    e.preventDefault();
    if (!newScheduleDate) {
      setModalError('Please pick a date and time.');
      return;
    }

    const picked = new Date(newScheduleDate);
    if (picked <= new Date()) {
      setModalError('Scheduled time must be in the future.');
      return;
    }

    setModalError(null);
    const result = await dispatch(
      reschedulePost({
        id: rescheduleModalPost._id,
        scheduledAt: picked.toISOString(),
      })
    );

    if (!result.error) {
      setRescheduleModalPost(null);
      loadScheduledPosts();
    } else {
      setModalError(result.payload || 'Failed to reschedule post.');
    }
  };

  // Manual trigger of due runner
  const handleRunQueueNow = async () => {
    setIsProcessingQueue(true);
    await dispatch(runDueScheduler());
    loadScheduledPosts();
    setIsProcessingQueue(false);
  };

  // Helper for human-readable time remaining
  const getTimeRemaining = (scheduledAt) => {
    const diffMs = new Date(scheduledAt) - new Date();
    if (diffMs <= 0) return 'Due now (processing...)';

    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) {
      return `Publishes in ${diffDays} day${diffDays > 1 ? 's' : ''}`;
    }
    if (diffHours > 0) {
      const remMins = diffMins % 60;
      return `Publishes in ${diffHours}h ${remMins}m`;
    }
    return `Publishes in ${diffMins} min${diffMins > 1 ? 's' : ''}`;
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 md:p-8 space-y-6">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            Scheduled Queue
            <span className="text-[11px] px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 font-medium">
              {posts.length} Queued
            </span>
          </h1>
          <p className="text-xs text-slate-500">
            Timeline of upcoming social posts awaiting automated dispatch
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRunQueueNow}
            disabled={isProcessingQueue}
            className="px-3.5 py-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 shadow-xs"
            title="Trigger background queue processor immediately"
          >
            <Play className={`w-3.5 h-3.5 text-blue-600 ${isProcessingQueue ? 'animate-spin' : ''}`} />
            <span>{isProcessingQueue ? 'Processing...' : 'Run Due Queue'}</span>
          </button>

          <button
            onClick={loadScheduledPosts}
            className="p-2 rounded-lg bg-white border border-slate-200 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer shadow-xs"
            title="Refresh queue"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
          </button>

          <button
            onClick={() => navigate('/create-post')}
            className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Schedule Post</span>
          </button>
        </div>
      </div>

      {/* Scheduler Engine Status Alert */}
      <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center shrink-0">
            <CalendarClock className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-800">Background Scheduler Active</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            </div>
            <p className="text-[11px] text-slate-500">
              The automated daemon polls MongoDB every 15 seconds to dispatch due content via Zernio multi-platform API.
            </p>
          </div>
        </div>

        {/* Filter by Platform */}
        <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-lg border border-slate-200 text-xs">
          <button
            onClick={() => setPlatformFilter('all')}
            className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
              platformFilter === 'all'
                ? 'bg-white text-blue-700 font-semibold shadow-xs border border-slate-200/80'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setPlatformFilter('twitter')}
            className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
              platformFilter === 'twitter'
                ? 'bg-white text-blue-700 font-semibold shadow-xs border border-slate-200/80'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Twitter/X
          </button>
          <button
            onClick={() => setPlatformFilter('linkedin')}
            className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
              platformFilter === 'linkedin'
                ? 'bg-white text-blue-700 font-semibold shadow-xs border border-slate-200/80'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            LinkedIn
          </button>
        </div>
      </div>

      {/* Messages */}
      {successMessage && (
        <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => dispatch(clearPostMessages())}>
            <X className="w-3.5 h-3.5 text-emerald-600 hover:text-emerald-800" />
          </button>
        </div>
      )}

      {error && (
        <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
          <button onClick={() => dispatch(clearPostMessages())}>
            <X className="w-3.5 h-3.5 text-rose-600 hover:text-rose-800" />
          </button>
        </div>
      )}

      {/* Posts Queue List */}
      {loading ? (
        <div className="p-16 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
          <RefreshCw className="w-5 h-5 animate-spin text-blue-600" />
          <span>Loading scheduled posts queue...</span>
        </div>
      ) : posts.length === 0 ? (
        <div className="p-12 rounded-xl bg-white border border-slate-200 text-center space-y-3 shadow-xs">
          <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center mx-auto">
            <CalendarClock className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Your schedule queue is empty</h2>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-0.5">
              No posts are currently waiting in the dispatch timeline. Create a post and pick a future date to schedule it.
            </p>
          </div>
          <button
            onClick={() => navigate('/create-post')}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs shadow-xs inline-flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Schedule Post</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => {
            const hasMedia = post.mediaUrls && post.mediaUrls.length > 0;
            const isLoadingThis = actionLoadingId === post._id;
            const scheduledDate = new Date(post.scheduledAt);
            const remainingLabel = getTimeRemaining(post.scheduledAt);

            return (
              <div
                key={post._id}
                className="p-5 rounded-xl bg-white border border-slate-200 hover:border-slate-300 transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xs"
              >
                {/* Left Info & Content */}
                <div className="space-y-2 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Platform Tags */}
                    {post.selectedPlatforms?.map((p) => (
                      <span
                        key={p}
                        className="px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase bg-slate-100 text-slate-700 border border-slate-200"
                      >
                        {p}
                      </span>
                    ))}

                    {/* Countdown Badge */}
                    <span className="px-2.5 py-0.5 rounded-md text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-blue-600" />
                      <span>{remainingLabel}</span>
                    </span>

                    {/* Exact Date */}
                    <span className="text-[11px] text-slate-500 flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      <span>
                        {scheduledDate.toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </span>
                  </div>

                  {/* Title & Preview */}
                  {post.title && (
                    <h3 className="text-xs font-semibold text-slate-900 truncate">{post.title}</h3>
                  )}
                  <p className="text-xs text-slate-700 line-clamp-2 leading-relaxed">
                    {post.content}
                  </p>

                  {/* Hashtags */}
                  {post.hashtags && post.hashtags.length > 0 && (
                    <div className="flex flex-wrap gap-1 text-[11px] text-blue-600 font-medium">
                      {post.hashtags.map((h, i) => (
                        <span key={i}>#{h}</span>
                      ))}
                    </div>
                  )}

                  {/* Media Thumbnail */}
                  {hasMedia && (
                    <div className="flex items-center gap-2 pt-1">
                      <div className="w-10 h-10 rounded-md overflow-hidden border border-slate-200 bg-slate-100 shrink-0">
                        <img
                          src={`http://localhost:5000${post.mediaUrls[0].url}`}
                          alt="Thumbnail"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.target.style.display = 'none';
                          }}
                        />
                      </div>
                      <span className="text-[11px] text-slate-500">
                        {post.mediaUrls.length} attached file(s)
                      </span>
                    </div>
                  )}
                </div>

                {/* Right Action Buttons */}
                <div className="flex flex-wrap items-center gap-1.5 self-end md:self-center shrink-0">
                  {/* Publish Now */}
                  <button
                    onClick={() => handlePublishNow(post._id)}
                    disabled={isLoadingThis}
                    className="px-2.5 py-1.5 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
                    title="Publish right now without waiting"
                  >
                    <Send className={`w-3 h-3 ${isLoadingThis ? 'animate-spin' : ''}`} />
                    <span>Publish Now</span>
                  </button>

                  {/* Reschedule */}
                  <button
                    onClick={() => openRescheduleModal(post)}
                    disabled={isLoadingThis}
                    className="px-2.5 py-1.5 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
                    title="Change scheduled time"
                  >
                    <CalendarClock className="w-3 h-3" />
                    <span>Reschedule</span>
                  </button>

                  {/* Cancel Schedule */}
                  <button
                    onClick={() => handleCancelSchedule(post._id, false)}
                    disabled={isLoadingThis}
                    className="px-2.5 py-1.5 rounded-md bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
                    title="Cancel scheduled dispatch"
                  >
                    <XCircle className="w-3 h-3" />
                    <span>Cancel</span>
                  </button>

                  {/* Delete */}
                  <button
                    onClick={() => handleDelete(post._id)}
                    disabled={isLoadingThis}
                    className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer disabled:opacity-50"
                    title="Delete post permanently"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Reschedule Modal */}
      {rescheduleModalPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl bg-white border border-slate-200 p-6 shadow-xl space-y-4">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-slate-900 font-semibold text-sm">
                <CalendarClock className="w-4 h-4 text-blue-600" />
                <span>Reschedule Post</span>
              </div>
              <button
                onClick={() => setRescheduleModalPost(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {modalError && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleRescheduleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Select New Publish Date & Time
                </label>
                <input
                  type="datetime-local"
                  value={newScheduleDate}
                  onChange={(e) => setNewScheduleDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-900 text-xs focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                  required
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Must be set to a future date and time.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-500 space-y-1">
                <p className="font-medium text-slate-700">Content:</p>
                <p className="line-clamp-2 italic">{rescheduleModalPost.content}</p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setRescheduleModalPost(null)}
                  className="px-3 py-1.5 rounded-lg text-xs text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors cursor-pointer shadow-xs"
                >
                  Save Schedule
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
}
