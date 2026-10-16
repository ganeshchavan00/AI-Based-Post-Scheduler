import SocialAccount from '../models/SocialAccount.js';
import Post from '../models/Post.js';
import {
  checkZernioStatus,
  getZernioApiKey,
  getConnectAuthUrl,
  verifyConnectedAccount,
  syncZernioAccounts,
  publishToSocial,
} from '../services/zernio.service.js';

/**
 * Get Zernio integration configuration status
 * Route: GET /api/social/status
 */
export const getIntegrationStatus = async (req, res, next) => {
  try {
    const status = await checkZernioStatus();
    return res.status(200).json({
      success: true,
      status,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all connected accounts for the logged-in user
 * Route: GET /api/social/accounts
 */
export const getAccounts = async (req, res, next) => {
  try {
    const accounts = await SocialAccount.find({ userId: req.user._id }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: accounts.length,
      accounts,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get OAuth connection URL for a platform
 * Route: GET /api/social/connect-url
 */
export const getConnectUrl = async (req, res, next) => {
  try {
    const { platform, redirectUrl } = req.query;

    if (!platform) {
      return res.status(400).json({
        success: false,
        message: 'Platform is required (e.g. twitter, linkedin, facebook, instagram).',
      });
    }

    const apiKey = getZernioApiKey();
    if (!apiKey) {
      return res.status(400).json({
        success: false,
        configured: false,
        message:
          'ZERNIO_API_KEY is not configured in server/.env. Please configure your live Zernio API key to connect real social accounts.',
      });
    }

    const result = await getConnectAuthUrl({
      platform: platform.toLowerCase(),
      user: req.user,
      redirectUrl: redirectUrl || 'http://localhost:5173/social-accounts',
    });

    return res.status(200).json({
      success: true,
      authUrl: result.authUrl,
      profileId: result.profileId,
      isMock: false,
    });
  } catch (error) {
    if (error.code === 'CONFIG_MISSING') {
      return res.status(400).json({
        success: false,
        configured: false,
        message: error.message,
      });
    }
    const statusCode = error.statusCode || error.status || 400;
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to generate authorization URL',
    });
  }
};

/**
 * Connect or authorize an account (called directly or from OAuth callback)
 * Route: POST /api/social/connect
 */
export const connectAccount = async (req, res, next) => {
  try {
    const {
      provider,
      providerAccountId,
      accountDisplayName,
      accountUsername,
      accountAvatarUrl,
      profileId,
      isSimulated,
    } = req.body;

    if (!provider || !providerAccountId) {
      return res.status(400).json({
        success: false,
        message: 'Provider and provider account ID are required.',
      });
    }

    const apiKey = getZernioApiKey();
    const effectiveIsSimulated = Boolean(isSimulated);

    // If attempting to connect a real account without API credentials, reject
    if (!effectiveIsSimulated && !apiKey) {
      return res.status(400).json({
        success: false,
        configured: false,
        message:
          'ZERNIO_API_KEY is missing from server/.env. Connecting real social accounts requires an official Zernio API key.',
      });
    }

    let verifiedName = accountDisplayName ? accountDisplayName.trim() : '';
    let verifiedUsername = accountUsername ? accountUsername.trim() : '';
    let verifiedAvatar = accountAvatarUrl ? accountAvatarUrl.trim() : '';

    // If API key is present and not an explicit simulated account, verify with Zernio
    if (apiKey && !effectiveIsSimulated) {
      const zernioAcc = await verifyConnectedAccount({
        profileId: profileId || req.user.zernioProfileId,
        accountId: providerAccountId.trim(),
        platform: provider.toLowerCase(),
      });

      if (zernioAcc) {
        verifiedName = zernioAcc.displayName || verifiedName;
        verifiedUsername = zernioAcc.username || verifiedUsername;
        verifiedAvatar = zernioAcc.avatarUrl || verifiedAvatar;
      }
    }

    // Fallback display name if empty
    if (!verifiedName) {
      verifiedName = verifiedUsername
        ? `${verifiedUsername} (${provider.toUpperCase()})`
        : `${req.user.name || 'User'} (${provider.toUpperCase()})`;
    }

    // Upsert social account for user
    const account = await SocialAccount.findOneAndUpdate(
      {
        userId: req.user._id,
        provider: provider.toLowerCase(),
        providerAccountId: providerAccountId.trim(),
      },
      {
        accountDisplayName: verifiedName,
        accountUsername: verifiedUsername,
        accountAvatarUrl: verifiedAvatar,
        connectionStatus: 'connected',
        isSimulated: effectiveIsSimulated,
        zernioProfileId: profileId || req.user.zernioProfileId || null,
        lastSyncAt: new Date(),
      },
      { upsert: true, new: true, runValidators: true }
    );

    return res.status(200).json({
      success: true,
      message: effectiveIsSimulated
        ? `Connected ${provider.toUpperCase()} (Simulated Test Account).`
        : `Successfully verified and connected ${provider.toUpperCase()} account via Zernio.`,
      account,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Disconnect a social account
 * Route: DELETE /api/social/accounts/:id
 */
export const disconnectAccount = async (req, res, next) => {
  try {
    const account = await SocialAccount.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        message: 'Social account not found or access denied.',
      });
    }

    await account.deleteOne();

    return res.status(200).json({
      success: true,
      message: 'Account disconnected successfully.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Publish a post immediately to connected social platforms
 * Route: POST /api/posts/:id/publish
 */
export const publishPost = async (req, res, next) => {
  try {
    const post = await Post.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found or access denied.',
      });
    }

    // Duplicate Prevention Check
    if (post.status === 'published') {
      return res.status(400).json({
        success: false,
        message: 'This post has already been published.',
        post,
      });
    }

    if (post.status === 'publishing') {
      return res.status(409).json({
        success: false,
        message: 'This post is currently in the process of being published. Please wait for confirmation.',
        post,
      });
    }

    if (!post.selectedPlatforms || post.selectedPlatforms.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No social platforms are selected for this post. Please edit and select at least one platform.',
      });
    }

    // Retrieve active connected accounts
    const connectedAccounts = await SocialAccount.find({
      userId: req.user._id,
      connectionStatus: 'connected',
    });

    // Mark post as publishing
    post.status = 'publishing';
    await post.save();

    // Dispatch to provider via Zernio service
    const dispatchResult = await publishToSocial({
      post,
      connectedAccounts,
    });

    // Update post status and confirmed provider results
    post.status = dispatchResult.overallStatus;
    post.zernioPostId = dispatchResult.zernioPostId || post.zernioPostId;
    post.providerResults = dispatchResult.results;

    if (dispatchResult.overallStatus === 'published') {
      post.publishedAt = new Date();
      post.errorMessage = null;
    } else if (dispatchResult.overallStatus === 'failed') {
      post.errorMessage =
        dispatchResult.results.find((r) => r.errorMessage)?.errorMessage || 'Publication failed.';
    } else {
      post.errorMessage = null;
    }

    await post.save();

    if (dispatchResult.overallStatus === 'failed') {
      return res.status(400).json({
        success: false,
        message: post.errorMessage || 'Publishing failed across selected platforms.',
        post,
        results: dispatchResult.results,
      });
    }

    const statusCode = dispatchResult.overallStatus === 'published' ? 200 : 202;
    const message =
      dispatchResult.overallStatus === 'published'
        ? 'Post published successfully across connected platforms.'
        : 'Post submitted and currently processing with social provider.';

    return res.status(statusCode).json({
      success: true,
      message,
      post,
      results: dispatchResult.results,
      durationMs: dispatchResult.durationMs,
      correlationId: dispatchResult.correlationId,
    });
  } catch (error) {
    // If publishing fails, record error message on post
    try {
      await Post.findByIdAndUpdate(req.params.id, {
        status: 'failed',
        errorMessage: error.message,
      });
    } catch (saveErr) {
      console.warn('Failed to record error status on post:', saveErr.message);
    }

    return res.status(400).json({
      success: false,
      message: error.message || 'Social media publishing failed.',
    });
  }
};

/**
 * Synchronize connected accounts directly from Zernio
 * Route: POST /api/social/sync
 */
export const syncAccounts = async (req, res, next) => {
  try {
    const apiKey = getZernioApiKey();
    if (!apiKey) {
      return res.status(400).json({
        success: false,
        configured: false,
        message: 'ZERNIO_API_KEY is not configured in server/.env.',
      });
    }

    const syncedAccounts = await syncZernioAccounts(req.user);
    return res.status(200).json({
      success: true,
      message: `Synchronized ${syncedAccounts.length} account(s) from Zernio.`,
      accounts: syncedAccounts,
      count: syncedAccounts.length,
    });
  } catch (error) {
    next(error);
  }
};

export default {
  getIntegrationStatus,
  getAccounts,
  getConnectUrl,
  connectAccount,
  disconnectAccount,
  publishPost,
  syncAccounts,
};

