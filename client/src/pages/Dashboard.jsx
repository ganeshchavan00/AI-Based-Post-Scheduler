import React, { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { loadUser } from '../features/auth/authSlice';
import { fetchDashboardStats } from '../features/posts/postsSlice';
import { 
  Sparkles, 
  Send, 
  Clock, 
  FileText, 
  Share2, 
  Calendar, 
  PlusCircle, 
  Layers, 
  ShieldCheck, 
  CheckCircle2, 
  ArrowRight,
  User,
  Activity,
  Bot,
  RefreshCw,
  CalendarClock,
  PenSquare
} from 'lucide-react';

export default function Dashboard() {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const { user, token } = useSelector((state) => state.auth);
  const { stats, recentPosts, loading } = useSelector((state) => state.posts);

  useEffect(() => {
    if (!user && token) {
      dispatch(loadUser());
    }
    dispatch(fetchDashboardStats());
  }, [dispatch, user, token]);

  const statCards = [
    { 
      label: 'Total Posts', 
      value: stats?.total ?? 0, 
      icon: Layers, 
      color: 'text-blue-600', 
      bg: 'bg-blue-50 border-blue-100', 
      link: '/posts' 
    },
    { 
      label: 'Published', 
      value: stats?.published ?? 0, 
      icon: Send, 
      color: 'text-emerald-600', 
      bg: 'bg-emerald-50 border-emerald-100', 
      link: '/posts' 
    },
    { 
      label: 'Scheduled Queue', 
      value: stats?.scheduled ?? 0, 
      icon: Clock, 
      color: 'text-blue-600', 
      bg: 'bg-blue-50 border-blue-100', 
      link: '/scheduled' 
    },
    { 
      label: 'Drafts', 
      value: stats?.draft ?? 0, 
      icon: FileText, 
      color: 'text-slate-600', 
      bg: 'bg-slate-50 border-slate-200', 
      link: '/posts' 
    },
  ];

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 md:p-8 space-y-6">
      
      {/* SaaS Welcome & Session Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-slate-900">
                Welcome back, {user?.name || 'Creator'}
              </h1>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                Connected
              </span>
            </div>
            <p className="text-slate-500 text-xs max-w-xl">
              Plan, generate AI-optimized captions, preview social cards, and schedule posts across supported networks.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => navigate('/create-post')}
              className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Create Post</span>
            </button>
            <Link
              to="/scheduled"
              className="px-3.5 py-2 rounded-lg bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium border border-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <Clock className="w-3.5 h-3.5 text-blue-600" />
              <span>Queue ({stats?.scheduled ?? 0})</span>
            </Link>
            <Link
              to="/posts"
              className="px-3.5 py-2 rounded-lg bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium border border-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <FileText className="w-3.5 h-3.5 text-slate-500" />
              <span>History</span>
            </Link>
          </div>
        </div>

        {/* Minimal User Account Strip */}
        <div className="mt-5 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-slate-400" />
              <strong className="text-slate-700 font-medium">{user?.email}</strong>
            </span>
            <span className="text-slate-300">|</span>
            <span className="flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-slate-400" />
              <span>Total in Database: <strong className="text-slate-700 font-medium">{stats?.total ?? 0}</strong></span>
            </span>
          </div>
          <span className="text-[11px] text-slate-400">Social Media Post Scheduler Production Environment</span>
        </div>
      </div>

      {/* Metric KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div
              key={i}
              onClick={() => navigate(stat.link)}
              className="p-5 rounded-xl bg-white border border-slate-200 hover:border-blue-300 shadow-xs flex items-center justify-between cursor-pointer transition-all hover:translate-y-[-1px]"
            >
              <div>
                <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">{stat.label}</p>
                <h3 className="text-2xl font-bold text-slate-900 mt-1">{stat.value}</h3>
              </div>
              <div className={`p-2.5 rounded-lg ${stat.bg} ${stat.color} border`}>
                <Icon className="w-5 h-5" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Grid: Workspaces + Recent Posts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Feature Workspaces (2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-600" />
                Workspaces
              </h2>
              <span className="text-[11px] text-slate-400">Core Modules</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              
              {/* Post Composer Card */}
              <div
                onClick={() => navigate('/create-post')}
                className="p-4 rounded-lg bg-slate-50/70 border border-slate-200 space-y-2.5 group hover:border-blue-400 hover:bg-white transition-all cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <div className="p-2 rounded-md bg-blue-50 text-blue-600 border border-blue-100">
                    <PenSquare className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 font-medium">
                    Composer
                  </span>
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition-colors flex items-center justify-between">
                    <span>Post Composer & Media</span>
                    <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-blue-600" />
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                    Compose posts with Multer media uploads and preview live cards for Twitter/X and LinkedIn.
                  </p>
                </div>
              </div>

              {/* AI Content Generator Card */}
              <div
                onClick={() => navigate('/ai-generator')}
                className="p-4 rounded-lg bg-slate-50/70 border border-slate-200 space-y-2.5 group hover:border-blue-400 hover:bg-white transition-all cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <div className="p-2 rounded-md bg-blue-50 text-blue-600 border border-blue-100">
                    <Bot className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 font-medium">
                    AI Studio
                  </span>
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition-colors flex items-center justify-between">
                    <span>AI Content Generator</span>
                    <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-blue-600" />
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                    Generate platform-optimized captions and viral hashtags tailored by tone and target audience.
                  </p>
                </div>
              </div>

              {/* Scheduled Queue Runner Card */}
              <div
                onClick={() => navigate('/scheduled')}
                className="p-4 rounded-lg bg-slate-50/70 border border-slate-200 space-y-2.5 group hover:border-blue-400 hover:bg-white transition-all cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <div className="p-2 rounded-md bg-blue-50 text-blue-600 border border-blue-100">
                    <CalendarClock className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 font-medium">
                    Automated
                  </span>
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition-colors flex items-center justify-between">
                    <span>Scheduled Queue Engine</span>
                    <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-blue-600" />
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                    Monitor upcoming posts with live countdowns, reschedule, or trigger immediate publishing bypass.
                  </p>
                </div>
              </div>

              {/* Social Accounts Card */}
              <div
                onClick={() => navigate('/social-accounts')}
                className="p-4 rounded-lg bg-slate-50/70 border border-slate-200 space-y-2.5 group hover:border-blue-400 hover:bg-white transition-all cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <div className="p-2 rounded-md bg-blue-50 text-blue-600 border border-blue-100">
                    <Share2 className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 font-medium">
                    Zernio API
                  </span>
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition-colors flex items-center justify-between">
                    <span>Social Account Connections</span>
                    <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-blue-600" />
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                    Connect Twitter, LinkedIn, Instagram via Zernio OAuth gateway and manage profile tokens.
                  </p>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* Recent Activity Feed (1 col) */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-600" />
                Recent Posts
              </h2>
              <button
                onClick={() => dispatch(fetchDashboardStats())}
                className="text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                title="Refresh feed"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-600' : ''}`} />
              </button>
            </div>

            {recentPosts.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-lg space-y-2">
                <p>No posts recorded yet.</p>
                <button
                  onClick={() => navigate('/create-post')}
                  className="text-blue-600 hover:underline font-medium cursor-pointer"
                >
                  Create your first post &rarr;
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {recentPosts.map((post) => (
                  <div
                    key={post._id}
                    className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5 hover:border-slate-300 transition-colors"
                  >
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-slate-700 uppercase tracking-wider text-[10px]">
                        {post.selectedPlatforms?.join(', ') || 'No Platform'}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-md font-medium capitalize text-[10px] ${
                          post.status === 'published'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : post.status === 'scheduled'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : post.status === 'cancelled'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}
                      >
                        {post.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-700 line-clamp-2 leading-relaxed">
                      {post.content}
                    </p>
                    <div className="text-[10px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-150">
                      <span>{new Date(post.createdAt).toLocaleDateString()}</span>
                      {post.hashtags?.length > 0 && (
                        <span className="text-blue-600 truncate max-w-[120px] font-medium">
                          #{post.hashtags[0]}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => navigate('/posts')}
            className="w-full mt-4 py-2 text-center rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
          >
            View All in Post History &rarr;
          </button>
        </div>

      </div>

    </div>
  );
}
