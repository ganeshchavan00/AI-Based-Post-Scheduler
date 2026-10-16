import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import Zernio from '@zernio/node';
import config from '../config/index.js';
import User from '../models/User.js';
import SocialAccount from '../models/SocialAccount.js';

let zernioClient = null;
let currentKey = null;

export const getZernioApiKey = () => {
  const key = process.env.ZERNIO_API_KEY || config.zernioApiKey;
  if (!key || key.trim() === '' || key.startsWith('your_zernio_api_key')) {
    return null;
  }
  return key.trim();
};

/**
 * Get or create singleton Zernio SDK client
 */
export const getZernioClient = () => {
  const apiKey = getZernioApiKey();
  if (!apiKey) return null;

  if (!zernioClient || currentKey !== apiKey) {
    const baseURL = (config.zernioBaseUrl || 'https://zernio.com/api').replace(/\/v1$/, '');
    zernioClient = new Zernio({
      apiKey,
      baseURL,
    });
    currentKey = apiKey;
  }
  return zernioClient;
};

/**
 * Check Zernio configuration and connectivity
 */
export const checkZernioStatus = async () => {
  const apiKey = getZernioApiKey();
  const baseUrl = (config.zernioBaseUrl || 'https://zernio.com/api').replace(/\/v1$/, '');

  if (!apiKey) {
    return {
      configured: false,
      hasApiKey: false,
      baseUrl,
      message: 'ZERNIO_API_KEY is not configured in server/.env.',
    };
  }

  try {
    const z = getZernioClient();
    const { data } = await z.profiles.listProfiles({ query: { limit: 1 } });
    const profileCount = data?.profiles?.length || 0;

    return {
      configured: true,
      hasApiKey: true,
      baseUrl,
      profileCount,
      message: 'Zernio API is connected and verified via official SDK.',
    };
  } catch (error) {
    return {
      configured: false,
      hasApiKey: true,
      baseUrl,
      message: error.message || 'Zernio connection failed',
    };
  }
};

/**
 * Get or create a Zernio Profile for a user
 */
export const getOrCreateZernioProfile = async (user) => {
  const z = getZernioClient();
  if (!z) {
    const err = new Error('ZERNIO_API_KEY is not configured in server/.env.');
    err.code = 'CONFIG_MISSING';
    throw err;
  }

  const userIdStr = (user._id || user.id || user).toString();

  // 1. If user already has a cached zernioProfileId, verify it exists or use it
  if (user.zernioProfileId) {
    return user.zernioProfileId;
  }

  // 2. Query profiles by externalId
  try {
    const { data } = await z.profiles.listProfiles({
      query: { externalId: userIdStr },
    });
    const existing = data?.profiles?.[0] || (Array.isArray(data) ? data[0] : null);
    if (existing && (existing._id || existing.id)) {
      const profileId = existing._id || existing.id;
      if (user.save) {
        user.zernioProfileId = profileId;
        await user.save().catch(() => {});
      } else {
        await User.findByIdAndUpdate(userIdStr, { zernioProfileId: profileId }).catch(() => {});
      }
      return profileId;
    }
  } catch (err) {
    console.warn('[Zernio Service] Profile lookup warning:', err.message);
  }

  // 3. Fallback: query default / first existing profile
  try {
    const { data: listData } = await z.profiles.listProfiles({
      query: { limit: 1 },
    });
    const first = listData?.profiles?.[0] || (Array.isArray(listData) ? listData[0] : null);
    if (first && (first._id || first.id)) {
      const profileId = first._id || first.id;
      if (user.save) {
        user.zernioProfileId = profileId;
        await user.save().catch(() => {});
      } else {
        await User.findByIdAndUpdate(userIdStr, { zernioProfileId: profileId }).catch(() => {});
      }
      return profileId;
    }
  } catch (err) {
    console.warn('[Zernio Service] Fallback profile lookup warning:', err.message);
  }

  // 4. Create a new profile if none exists
  try {
    const { data: createData } = await z.profiles.createProfile({
      body: {
        name: user.name || user.email || `User_${userIdStr.substring(0, 8)}`,
        externalId: userIdStr,
      },
    });

    const profileId = createData?.profile?._id || createData?._id || createData?.id;
    if (profileId) {
      if (user.save) {
        user.zernioProfileId = profileId;
        await user.save().catch(() => {});
      } else {
        await User.findByIdAndUpdate(userIdStr, { zernioProfileId: profileId }).catch(() => {});
      }
      return profileId;
    }
  } catch (err) {
    console.warn('[Zernio Service] Profile creation warning:', err.message);
  }

  throw new Error('Unable to resolve or create a Zernio profile for this user. Check your Zernio account permissions.');
};

/**
 * Generate official Zernio OAuth connection authorization URL for a social platform
 */
export const getConnectAuthUrl = async ({ platform, user, redirectUrl }) => {
  const z = getZernioClient();
  if (!z) {
    const error = new Error('ZERNIO_API_KEY is not configured in server/.env. Please configure your live Zernio API key to connect real social accounts.');
    error.code = 'CONFIG_MISSING';
    error.statusCode = 400;
    throw error;
  }

  const profileId = await getOrCreateZernioProfile(user);

  try {
    const { data } = await z.connect.getConnectUrl({
      path: { platform: platform.toLowerCase() },
      query: {
        profileId,
        ...(redirectUrl && { redirect_url: redirectUrl }),
      },
    });

    const authUrl = data?.authUrl;
    if (!authUrl) {
      throw new Error('Zernio did not return an authorization URL.');
    }

    return {
      authUrl,
      profileId,
      isMock: false,
    };
  } catch (error) {
    console.error(`[Zernio Service] Connect error for ${platform}:`, error.message);
    if (
      error.code === 'PAYMENT_REQUIRED' ||
      error.statusCode === 402 ||
      error.status === 402 ||
      (error.message && error.message.toLowerCase().includes('payment'))
    ) {
      const paymentErr = new Error(
        `X (Twitter) requires a payment method on your Zernio account (https://zernio.com/dashboard/billing) due to X API pass-through fees. You can connect LinkedIn, Facebook, or Instagram without any pass-through fee.`
      );
      paymentErr.statusCode = 402;
      throw paymentErr;
    }
    throw error;
  }
};

/**
 * Verify connected account details from Zernio
 */
export const verifyConnectedAccount = async ({ profileId, accountId, platform }) => {
  const z = getZernioClient();
  if (!z) return null;

  try {
    const { data } = await z.accounts.listAccounts({
      query: { ...(profileId && { profileId }) },
    });

    const accounts = data?.accounts || (Array.isArray(data) ? data : []);
    const matched = accounts.find(
      (a) => (a._id === accountId || a.id === accountId || a.accountId === accountId) &&
             (!platform || a.platform?.toLowerCase() === platform.toLowerCase())
    );

    if (matched) {
      return {
        providerAccountId: matched._id || matched.id || accountId,
        displayName: matched.displayName || matched.name || matched.username,
        username: matched.username || '',
        avatarUrl: matched.profilePicture || matched.avatarUrl || matched.metadata?.avatarUrl || '',
        status: matched.isActive ? 'connected' : 'disconnected',
        platform: matched.platform || platform,
      };
    }

    return null;
  } catch (error) {
    console.warn('[Zernio Service] Account verification error:', error.message);
    return null;
  }
};

/**
 * Sync all connected accounts from Zernio into MongoDB for the authenticated user
 */
export const syncZernioAccounts = async (user) => {
  const z = getZernioClient();
  if (!z) return [];

  try {
    const { data } = await z.accounts.listAccounts();
    const accounts = data?.accounts || (Array.isArray(data) ? data : []);
    const syncedAccounts = [];

    for (const acc of accounts) {
      const provider = acc.platform?.toLowerCase();
      const providerAccountId = acc._id || acc.id;

      if (!provider || !providerAccountId) continue;

      const profileIdStr = acc.profileId?._id || acc.profileId || null;
      if (profileIdStr && !user.zernioProfileId) {
        user.zernioProfileId = profileIdStr;
        await User.findByIdAndUpdate(user._id, { zernioProfileId: profileIdStr }).catch(() => {});
      }

      const synced = await SocialAccount.findOneAndUpdate(
        {
          userId: user._id,
          provider,
          providerAccountId,
        },
        {
          accountDisplayName: acc.displayName || acc.name || acc.username || provider.toUpperCase(),
          accountUsername: acc.username || '',
          accountAvatarUrl: acc.profilePicture || acc.avatarUrl || '',
          connectionStatus: acc.isActive ? 'connected' : 'disconnected',
          isSimulated: false,
          zernioProfileId: profileIdStr,
          lastSyncAt: new Date(),
        },
        { upsert: true, new: true, runValidators: true }
      );
      syncedAccounts.push(synced);
    }

    return syncedAccounts;
  } catch (error) {
    console.error('[Zernio Service] Error syncing accounts from Zernio:', error.message);
    throw error;
  }
};

const MIME_TYPE_MAP = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.avi': 'video/x-msvideo',
  '.webm': 'video/webm',
};

/**
 * Sanitize log metadata to guarantee secrets/tokens are never logged
 */
export const sanitizeLogData = (data) => {
  if (!data) return data;
  try {
    const clone = JSON.parse(JSON.stringify(data));
    const redactKeys = ['apikey', 'authorization', 'token', 'secret', 'password', 'key', 'credentials'];
    const redact = (obj) => {
      if (!obj || typeof obj !== 'object') return;
      for (const k of Object.keys(obj)) {
        if (redactKeys.some((r) => k.toLowerCase().includes(r))) {
          obj[k] = '[REDACTED]';
        } else if (typeof obj[k] === 'object') {
          redact(obj[k]);
        }
      }
    };
    redact(clone);
    return clone;
  } catch {
    return '[Unserializable]';
  }
};

/**
 * Validate post against platform capabilities and user account authorizations
 */
export const validatePostForPlatforms = ({ post, connectedAccounts }) => {
  if (!post.selectedPlatforms || post.selectedPlatforms.length === 0) {
    const error = new Error('No social platforms are selected. Please select at least one platform.');
    error.statusCode = 400;
    throw error;
  }

  const targetAccounts = [];
  const errors = [];

  const hasMedia = post.mediaUrls && post.mediaUrls.length > 0;
  const mediaCount = post.mediaUrls ? post.mediaUrls.length : 0;
  const contentLength = (post.content || '').trim().length;

  for (const plat of post.selectedPlatforms) {
    const platformLower = plat.toLowerCase();
    const matched = connectedAccounts.find(
      (acc) => acc.provider?.toLowerCase() === platformLower
    );

    if (!matched) {
      errors.push(
        `No connected account found for platform "${plat}". Please connect your ${plat} account on the Social Accounts page first.`
      );
      continue;
    }

    if (matched.isSimulated) {
      errors.push(
        `Account "${matched.accountDisplayName}" (${plat}) is a simulated demo account. Real publishing requires a live connected OAuth account.`
      );
      continue;
    }

    if (matched.connectionStatus !== 'connected') {
      errors.push(
        `Account "${matched.accountDisplayName}" (${plat}) is ${matched.connectionStatus}. Please reconnect your account.`
      );
      continue;
    }

    // Platform-specific rules & constraints
    if (platformLower === 'instagram') {
      if (!hasMedia) {
        errors.push(
          'Instagram requires at least one image or video attachment. Text-only posts are not supported on Instagram.'
        );
      }
      if (mediaCount > 10) {
        errors.push(`Instagram carousels support a maximum of 10 media items (current: ${mediaCount}).`);
      }
      if (contentLength > 2200) {
        errors.push(`Instagram caption exceeds the maximum limit of 2,200 characters (current: ${contentLength}).`);
      }
    } else if (platformLower === 'twitter') {
      if (contentLength > 280) {
        errors.push(`X / Twitter post exceeds 280 characters (current: ${contentLength}).`);
      }
      if (mediaCount > 4) {
        errors.push(`X / Twitter supports a maximum of 4 images per tweet (current: ${mediaCount}).`);
      }
    } else if (platformLower === 'linkedin') {
      if (contentLength > 3000) {
        errors.push(`LinkedIn post exceeds 3,000 characters (current: ${contentLength}).`);
      }
      if (mediaCount > 9) {
        errors.push(`LinkedIn supports a maximum of 9 images per post (current: ${mediaCount}).`);
      }
    } else if (platformLower === 'threads') {
      if (contentLength > 500) {
        errors.push(`Threads post exceeds 500 characters (current: ${contentLength}).`);
      }
    } else if (platformLower === 'youtube') {
      const hasVideo = post.mediaUrls?.some((m) => m.mimeType?.startsWith('video'));
      if (!hasVideo) {
        errors.push('YouTube requires at least one video attachment.');
      }
    } else if (platformLower === 'pinterest') {
      if (!hasMedia) {
        errors.push('Pinterest requires at least one image or video pin.');
      }
    }

    targetAccounts.push(matched);
  }

  if (errors.length > 0) {
    const error = new Error(errors.join(' '));
    error.statusCode = 400;
    error.validationErrors = errors;
    throw error;
  }

  return targetAccounts;
};

/**
 * Ensure all media files attached to a post have publicly accessible HTTPS URLs.
 * If media files are stored locally (e.g. Multer uploads in server/uploads),
 * upload them to Zernio via getMediaPresignedUrl and obtain the public HTTPS URL.
 */
export const ensurePublicMediaUrls = async (post, zClient) => {
  if (!post.mediaUrls || post.mediaUrls.length === 0) {
    return [];
  }

  const uploadedMediaItems = [];

  for (const m of post.mediaUrls) {
    // 1. If it's already an external public HTTPS URL (not localhost or private IP)
    const isLocalAddress =
      !m.url ||
      m.url.startsWith('/') ||
      m.url.includes('localhost') ||
      m.url.includes('127.0.0.1') ||
      m.url.includes('192.168.') ||
      m.url.includes('10.');

    if (m.url.startsWith('https://') && !isLocalAddress) {
      uploadedMediaItems.push({
        url: m.url,
        type: m.mimeType?.startsWith('video') ? 'video' : 'image',
      });
      continue;
    }

    // 2. Resolve local file path on server disk
    const uploadDir = path.resolve(process.cwd(), config.uploadDir || 'uploads');
    let localFilePath = null;

    if (m.filename && fs.existsSync(path.join(uploadDir, m.filename))) {
      localFilePath = path.join(uploadDir, m.filename);
    } else {
      const filenameFromUrl = path.basename(m.url.split('?')[0]);
      if (fs.existsSync(path.join(uploadDir, filenameFromUrl))) {
        localFilePath = path.join(uploadDir, filenameFromUrl);
      } else if (fs.existsSync(m.url)) {
        localFilePath = m.url;
      }
    }

    if (!localFilePath || !fs.existsSync(localFilePath)) {
      throw new Error(
        `Attached media file [${m.filename || path.basename(m.url)}] could not be found on server disk for upload.`
      );
    }

    // 3. Read buffer and determine MIME content type
    const buffer = await fs.promises.readFile(localFilePath);
    const ext = path.extname(localFilePath).toLowerCase();
    const contentType = m.mimeType || MIME_TYPE_MAP[ext] || 'image/jpeg';
    const isVideo = contentType.startsWith('video');

    // 4. Request presigned URL from Zernio
    const presignResponse = await zClient.media.getMediaPresignedUrl({
      body: {
        filename: path.basename(localFilePath),
        contentType,
        size: buffer.length,
      },
    });

    const uploadUrl = presignResponse.data?.uploadUrl;
    const publicUrl = presignResponse.data?.publicUrl;

    if (!uploadUrl || !publicUrl) {
      throw new Error('Zernio did not return a valid presigned upload URL.');
    }

    // 5. Upload buffer to presigned storage via HTTP PUT
    const putRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
        'Content-Length': buffer.length.toString(),
      },
      body: buffer,
    });

    if (!putRes.ok) {
      throw new Error(`Failed to upload media to Zernio public storage: ${putRes.status} ${putRes.statusText}`);
    }

    // Update m.publicUrl on post document
    m.publicUrl = publicUrl;

    uploadedMediaItems.push({
      url: publicUrl,
      type: isVideo ? 'video' : 'image',
    });
  }

  return uploadedMediaItems;
};

/**
 * Poll Zernio for post completion if platforms return an in-progress status (processing, uploading, pending)
 */
export const pollPostCompletion = async ({ zClient, zernioPostId, maxAttempts = 3, intervalMs = 2500 }) => {
  let currentPost = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs));

    try {
      const { data } = await zClient.posts.getPost({
        path: { postId: zernioPostId },
      });

      currentPost = data?.post || data;
      if (!currentPost) continue;

      const platforms = currentPost.platforms || [];
      const hasPending = platforms.some((p) =>
        ['pending', 'processing', 'uploading'].includes(p.status)
      );

      if (!hasPending) {
        return currentPost;
      }
    } catch (err) {
      console.warn(`[Zernio Service] Polling attempt ${attempt} warning:`, err.message);
    }
  }

  return currentPost;
};

/**
 * Publish post to social platforms via official Zernio SDK
 */
export const publishToSocial = async ({ post, connectedAccounts }) => {
  const correlationId = crypto.randomUUID();
  const startTime = Date.now();

  const z = getZernioClient();
  if (!z) {
    const error = new Error(
      'ZERNIO_API_KEY is not configured in server/.env. Real social media publishing requires a valid Zernio API key.'
    );
    error.code = 'CONFIG_MISSING';
    error.statusCode = 400;
    throw error;
  }

  // 1. Validate platform requirements, constraints, and account connections
  const targetAccounts = validatePostForPlatforms({ post, connectedAccounts });

  console.log(
    `[Zernio Service] [${correlationId}] Starting publish for Post [${post._id}]. Platforms: [${targetAccounts
      .map((a) => a.provider)
      .join(', ')}]`
  );

  // 2. Ensure all media is uploaded to publicly accessible HTTPS storage
  const uploadedMediaItems = await ensurePublicMediaUrls(post, z);

  // 3. Construct post content with hashtags
  let fullContent = (post.content || '').trim();
  if (post.hashtags && post.hashtags.length > 0) {
    const formattedTags = post.hashtags
      .map((t) => (t.startsWith('#') ? t : `#${t}`))
      .filter((t) => !fullContent.includes(t));
    if (formattedTags.length > 0) {
      fullContent = `${fullContent}\n\n${formattedTags.join(' ')}`;
    }
  }

  // 4. Construct official Zernio payload with Idempotency-Key
  const payload = {
    content: fullContent,
    platforms: targetAccounts.map((acc) => ({
      platform: acc.provider.toLowerCase(),
      accountId: acc.providerAccountId,
    })),
    publishNow: true,
  };

  if (uploadedMediaItems.length > 0) {
    payload.mediaItems = uploadedMediaItems;
  }

  try {
    const response = await z.posts.createPost({
      body: payload,
      headers: {
        'Idempotency-Key': post._id.toString(),
      },
    });

    let postData = response?.data?.post || response?.data;
    const zernioPostId = postData?._id || postData?.id;

    // 5. If any platform is still processing/uploading/pending, poll for final result
    const initialPlatforms = postData?.platforms || [];
    const hasPendingState = initialPlatforms.some((p) =>
      ['pending', 'processing', 'uploading'].includes(p.status)
    );

    if (hasPendingState && zernioPostId) {
      console.log(
        `[Zernio Service] [${correlationId}] Post is processing asynchronously. Polling for confirmation...`
      );
      const polledPost = await pollPostCompletion({
        zClient: z,
        zernioPostId,
        maxAttempts: 3,
        intervalMs: 2500,
      });
      if (polledPost) {
        postData = polledPost;
      }
    }

    // 6. Map confirmed provider results per target account (NO fake IDs!)
    const results = targetAccounts.map((acc) => {
      const platformResult = postData?.platforms?.find(
        (p) =>
          p.platform?.toLowerCase() === acc.provider.toLowerCase() ||
          p.accountId?._id === acc.providerAccountId ||
          p.accountId === acc.providerAccountId
      );

      const rawStatus = platformResult?.status;
      let finalPlatformStatus = 'pending';

      if (rawStatus === 'published') {
        finalPlatformStatus = 'published';
      } else if (rawStatus === 'failed') {
        finalPlatformStatus = 'failed';
      } else if (['processing', 'uploading'].includes(rawStatus)) {
        finalPlatformStatus = rawStatus;
      } else if (postData?.status === 'published') {
        finalPlatformStatus = 'published';
      }

      const platformPostId = platformResult?.platformPostId || platformResult?.id || null;
      const platformPostUrl = platformResult?.platformPostUrl || null;
      const errorMessage =
        platformResult?.errorMessage ||
        (finalPlatformStatus === 'failed' ? (response?.data?.message || 'Platform publication failed.') : null);
      const errorCategory = platformResult?.errorCategory || null;

      return {
        provider: acc.provider,
        providerPostId,
        platformPostUrl,
        status: finalPlatformStatus,
        publishedAt: finalPlatformStatus === 'published' ? new Date() : null,
        errorMessage,
        errorCategory,
        responsePayload: sanitizeLogData(platformResult || postData),
      };
    });

    // Determine overall post status
    const allPublished = results.every((r) => r.status === 'published');
    const anyFailed = results.some((r) => r.status === 'failed');
    const allFailed = results.every((r) => r.status === 'failed');
    const anyInFlight = results.some((r) => ['pending', 'processing', 'uploading'].includes(r.status));

    let overallStatus = 'publishing';
    if (allPublished) {
      overallStatus = 'published';
    } else if (allFailed) {
      overallStatus = 'failed';
    } else if (anyFailed && !anyInFlight) {
      overallStatus = 'partial';
    } else if (anyInFlight) {
      overallStatus = 'publishing';
    }

    const durationMs = Date.now() - startTime;
    console.log(
      `[Zernio Service] [${correlationId}] Completed publish for Post [${post._id}]. Duration: ${durationMs}ms. Status: ${overallStatus}.`
    );

    return {
      success: overallStatus === 'published' || overallStatus === 'publishing' || overallStatus === 'partial',
      overallStatus,
      zernioPostId,
      results,
      durationMs,
      correlationId,
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    console.error(
      `[Zernio Service] [${correlationId}] Publishing failed after ${durationMs}ms:`,
      error.message
    );

    // Provide friendly error messages for common provider responses
    let friendlyMessage = error.message;
    if (
      error.code === 'ACCOUNT_DISCONNECTED' ||
      (error.message && error.message.includes('ACCOUNT_DISCONNECTED'))
    ) {
      friendlyMessage = 'One or more social accounts are disconnected. Please reconnect on the Social Accounts page.';
    } else if (error.status === 402 || error.statusCode === 402) {
      friendlyMessage = 'Platform requires payment/billing on Zernio (https://zernio.com/dashboard/billing).';
    }

    const err = new Error(friendlyMessage);
    err.originalError = sanitizeLogData(error.response?.data || error.message);
    err.correlationId = correlationId;
    throw err;
  }
};

export default {
  checkZernioStatus,
  getZernioApiKey,
  getZernioClient,
  getOrCreateZernioProfile,
  getConnectAuthUrl,
  verifyConnectedAccount,
  syncZernioAccounts,
  validatePostForPlatforms,
  ensurePublicMediaUrls,
  pollPostCompletion,
  publishToSocial,
  sanitizeLogData,
};
