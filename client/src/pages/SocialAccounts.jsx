import React, { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useSearchParams } from 'react-router-dom';
import { 
  fetchAccounts, 
  fetchConnectUrl,
  connectAccount, 
  disconnectAccount, 
  syncAccounts,
  fetchIntegrationStatus,
  clearSocialMessages 
} from '../features/social/socialSlice';
import { 
  Share2, 
  CheckCircle2, 
  PlusCircle, 
  Trash2, 
  RefreshCw, 
  ExternalLink, 
  AlertCircle, 
  ShieldCheck, 
  Globe, 
  Radio,
  Lock,
  X,
  KeyRound,
  AlertTriangle,
  Sparkles
} from 'lucide-react';

const SUPPORTED_NETWORKS = [
  {
    id: 'twitter',
    name: 'Twitter / X',
    handlePrefix: '@',
    badgeBg: 'bg-blue-50 text-blue-700 border-blue-200',
    iconText: '𝕏',
    description: 'Post tweets, threads, and media via Zernio unified API (Note: X requires billing method on Zernio).',
    scopes: 'tweet.read, tweet.write, users.read',
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    handlePrefix: 'in/',
    badgeBg: 'bg-blue-50 text-blue-700 border-blue-200',
    iconText: 'in',
    description: 'Share articles, updates, and professional media posts.',
    scopes: 'w_member_social, r_liteprofile',
  },
  {
    id: 'facebook',
    name: 'Facebook Pages',
    handlePrefix: 'fb.com/',
    badgeBg: 'bg-blue-50 text-blue-700 border-blue-200',
    iconText: 'fb',
    description: 'Publish updates and visual media to your organization pages.',
    scopes: 'pages_manage_posts, pages_read_engagement',
  },
  {
    id: 'instagram',
    name: 'Instagram Business',
    handlePrefix: '@',
    badgeBg: 'bg-blue-50 text-blue-700 border-blue-200',
    iconText: 'ig',
    description: 'Schedule image and carousel posts with hashtags.',
    scopes: 'instagram_basic, instagram_content_publish',
  },
];

export default function SocialAccounts() {
  const dispatch = useDispatch();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useSelector((state) => state.auth);
  const { accounts, integrationStatus, loading, connecting, syncing, error, successMessage } = useSelector(
    (state) => state.social
  );

  // Modals & local state
  const [configModalNetwork, setConfigModalNetwork] = useState(null);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [processingCallback, setProcessingCallback] = useState(false);
  const [simulatedDisplayName, setSimulatedDisplayName] = useState('');
  const [simulatedUsername, setSimulatedUsername] = useState('');
  const callbackHandledRef = useRef(false);

  // Initial load
  useEffect(() => {
    dispatch(fetchAccounts());
    dispatch(fetchIntegrationStatus());
  }, [dispatch]);

  // Handle OAuth callback parameters from Zernio redirect
  useEffect(() => {
    if (callbackHandledRef.current) return;

    const errorParam = searchParams.get('error') || searchParams.get('error_description');
    const connectedPlatform = searchParams.get('connected') || searchParams.get('platform');
    const accountId = searchParams.get('accountId');
    const username = searchParams.get('username') || '';
    const profileId = searchParams.get('profileId') || '';
    const displayName = searchParams.get('displayName') || searchParams.get('name') || '';

    // Case 1: OAuth Error or Cancellation
    if (errorParam) {
      callbackHandledRef.current = true;
      dispatch({
        type: 'social/connectAccount/rejected',
        payload: `OAuth Connection Failed: ${errorParam}`,
      });
      setSearchParams({}, { replace: true });
      return;
    }

    // Case 2: Successful OAuth authorization callback
    if (connectedPlatform && accountId) {
      callbackHandledRef.current = true;
      setProcessingCallback(true);

      dispatch(
        connectAccount({
          provider: connectedPlatform.toLowerCase(),
          providerAccountId: accountId,
          accountDisplayName: displayName || `${username || 'Authorized'} (${connectedPlatform.toUpperCase()})`,
          accountUsername: username,
          profileId,
          isSimulated: false,
        })
      ).finally(() => {
        setProcessingCallback(false);
        setSearchParams({}, { replace: true });
      });
    }
  }, [searchParams, dispatch, setSearchParams]);

  // Connect button handler
  const handleInitiateConnect = async (network) => {
    dispatch(clearSocialMessages());

    // Request real OAuth connect authorization URL from Zernio via backend
    const redirectUrl = `${window.location.origin}/social-accounts`;
    const actionResult = await dispatch(
      fetchConnectUrl({ platform: network.id, redirectUrl })
    );

    if (fetchConnectUrl.fulfilled.match(actionResult)) {
      const { authUrl } = actionResult.payload;
      if (authUrl) {
        setIsRedirecting(true);
        window.location.href = authUrl;
        return;
      }
    }

    // If credentials are missing or connection generation rejected, show config modal
    setConfigModalNetwork(network);
    setSimulatedDisplayName(`${user?.name || 'Creator'} (${network.name})`);
    setSimulatedUsername(`${user?.name?.toLowerCase().replace(/\s+/g, '_') || 'user'}_${network.id}`);
  };

  // Developer sandbox fallback connection
  const handleConnectSimulated = async (e) => {
    e.preventDefault();
    if (!configModalNetwork) return;

    await dispatch(
      connectAccount({
        provider: configModalNetwork.id,
        providerAccountId: `sim_${configModalNetwork.id}_${Date.now()}`,
        accountDisplayName: `${simulatedDisplayName} [Simulated]`,
        accountUsername: simulatedUsername,
        isSimulated: true,
      })
    );

    setConfigModalNetwork(null);
  };

  const handleDisconnect = async (id, name) => {
    if (window.confirm(`Are you sure you want to disconnect ${name}?`)) {
      await dispatch(disconnectAccount(id));
    }
  };

  const handleRefresh = () => {
    dispatch(fetchAccounts());
    dispatch(fetchIntegrationStatus());
  };

  const isConfigured = Boolean(integrationStatus?.configured);

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 md:p-8 space-y-6">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            Social Accounts & Channels
            <span className="text-[11px] px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 font-medium">
              Zernio Unified OAuth
            </span>
          </h1>
          <p className="text-xs text-slate-500">
            Link and manage live social media accounts via official Zernio OAuth redirects
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isConfigured && (
            <button
              onClick={() => dispatch(syncAccounts())}
              disabled={syncing || loading}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
              title="Import all accounts already authorized in your Zernio profile"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : 'Sync Zernio Accounts'}
            </button>
          )}

          <button
            onClick={handleRefresh}
            className="p-2 rounded-lg bg-white border border-slate-200 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer shadow-xs"
            title="Refresh accounts & status"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Processing Callback Spinner Overlay */}
      {processingCallback && (
        <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-xs flex items-center gap-3">
          <RefreshCw className="w-4 h-4 animate-spin text-blue-600 shrink-0" />
          <div>
            <p className="font-semibold">Completing OAuth Connection with Zernio...</p>
            <p className="text-blue-600 text-[11px]">Verifying account permissions and storing secure provider record.</p>
          </div>
        </div>
      )}

      {/* Redirecting Spinner Banner */}
      {isRedirecting && (
        <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-xs flex items-center gap-3">
          <RefreshCw className="w-4 h-4 animate-spin text-blue-600 shrink-0" />
          <div>
            <p className="font-semibold">Redirecting to Social Provider Authorization...</p>
            <p className="text-blue-600 text-[11px]">Connecting to the official OAuth consent screen.</p>
          </div>
        </div>
      )}

      {/* Integration Status Bar */}
      <div className={`p-4 rounded-xl border text-xs flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs ${
        isConfigured 
          ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900' 
          : 'bg-amber-50/90 border-amber-200 text-amber-900'
      }`}>
        <div className="flex items-start md:items-center gap-2.5">
          {isConfigured ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5 md:mt-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5 md:mt-0" />
          )}
          <div>
            <div className="flex items-center gap-2">
              <strong className="font-semibold">
                {isConfigured ? 'Zernio API Connected (Live Mode)' : 'Live Social Media Integration: API Key Not Configured'}
              </strong>
              <span className={`text-[10px] px-2 py-0.2 rounded font-mono ${
                isConfigured ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
              }`}>
                {integrationStatus?.baseUrl || 'https://zernio.com/api/v1'}
              </span>
            </div>
            <p className="text-[11px] mt-0.5 text-slate-600">
              {isConfigured
                ? 'OAuth redirects and multi-channel publishing are active using official Zernio endpoints.'
                : 'ZERNIO_API_KEY is not set in server/.env. Connecting real accounts requires an active Zernio API key.'}
            </p>
          </div>
        </div>

        {!isConfigured && (
          <a
            href="https://zernio.com"
            target="_blank"
            rel="noreferrer"
            className="self-start md:self-auto px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-medium text-[11px] flex items-center gap-1 transition-colors cursor-pointer shadow-xs shrink-0"
          >
            <span>Get Zernio Key</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button 
            onClick={() => dispatch(clearSocialMessages())} 
            className="text-emerald-700 hover:text-emerald-900 cursor-pointer font-bold text-sm"
          >
            &times;
          </button>
        </div>
      )}

      {error && (
        <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button 
            onClick={() => dispatch(clearSocialMessages())} 
            className="text-rose-700 hover:text-rose-900 cursor-pointer font-bold text-sm"
          >
            &times;
          </button>
        </div>
      )}

      {/* Connected Accounts Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
            <Radio className="w-3.5 h-3.5 text-emerald-600" />
            Active Connected Accounts ({accounts.length})
          </h2>
          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <span>
              Real: <strong className="text-emerald-700">{accounts.filter(a => !a.isSimulated).length}</strong>
            </span>
            <span>&bull;</span>
            <span>
              Simulated: <strong className="text-amber-700">{accounts.filter(a => a.isSimulated).length}</strong>
            </span>
          </div>
        </div>

        {accounts.length === 0 ? (
          <div className="p-8 rounded-xl bg-white border border-dashed border-slate-200 text-center space-y-2 shadow-xs">
            <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center mx-auto">
              <Share2 className="w-5 h-5" />
            </div>
            <p className="text-xs font-semibold text-slate-800">No social accounts connected yet</p>
            <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
              Connect a platform from the catalog below to enable real publishing and automated scheduling.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {accounts.map((acc) => {
              const network = SUPPORTED_NETWORKS.find((n) => n.id === acc.provider);
              const isSimulated = Boolean(acc.isSimulated);

              return (
                <div
                  key={acc._id}
                  className={`p-5 rounded-xl bg-white border shadow-xs flex flex-col justify-between space-y-4 transition-all ${
                    isSimulated 
                      ? 'border-amber-200 hover:border-amber-300' 
                      : 'border-slate-200 hover:border-blue-300'
                  }`}
                >
                  <div className="space-y-3">
                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-xs ${
                          isSimulated ? 'bg-amber-600' : 'bg-blue-600'
                        }`}>
                          {network?.iconText || acc.provider.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-900 text-xs line-clamp-1">{acc.accountDisplayName}</h3>
                          <p className="text-[11px] text-slate-500">
                            {network?.handlePrefix}{acc.accountUsername || acc.providerAccountId}
                          </p>
                        </div>
                      </div>

                      {/* Explicit Account Classification Badge */}
                      {isSimulated ? (
                        <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-semibold flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-amber-600" />
                          Simulated
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Live OAuth
                        </span>
                      )}
                    </div>

                    {/* Metadata Card */}
                    <div className={`p-3 rounded-lg border space-y-1.5 text-[11px] ${
                      isSimulated 
                        ? 'bg-amber-50/50 border-amber-100 text-amber-900' 
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}>
                      <div className="flex justify-between">
                        <span>Platform:</span>
                        <span className="text-slate-800 capitalize font-medium">{acc.provider}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Account ID:</span>
                        <span className="font-mono text-slate-700 truncate max-w-[140px]">{acc.providerAccountId}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Channel Mode:</span>
                        <span className={isSimulated ? 'text-amber-700 font-semibold' : 'text-emerald-700 font-semibold'}>
                          {isSimulated ? 'Local Sandbox (Simulated)' : 'Real Provider Verified'}
                        </span>
                      </div>
                      {acc.zernioProfileId && (
                        <div className="flex justify-between">
                          <span>Profile ID:</span>
                          <span className="font-mono text-slate-500 truncate max-w-[140px]">{acc.zernioProfileId}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Disconnect button */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-[11px] text-slate-400">
                      Synced {new Date(acc.lastSyncAt || acc.createdAt).toLocaleDateString()}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDisconnect(acc._id, acc.accountDisplayName)}
                      className="px-2.5 py-1 rounded-md text-slate-500 hover:text-rose-600 hover:bg-rose-50 text-xs transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Disconnect</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Supported Platforms Directory */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Supported Platforms Catalog
          </h2>
          <span className="text-[11px] text-slate-400">Direct OAuth Link</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {SUPPORTED_NETWORKS.map((network) => {
            const connectedAccounts = accounts.filter((a) => a.provider === network.id);
            const isConnected = connectedAccounts.length > 0;
            const hasRealAccount = connectedAccounts.some((a) => !a.isSimulated);

            return (
              <div
                key={network.id}
                className="p-5 rounded-xl bg-white border border-slate-200 hover:border-slate-300 shadow-xs flex flex-col justify-between space-y-3.5 transition-all"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                      {network.iconText}
                    </span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${
                      hasRealAccount
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : isConnected
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : 'bg-slate-100 text-slate-600 border border-slate-200'
                    }`}>
                      {hasRealAccount ? 'Live Linked' : isConnected ? 'Simulated' : 'Available'}
                    </span>
                  </div>
                  <h3 className="font-bold text-slate-900 text-sm">{network.name}</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">{network.description}</p>
                </div>

                <div className="pt-3 border-t border-slate-100 space-y-2">
                  <div className="text-[10px] text-slate-400 font-mono truncate">
                    Scopes: {network.scopes}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleInitiateConnect(network)}
                    disabled={connecting}
                    className="w-full py-1.5 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>{isConnected ? 'Connect Another' : `Connect ${network.name}`}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Official Zernio Architecture Guide */}
      <div className="p-6 rounded-xl bg-white border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-600" />
            <h3 className="font-bold text-slate-900 text-xs">Zernio Integration & Security Architecture</h3>
          </div>
          <a
            href="https://docs.zernio.com"
            target="_blank"
            rel="noreferrer"
            className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 font-medium"
          >
            <span>docs.zernio.com</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-600">
          <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
            <h4 className="font-semibold text-slate-900 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-blue-600" />
              1. Real OAuth Authorization
            </h4>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Connect calls <code className="text-blue-700 font-mono">GET /v1/connect/:platform</code>, redirects to provider login, and returns back via OAuth callback.
            </p>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
            <h4 className="font-semibold text-slate-900 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-blue-600" />
              2. Credentials Never Exposed
            </h4>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Provider OAuth secrets stay secured in Zernio infrastructure. Client stores only provider account IDs and metadata.
            </p>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
            <h4 className="font-semibold text-slate-900 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              3. Real Multi-Dispatch
            </h4>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Publishing dispatches via <code className="text-blue-700 font-mono">POST /v1/posts</code> with real account IDs and records live provider response payloads.
            </p>
          </div>
        </div>
      </div>

      {/* Configuration Required Modal & Developer Sandbox Modal */}
      {configModalNetwork && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="w-full max-w-lg p-6 rounded-xl bg-white border border-slate-200 shadow-xl space-y-5">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center text-xs font-bold">
                  {configModalNetwork.iconText}
                </span>
                <h3 className="font-bold text-slate-900 text-sm">
                  Connect {configModalNetwork.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setConfigModalNetwork(null)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Clear Configuration Alert */}
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 space-y-2 text-xs text-amber-900">
              <div className="flex items-center gap-2 font-semibold text-amber-800">
                <KeyRound className="w-4 h-4 text-amber-600" />
                <span>Live Zernio API Key Required for Real OAuth</span>
              </div>
              <p className="text-[11px] text-amber-700 leading-relaxed">
                To redirect to the real <strong>{configModalNetwork.name}</strong> OAuth authorization flow, a valid <code className="bg-amber-100 px-1 py-0.5 rounded font-mono">ZERNIO_API_KEY</code> must be configured in <code className="bg-amber-100 px-1 py-0.5 rounded font-mono">server/.env</code>.
              </p>
              <div className="bg-white/80 p-3 rounded-lg border border-amber-200 space-y-1 text-[11px] text-slate-700">
                <p className="font-medium text-slate-800">Setup steps for real social accounts:</p>
                <ol className="list-decimal pl-4 space-y-0.5 text-slate-600">
                  <li>Get an API key at <a href="https://zernio.com" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">zernio.com</a></li>
                  <li>Open <code className="text-slate-800 font-mono">server/.env</code> and set <code className="text-slate-800 font-mono">ZERNIO_API_KEY=your_key</code></li>
                  <li>Restart the backend server and click Connect again</li>
                </ol>
              </div>
            </div>

            {/* Developer Sandbox Option */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                  Developer Sandbox Mode
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-200 text-slate-700 font-medium">
                  Test Account
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                For development and UI evaluation without live credentials, you may create a simulated test account. It will be clearly labeled as <strong>[Simulated]</strong> throughout the application.
              </p>

              <form onSubmit={handleConnectSimulated} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-700 block">Display Name</label>
                    <input
                      type="text"
                      required
                      value={simulatedDisplayName}
                      onChange={(e) => setSimulatedDisplayName(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-900 text-xs focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-700 block">Username / Handle</label>
                    <input
                      type="text"
                      required
                      value={simulatedUsername}
                      onChange={(e) => setSimulatedUsername(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-900 text-xs focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setConfigModalNetwork(null)}
                    className="flex-1 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium cursor-pointer"
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium cursor-pointer shadow-xs"
                  >
                    Connect Simulated Account
                  </button>
                </div>
              </form>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
