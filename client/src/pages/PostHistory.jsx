import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { fetchPosts, deletePost, clearPostMessages } from '../features/posts/postsSlice';
import { publishPost } from '../features/social/socialSlice';
import { 
  FileText, 
  Clock, 
  Send, 
  Search, 
  Trash2, 
  PlusCircle, 
  Filter, 
  Calendar, 
  Share2, 
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  ExternalLink
} from 'lucide-react';

const STATUS_BADGES = {
  draft: { label: 'Draft', bg: 'bg-slate-100 text-slate-700 border-slate-200' },
  scheduled: { label: 'Scheduled', bg: 'bg-blue-50 text-blue-700 border-blue-200' },
  published: { label: 'Published', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  failed: { label: 'Failed', bg: 'bg-rose-50 text-rose-700 border-rose-200' },
  publishing: { label: 'Publishing', bg: 'bg-blue-100 text-blue-800 border-blue-300' },
  cancelled: { label: 'Cancelled', bg: 'bg-amber-50 text-amber-700 border-amber-200' },
};

export default function PostHistory() {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const { posts, total, page, totalPages, loading, error, successMessage } = useSelector(
    (state) => state.posts
  );

  const [statusFilter, setStatusFilter] = useState('all');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [publishingId, setPublishingId] = useState(null);

  const handlePublishNow = async (id) => {
    setPublishingId(id);
    const result = await dispatch(publishPost(id));
    setPublishingId(null);
    if (!result.error) {
      dispatch(
        fetchPosts({
          status: statusFilter,
          platform: platformFilter,
          search: searchTerm,
          page: currentPage,
          limit: 8,
        })
      );
    }
  };

  useEffect(() => {
    dispatch(
      fetchPosts({
        status: statusFilter,
        platform: platformFilter,
        search: searchTerm,
        page: currentPage,
        limit: 8,
      })
    );
  }, [dispatch, statusFilter, platformFilter, searchTerm, currentPage]);

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this post?')) {
      await dispatch(deletePost(id));
      dispatch(
        fetchPosts({
          status: statusFilter,
          platform: platformFilter,
          search: searchTerm,
          page: currentPage,
          limit: 8,
        })
      );
    }
  };

  const handleRefresh = () => {
    dispatch(
      fetchPosts({
        status: statusFilter,
        platform: platformFilter,
        search: searchTerm,
        page: currentPage,
        limit: 8,
      })
    );
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 md:p-8 space-y-6">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            Post History
            <span className="text-[11px] px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 font-medium">
              {total} Posts
            </span>
          </h1>
          <p className="text-xs text-slate-500">View, search, filter, and manage your scheduled and published posts</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            className="p-2 rounded-lg bg-white border border-slate-200 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer shadow-xs"
            title="Refresh list"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
          </button>
          <button
            onClick={() => navigate('/create-post')}
            className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Create New Post</span>
          </button>
        </div>
      </div>

      {/* Messages */}
      {successMessage && (
        <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center justify-between">
          <span>{successMessage}</span>
          <button onClick={() => dispatch(clearPostMessages())} className="text-emerald-700 hover:text-emerald-900">
            &times;
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        
        {/* Search */}
        <div className="relative w-full md:w-80">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search className="w-3.5 h-3.5" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search posts by title or keyword..."
            className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 text-xs placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-100"
          />
        </div>

        {/* Dropdowns */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          {/* Status Filter */}
          <div className="flex items-center gap-1.5 w-1/2 md:w-auto">
            <Filter className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full md:w-auto px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 text-xs focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="draft">Drafts</option>
              <option value="scheduled">Scheduled</option>
              <option value="published">Published</option>
              <option value="failed">Failed</option>
            </select>
          </div>

          {/* Platform Filter */}
          <div className="flex items-center gap-1.5 w-1/2 md:w-auto">
            <Share2 className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
            <select
              value={platformFilter}
              onChange={(e) => {
                setPlatformFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full md:w-auto px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 text-xs focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="all">All Platforms</option>
              <option value="twitter">Twitter / X</option>
              <option value="linkedin">LinkedIn</option>
              <option value="facebook">Facebook</option>
              <option value="instagram">Instagram</option>
            </select>
          </div>
        </div>

      </div>

      {/* Post Grid */}
      {loading && posts.length === 0 ? (
        <div className="p-12 text-center text-slate-400 space-y-2">
          <RefreshCw className="w-5 h-5 animate-spin mx-auto text-blue-600" />
          <p className="text-xs">Loading posts from database...</p>
        </div>
      ) : posts.length === 0 ? (
        <div className="p-12 rounded-xl bg-white border border-slate-200 text-center space-y-3 shadow-xs">
          <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center mx-auto">
            <FileText className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-slate-800">No posts found</h2>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {searchTerm || statusFilter !== 'all' || platformFilter !== 'all'
                ? 'Try adjusting your filters or search keywords.'
                : 'You have not created any posts yet. Start by crafting your first post!'}
            </p>
          </div>
          <button
            onClick={() => navigate('/create-post')}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium cursor-pointer shadow-xs"
          >
            Create Your First Post
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {posts.map((post) => {
            const badge = STATUS_BADGES[post.status] || STATUS_BADGES.draft;
            const hasMedia = post.mediaUrls && post.mediaUrls.length > 0;

            return (
              <div
                key={post._id}
                className="p-5 rounded-xl bg-white border border-slate-200 hover:border-slate-300 shadow-xs flex flex-col justify-between transition-all hover:translate-y-[-1px] space-y-3.5 group"
              >
                
                {/* Header: Platforms & Status Badge */}
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    {/* Platforms */}
                    <div className="flex flex-wrap gap-1">
                      {post.selectedPlatforms?.map((p) => (
                        <span
                          key={p}
                          className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-semibold uppercase tracking-wider border border-slate-200"
                        >
                          {p}
                        </span>
                      ))}
                    </div>

                    {/* Status Badge */}
                    <span className={`px-2 py-0.5 rounded-md border text-[11px] font-medium ${badge.bg}`}>
                      {badge.label}
                    </span>
                  </div>

                  {/* Title if present */}
                  {post.title && (
                    <h3 className="text-sm font-semibold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-1">
                      {post.title}
                    </h3>
                  )}

                  {/* Content Preview */}
                  <p className="text-xs text-slate-700 whitespace-pre-wrap line-clamp-4 leading-relaxed">
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

                  {/* Image attachment thumbnail */}
                  {hasMedia && (
                    <div className="rounded-lg overflow-hidden border border-slate-200 h-32 bg-slate-100">
                      <img
                        src={`http://localhost:5000${post.mediaUrls[0].url}`}
                        alt="Post media"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                  {/* Error Message if post failed */}
                  {post.errorMessage && (
                    <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-[11px] flex items-start gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-rose-600" />
                      <span className="line-clamp-2">{post.errorMessage}</span>
                    </div>
                  )}

                  {/* Provider Dispatch Results */}
                  {post.providerResults && post.providerResults.length > 0 && (
                    <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-[10px] space-y-1.5">
                      <span className="font-semibold text-slate-600 block uppercase tracking-wider text-[9px]">Provider Confirmation:</span>
                      {post.providerResults.map((pr, idx) => (
                        <div key={idx} className="flex flex-col gap-0.5 text-slate-600 border-b border-slate-100 last:border-0 pb-1 last:pb-0">
                          <div className="flex items-center justify-between">
                            <span className="capitalize font-medium flex items-center gap-1">
                              {pr.provider}
                              <span className={`text-[9px] px-1.5 py-0.2 rounded font-semibold ${
                                pr.status === 'published'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : pr.status === 'failed'
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}>
                                {pr.status}
                              </span>
                            </span>
                            {pr.platformPostUrl ? (
                              <a
                                href={pr.platformPostUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-blue-600 hover:text-blue-800 flex items-center gap-0.5 font-medium hover:underline text-[10px]"
                              >
                                View Post <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            ) : pr.providerPostId ? (
                              <span className="font-mono text-slate-600 truncate max-w-[120px]" title={pr.providerPostId}>
                                ID: {pr.providerPostId}
                              </span>
                            ) : null}
                          </div>
                          {pr.errorMessage && (
                            <span className="text-[10px] text-rose-600 line-clamp-1" title={pr.errorMessage}>
                              {pr.errorMessage}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Footer: Date & Actions */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                  <div className="flex items-center gap-1.5">
                    {post.status === 'scheduled' ? (
                      <>
                        <Clock className="w-3.5 h-3.5 text-blue-600" />
                        <span className="text-blue-700 font-medium">
                          {new Date(post.scheduledAt).toLocaleString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </>
                    ) : (
                      <>
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>
                          {new Date(post.createdAt).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5">
                    {post.status !== 'published' && (
                      <button
                        type="button"
                        onClick={() => handlePublishNow(post._id)}
                        disabled={publishingId === post._id}
                        className="px-2 py-1 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
                        title="Publish immediately"
                      >
                        <Send className={`w-3 h-3 ${publishingId === post._id ? 'animate-spin' : ''}`} />
                        <span>{publishingId === post._id ? 'Publishing...' : 'Publish'}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDelete(post._id)}
                      className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                      title="Delete post"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-slate-200 text-xs text-slate-500">
          <span>
            Page {page} of {totalPages} ({total} total posts)
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-md bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 cursor-pointer shadow-xs"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-md bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 cursor-pointer shadow-xs"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
