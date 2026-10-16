import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Post from '../models/Post.js';
import SocialAccount from '../models/SocialAccount.js';
import { processDuePosts } from '../services/scheduler.service.js';
import { publishToSocial, validatePostForPlatforms } from '../services/zernio.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to sanitize hashtags
const parseHashtags = (raw) => {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.map((tag) => tag.replace(/^#/, '').trim()).filter(Boolean);
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((tag) => String(tag).replace(/^#/, '').trim()).filter(Boolean);
      }
    } catch {
      // Split by comma or whitespace
      return raw
        .split(/[,\s]+/)
        .map((tag) => tag.replace(/^#/, '').trim())
        .filter(Boolean);
    }
  }
  return [];
};

// Helper to parse platforms
const parsePlatforms = (raw) => {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.map((p) => String(p).toLowerCase().trim()).filter(Boolean);
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((p) => String(p).toLowerCase().trim()).filter(Boolean);
      }
    } catch {
      return raw
        .split(',')
        .map((p) => p.toLowerCase().trim())
        .filter(Boolean);
    }
  }
  return [];
};

/**
 * Get all posts for current user with filtering and pagination
 * Route: GET /api/posts
 */
export const getPosts = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { status, platform, search } = req.query;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.max(1, Math.min(50, parseInt(req.query.limit) || 10));
    const skip = (page - 1) * limit;

    // Strict user ownership filter
    const query = { userId };

    if (status && status !== 'all') {
      query.status = status;
    }

    if (platform && platform !== 'all') {
      query.selectedPlatforms = platform.toLowerCase();
    }

    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [{ title: searchRegex }, { content: searchRegex }];
    }

    // Execute queries in parallel
    const [posts, total, statusCounts] = await Promise.all([
      Post.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Post.countDocuments(query),
      Post.aggregate([
        { $match: { userId } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
    ]);

    // Format status metrics
    const stats = {
      total: 0,
      draft: 0,
      scheduled: 0,
      published: 0,
      failed: 0,
      cancelled: 0,
    };

    statusCounts.forEach((item) => {
      if (stats[item._id] !== undefined) {
        stats[item._id] = item.count;
      }
      stats.total += item.count;
    });

    return res.status(200).json({
      success: true,
      count: posts.length,
      total,
      page,
      totalPages: Math.ceil(total / limit) || 1,
      stats,
      posts,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get single post by ID (with strict ownership check)
 * Route: GET /api/posts/:id
 */
export const getPostById = async (req, res, next) => {
  try {
    const post = await Post.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found or you do not have permission to access it.',
      });
    }

    return res.status(200).json({
      success: true,
      post,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new post (supports Multer file uploads)
 * Route: POST /api/posts
 */
export const createPost = async (req, res, next) => {
  try {
    const { title, content, status, scheduledAt } = req.body;

    const hashtags = parseHashtags(req.body.hashtags);
    const selectedPlatforms = parsePlatforms(req.body.selectedPlatforms);

    // Map uploaded files
    const mediaUrls = [];
    if (req.files && Array.isArray(req.files)) {
      req.files.forEach((file) => {
        mediaUrls.push({
          url: `/uploads/${file.filename}`,
          filename: file.filename,
          mimeType: file.mimetype,
          size: file.size,
        });
      });
    }

    // Determine initial status
    let finalStatus = status || 'draft';
    let finalScheduledAt = null;

    if (finalStatus === 'scheduled') {
      if (!scheduledAt) {
        return res.status(400).json({
          success: false,
          message: 'A future date and time is required when scheduling a post.',
        });
      }
      finalScheduledAt = new Date(scheduledAt);
      if (finalScheduledAt <= new Date()) {
        return res.status(400).json({
          success: false,
          message: 'Scheduled date and time must be set in the future.',
        });
      }
    }

    // Pre-validate platforms & accounts if publishing immediately
    if (finalStatus === 'published') {
      const connectedAccounts = await SocialAccount.find({
        userId: req.user._id,
        connectionStatus: 'connected',
      });

      try {
        validatePostForPlatforms({
          post: {
            selectedPlatforms,
            mediaUrls,
            content: content.trim(),
          },
          connectedAccounts,
        });
      } catch (valErr) {
        return res.status(400).json({
          success: false,
          message: valErr.message,
        });
      }
    }

    const post = await Post.create({
      userId: req.user._id,
      title: title ? title.trim() : '',
      content: content.trim(),
      hashtags,
      selectedPlatforms,
      mediaUrls,
      status: finalStatus === 'published' ? 'publishing' : finalStatus,
      scheduledAt: finalScheduledAt,
    });

    if (finalStatus === 'published') {
      try {
        const connectedAccounts = await SocialAccount.find({
          userId: req.user._id,
          connectionStatus: 'connected',
        });
        const dispatchResult = await publishToSocial({ post, connectedAccounts });

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
          });
        }
      } catch (pubErr) {
        post.status = 'failed';
        post.errorMessage = pubErr.message;
        await post.save();
        return res.status(400).json({
          success: false,
          message: pubErr.message,
          post,
        });
      }
    }

    const responseStatus = finalStatus === 'published' && post.status === 'published' ? 201 : 201;
    const responseMessage =
      post.status === 'published'
        ? 'Post published successfully across connected platforms.'
        : post.status === 'publishing'
        ? 'Post submitted and currently processing with social provider.'
        : post.status === 'scheduled'
        ? 'Post scheduled successfully.'
        : 'Draft saved successfully.';

    return res.status(responseStatus).json({
      success: true,
      message: responseMessage,
      post,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update existing post (with ownership check)
 * Route: PUT /api/posts/:id
 */
export const updatePost = async (req, res, next) => {
  try {
    const post = await Post.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found or you do not have permission to modify it.',
      });
    }

    const { title, content, status, scheduledAt, replaceMedia } = req.body;

    if (title !== undefined) post.title = title.trim();
    if (content !== undefined) post.content = content.trim();

    if (req.body.hashtags !== undefined) {
      post.hashtags = parseHashtags(req.body.hashtags);
    }

    if (req.body.selectedPlatforms !== undefined) {
      post.selectedPlatforms = parsePlatforms(req.body.selectedPlatforms);
    }

    // Handle media updates
    if (req.files && req.files.length > 0) {
      const newMedia = req.files.map((file) => ({
        url: `/uploads/${file.filename}`,
        filename: file.filename,
        mimeType: file.mimetype,
        size: file.size,
      }));

      if (replaceMedia === 'true' || replaceMedia === true) {
        post.mediaUrls = newMedia;
      } else {
        post.mediaUrls.push(...newMedia);
      }
    }

    // Handle status / schedule changes
    if (status !== undefined) {
      post.status = status;
      if (status === 'scheduled') {
        if (!scheduledAt && !post.scheduledAt) {
          return res.status(400).json({
            success: false,
            message: 'A scheduled date and time is required.',
          });
        }
        if (scheduledAt) {
          const sDate = new Date(scheduledAt);
          if (sDate <= new Date()) {
            return res.status(400).json({
              success: false,
              message: 'Scheduled date and time must be set in the future.',
            });
          }
          post.scheduledAt = sDate;
        }
      } else if (status === 'draft') {
        post.scheduledAt = null;
      }
    }

    await post.save();

    return res.status(200).json({
      success: true,
      message: 'Post updated successfully.',
      post,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete post (with ownership check)
 * Route: DELETE /api/posts/:id
 */
export const deletePost = async (req, res, next) => {
  try {
    const post = await Post.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found or you do not have permission to delete it.',
      });
    }

    // Attempt cleanup of media files on disk
    if (post.mediaUrls && post.mediaUrls.length > 0) {
      const uploadDirPath = path.join(__dirname, '..', '..', process.env.UPLOAD_DIR || 'uploads');
      post.mediaUrls.forEach((m) => {
        if (m.filename) {
          const fullPath = path.join(uploadDirPath, m.filename);
          if (fs.existsSync(fullPath)) {
            try {
              fs.unlinkSync(fullPath);
            } catch (err) {
              console.warn('Could not delete upload file:', m.filename, err.message);
            }
          }
        }
      });
    }

    await post.deleteOne();

    return res.status(200).json({
      success: true,
      message: 'Post deleted successfully.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get dashboard stats for user
 * Route: GET /api/dashboard/stats
 */
export const getDashboardStats = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const [statusCounts, recentPosts] = await Promise.all([
      Post.aggregate([
        { $match: { userId } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Post.find({ userId }).sort({ createdAt: -1 }).limit(5),
    ]);

    const stats = {
      total: 0,
      published: 0,
      scheduled: 0,
      draft: 0,
      failed: 0,
    };

    statusCounts.forEach((s) => {
      if (stats[s._id] !== undefined) {
        stats[s._id] = s.count;
      }
      stats.total += s.count;
    });

    return res.status(200).json({
      success: true,
      stats,
      recentPosts,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Cancel a scheduled post
 * Route: POST /api/posts/:id/cancel
 */
export const cancelScheduledPost = async (req, res, next) => {
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

    if (post.status === 'published') {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel an already published post.',
      });
    }

    const { toDraft } = req.query;

    if (toDraft === 'true') {
      post.status = 'draft';
      post.scheduledAt = null;
    } else {
      post.status = 'cancelled';
    }

    await post.save();

    return res.status(200).json({
      success: true,
      message: `Post schedule cancelled successfully. Status set to ${post.status}.`,
      post,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Reschedule a post for a new future date/time
 * Route: POST /api/posts/:id/reschedule
 */
export const reschedulePost = async (req, res, next) => {
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

    if (post.status === 'published') {
      return res.status(400).json({
        success: false,
        message: 'Cannot reschedule a post that has already been published.',
      });
    }

    const { scheduledAt } = req.body;
    if (!scheduledAt) {
      return res.status(400).json({
        success: false,
        message: 'A new scheduled date and time is required.',
      });
    }

    const newDate = new Date(scheduledAt);
    if (isNaN(newDate.getTime()) || newDate <= new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Scheduled date and time must be set in the future.',
      });
    }

    post.scheduledAt = newDate;
    post.status = 'scheduled';
    post.errorMessage = null;

    await post.save();

    return res.status(200).json({
      success: true,
      message: `Post successfully rescheduled for ${newDate.toLocaleString()}.`,
      post,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Manually trigger the scheduler queue processor (Dev / Evaluation utility)
 * Route: POST /api/posts/scheduler/run-due
 */
export const triggerSchedulerRun = async (req, res, next) => {
  try {
    const summary = await processDuePosts();
    return res.status(200).json({
      success: true,
      message: 'Scheduler queue processing executed successfully.',
      summary,
    });
  } catch (error) {
    next(error);
  }
};

export default {
  getPosts,
  getPostById,
  createPost,
  updatePost,
  deletePost,
  getDashboardStats,
  cancelScheduledPost,
  reschedulePost,
  triggerSchedulerRun,
};

