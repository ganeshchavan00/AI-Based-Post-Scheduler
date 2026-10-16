import Post from '../models/Post.js';
import SocialAccount from '../models/SocialAccount.js';
import { publishToSocial, getZernioClient } from './zernio.service.js';

let schedulerInterval = null;
let isProcessing = false;

/**
 * Process all posts that are due for publishing
 * Query: status = 'scheduled' AND scheduledAt <= Date.now()
 */
export const processDuePosts = async () => {
  if (isProcessing) {
    return { skipped: true, reason: 'Previous tick still running' };
  }

  isProcessing = true;
  const now = new Date();
  const summary = {
    checkedAt: now,
    found: 0,
    published: 0,
    failed: 0,
    processing: 0,
    reconciled: 0,
    errors: [],
  };

  try {
    // 1. Reconcile any posts stuck in 'publishing' with a zernioPostId for more than 30s
    try {
      const z = getZernioClient();
      if (z) {
        const inFlightPosts = await Post.find({
          status: 'publishing',
          zernioPostId: { $ne: null },
          updatedAt: { $lte: new Date(now.getTime() - 30000) },
        }).limit(10);

        for (const p of inFlightPosts) {
          try {
            const { data } = await z.posts.getPost({ path: { postId: p.zernioPostId } });
            const remotePost = data?.post || data;
            if (remotePost && remotePost.platforms) {
              const allPub = remotePost.platforms.every((pl) => pl.status === 'published');
              const anyFail = remotePost.platforms.some((pl) => pl.status === 'failed');

              if (allPub) {
                p.status = 'published';
                p.publishedAt = new Date();
                p.errorMessage = null;
                await p.save();
                summary.reconciled += 1;
                console.log(`🔄 [Scheduler] Reconciled in-flight Post [${p._id}] to PUBLISHED.`);
              } else if (anyFail) {
                p.status = 'failed';
                p.errorMessage = remotePost.platforms.find((pl) => pl.errorMessage)?.errorMessage || 'Publication failed.';
                await p.save();
                summary.reconciled += 1;
                console.log(`🔄 [Scheduler] Reconciled in-flight Post [${p._id}] to FAILED: ${p.errorMessage}`);
              }
            }
          } catch (pollErr) {
            console.warn(`[Scheduler] Could not reconcile post [${p._id}]:`, pollErr.message);
          }
        }
      }
    } catch (reconcileErr) {
      console.warn('[Scheduler] In-flight reconciliation error:', reconcileErr.message);
    }

    // 2. Find all scheduled posts whose time has arrived (batch limit: 25)
    const duePosts = await Post.find({
      status: 'scheduled',
      scheduledAt: { $lte: now },
    })
      .sort({ scheduledAt: 1 })
      .limit(25);

    summary.found = duePosts.length;

    if (duePosts.length === 0) {
      isProcessing = false;
      return summary;
    }

    console.log(`⏱️ [Scheduler] Found ${duePosts.length} post(s) due for publishing at ${now.toISOString()}`);

    for (const post of duePosts) {
      // Atomic lock: Transition post to 'publishing' to prevent duplicate execution across workers
      const lockedPost = await Post.findOneAndUpdate(
        { _id: post._id, status: 'scheduled' },
        { $set: { status: 'publishing' } },
        { new: true }
      );

      if (!lockedPost) {
        // Another instance or thread picked it up
        continue;
      }

      try {
        // Retrieve connected accounts for this post's author
        const connectedAccounts = await SocialAccount.find({
          userId: lockedPost.userId,
          connectionStatus: 'connected',
        });

        // Publish via Zernio service
        const dispatchResult = await publishToSocial({
          post: lockedPost,
          connectedAccounts,
        });

        lockedPost.status = dispatchResult.overallStatus;
        lockedPost.zernioPostId = dispatchResult.zernioPostId || lockedPost.zernioPostId;
        lockedPost.providerResults = dispatchResult.results;

        if (dispatchResult.overallStatus === 'published') {
          lockedPost.publishedAt = new Date();
          lockedPost.errorMessage = null;
          summary.published += 1;
          console.log(
            `✅ [Scheduler] Post [${lockedPost._id}] published successfully across [${lockedPost.selectedPlatforms.join(', ')}]`
          );
        } else if (dispatchResult.overallStatus === 'publishing') {
          summary.processing += 1;
          console.log(
            `⏳ [Scheduler] Post [${lockedPost._id}] is currently processing with provider.`
          );
        } else {
          lockedPost.status = 'failed';
          lockedPost.errorMessage =
            dispatchResult.results.find((r) => r.errorMessage)?.errorMessage || 'Publication failed.';
          summary.failed += 1;
          summary.errors.push({
            postId: lockedPost._id,
            error: lockedPost.errorMessage,
          });
          console.error(
            `❌ [Scheduler] Post [${lockedPost._id}] failed to publish: ${lockedPost.errorMessage}`
          );
        }

        await lockedPost.save();
      } catch (postError) {
        // Record failure
        lockedPost.status = 'failed';
        lockedPost.errorMessage = postError.message;
        await lockedPost.save();

        summary.failed += 1;
        summary.errors.push({
          postId: lockedPost._id,
          error: postError.message,
        });
        console.error(
          `❌ [Scheduler] Failed to publish Post [${lockedPost._id}]: ${postError.message}`
        );
      }
    }
  } catch (error) {
    console.error('⚠️ [Scheduler] Error during scheduled job cycle:', error.message);
    summary.errors.push({ error: error.message });
  } finally {
    isProcessing = false;
  }

  return summary;
};

/**
 * Start the background scheduler polling loop
 * Default interval: 15 seconds (responsive for testing and live evaluation)
 */
export const startScheduler = (intervalMs = 15000) => {
  if (schedulerInterval) {
    console.log('⏱️ [Scheduler] Already active. Skipping duplicate initialization.');
    return;
  }

  console.log(`⏱️ [Scheduler] Engine initiated. Polling MongoDB every ${intervalMs / 1000}s for due posts.`);

  // Run immediate first check
  processDuePosts().catch((err) => {
    console.warn('⚠️ [Scheduler] Initial check encountered error:', err.message);
  });

  schedulerInterval = setInterval(() => {
    processDuePosts().catch((err) => {
      console.warn('⚠️ [Scheduler] Polling tick encountered error:', err.message);
    });
  }, intervalMs);

  return schedulerInterval;
};

/**
 * Stop the background scheduler
 */
export const stopScheduler = () => {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log('⏱️ [Scheduler] Engine halted.');
  }
};

export default {
  processDuePosts,
  startScheduler,
  stopScheduler,
};
