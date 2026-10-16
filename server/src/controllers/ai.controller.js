import {
  checkAIStatus,
  generateCaption,
  generateHashtags,
  generateUnifiedContent,
} from '../services/ai.service.js';

/**
 * Get AI integration configuration status
 * Route: GET /api/ai/status
 */
export const getAIStatus = async (req, res, next) => {
  try {
    const status = checkAIStatus();
    return res.status(200).json({
      success: true,
      status,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Unified AI Generation Endpoint
 * Route: POST /api/ai/generate
 */
export const handleGenerate = async (req, res, next) => {
  try {
    const { prompt, topic, audience, tone, platform, keywords, type = 'all', count = 6, useFallback } = req.body;
    const userPrompt = (prompt || topic || '').trim();

    if (!userPrompt) {
      return res.status(400).json({
        success: false,
        message: 'A prompt or topic is required for AI generation.',
      });
    }

    const result = await generateUnifiedContent({
      prompt: userPrompt,
      topic: userPrompt,
      audience: audience ? audience.trim() : '',
      tone: tone || 'professional',
      platform: platform || 'general',
      keywords: Array.isArray(keywords) ? keywords : keywords ? [keywords] : [],
      type: type || 'all',
      count: parseInt(count) || 6,
      useFallback: Boolean(useFallback),
    });

    return res.status(200).json({
      success: true,
      caption: result.caption,
      hashtags: result.hashtags,
      isMock: result.isMock,
      model: result.model,
      notice: result.notice,
      usage: result.usage,
    });
  } catch (error) {
    const statusCode = error.statusCode || error.status || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'AI generation failed.',
      code: error.code || 'AI_GENERATION_ERROR',
    });
  }
};

/**
 * Generate AI Post Caption
 * Route: POST /api/ai/generate-caption
 */
export const handleGenerateCaption = async (req, res, next) => {
  try {
    const { prompt, topic, audience, tone, platform, keywords, useFallback } = req.body;
    const userPrompt = (prompt || topic || '').trim();

    if (!userPrompt) {
      return res.status(400).json({
        success: false,
        message: 'A prompt or topic is required to generate a caption.',
      });
    }

    const result = await generateCaption({
      prompt: userPrompt,
      topic: userPrompt,
      audience: audience ? audience.trim() : '',
      tone: tone || 'professional',
      platform: platform || 'general',
      keywords: Array.isArray(keywords) ? keywords : keywords ? [keywords] : [],
      useFallback: Boolean(useFallback),
    });

    return res.status(200).json({
      success: true,
      caption: result.caption,
      isMock: result.isMock,
      model: result.model,
      notice: result.notice,
      usage: result.usage,
    });
  } catch (error) {
    const statusCode = error.statusCode || error.status || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to generate AI caption.',
      code: error.code || 'AI_CAPTION_ERROR',
    });
  }
};

/**
 * Generate AI Hashtags
 * Route: POST /api/ai/generate-hashtags
 */
export const handleGenerateHashtags = async (req, res, next) => {
  try {
    const { prompt, topic, platform, count, useFallback } = req.body;
    const userPrompt = (prompt || topic || '').trim();

    if (!userPrompt) {
      return res.status(400).json({
        success: false,
        message: 'A prompt or topic is required to generate hashtags.',
      });
    }

    const result = await generateHashtags({
      prompt: userPrompt,
      topic: userPrompt,
      platform: platform || 'general',
      count: parseInt(count) || 6,
      useFallback: Boolean(useFallback),
    });

    return res.status(200).json({
      success: true,
      hashtags: result.hashtags,
      isMock: result.isMock,
      model: result.model,
      notice: result.notice,
    });
  } catch (error) {
    const statusCode = error.statusCode || error.status || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to generate hashtags.',
      code: error.code || 'AI_HASHTAGS_ERROR',
    });
  }
};

export default {
  getAIStatus,
  handleGenerate,
  handleGenerateCaption,
  handleGenerateHashtags,
};
