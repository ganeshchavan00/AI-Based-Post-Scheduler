import { GoogleGenAI } from '@google/genai';
import config from '../config/index.js';

// Singleton lazy-initialized Gemini client
let geminiClient = null;
let currentKey = null;

export const getGeminiApiKey = () => {
  const key = process.env.GEMINI_API_KEY || config.geminiApiKey;
  if (!key || key.trim() === '' || key.startsWith('your_gemini_api_key')) {
    return null;
  }
  return key.trim();
};

export const getGeminiModel = () => {
  return process.env.GEMINI_MODEL || config.geminiModel || 'gemini-3.8-flash';
};

export const getGeminiClient = () => {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    return null;
  }
  if (!geminiClient || currentKey !== apiKey) {
    geminiClient = new GoogleGenAI({ apiKey });
    currentKey = apiKey;
  }
  return geminiClient;
};

// Aliases for backward compatibility
export const getOpenAIApiKey = getGeminiApiKey;
export const getOpenAIClient = getGeminiClient;

/**
 * Check AI configuration status
 */
export const checkAIStatus = () => {
  const apiKey = getGeminiApiKey();
  const isConfigured = Boolean(apiKey);
  const model = getGeminiModel();

  return {
    configured: isConfigured,
    model,
    provider: 'Google Gemini',
    mode: isConfigured ? 'live' : 'fallback-template',
    message: isConfigured
      ? `Google Gemini API key configured. Live ${model} generation active.`
      : 'GEMINI_API_KEY is not configured in server/.env. Using intelligent local template fallback.',
  };
};

/**
 * Intelligent local template generator for when fallback is explicitly requested
 */
const generateFallbackCaption = ({ prompt, topic, audience, tone, platform, keywords }) => {
  const text = prompt || topic || 'our latest updates';
  const keywordStr = keywords && keywords.length > 0 ? ` Featuring: ${keywords.join(', ')}.` : '';

  const toneAdjectives = {
    professional: 'pleased to share our strategic perspective on',
    casual: 'super excited to talk about',
    educational: 'breaking down key fundamentals behind',
    promotional: 'thrilled to announce the latest developments in',
    creative: 'reimagining the possibilities of',
  };

  const intro = toneAdjectives[tone?.toLowerCase()] || 'sharing insights on';
  const plat = (platform || '').toLowerCase();

  if (plat === 'twitter' || plat === 'x') {
    return `🚀 We're ${intro} ${text}!${keywordStr} Designed for ${audience || 'creators and innovators'}. What are your thoughts? #Innovation #Tech`;
  }

  if (plat === 'linkedin') {
    return `💡 Strategic Update\n\nWe are ${intro} ${text}.${keywordStr}\n\nKey Highlights:\n• Tailored specifically for ${audience || 'modern engineering leaders'}\n• Streamlined workflow and data-driven execution\n• Built with scalable architecture in mind\n\nHow is your team approaching this shift? Let's discuss in the comments below!`;
  }

  if (plat === 'facebook') {
    return `🎉 Big Announcement!\n\nWe are ${intro} ${text}.${keywordStr}\n\nWe invite all ${audience || 'community members and friends'} to join us and check it out! Let us know your thoughts in the comments below. 👇`;
  }

  return `✨ Exploring ${text}!\n\nWe are ${intro} this domain.${keywordStr}\n\nTargeted for ${audience || 'visionaries and tech enthusiasts'}. Check out our latest updates and join the conversation!`;
};

/**
 * Generate intelligent hashtags fallback
 */
const generateFallbackHashtags = ({ prompt, topic, platform, count = 5 }) => {
  const base = (prompt || topic || 'Tech').replace(/[^a-zA-Z0-9 ]/g, '').split(' ').filter(w => w.length > 3);
  const defaults = [...base.slice(0, 3), 'AI', 'Innovation', 'FutureTech', 'SocialMedia', 'DigitalStrategy'];
  return defaults.slice(0, Math.min(count, defaults.length));
};

/**
 * Centralized honest error handling for Google Gemini API errors
 */
const handleGeminiError = (error, actionDesc = 'generation') => {
  console.error(`[Gemini Service] ${actionDesc} Error:`, error.message);

  const msg = error.message || '';
  const status = error.status || error.statusCode || error.code;

  // 1. Missing API key (local configuration check)
  if (error.code === 'MISSING_API_KEY') {
    const err = new Error('GEMINI_API_KEY is not configured in server/.env. Please configure your Google Gemini API key.');
    err.statusCode = 503;
    err.code = 'MISSING_API_KEY';
    throw err;
  }

  // 2. Invalid API Key / Authentication error
  if (
    (status === 400 && msg.includes('API key not valid')) ||
    status === 401 ||
    status === 403 ||
    msg.includes('API_KEY_INVALID') ||
    msg.includes('API key not valid') ||
    msg.includes('invalid API key') ||
    msg.includes('PERMISSION_DENIED')
  ) {
    const err = new Error('Invalid Google Gemini API key. Please check your GEMINI_API_KEY in server/.env.');
    err.statusCode = 401;
    err.code = 'INVALID_API_KEY';
    throw err;
  }

  // 3. Quota or Rate Limit Exceeded
  if (
    status === 429 ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('quota') ||
    msg.includes('rate limit') ||
    msg.includes('exceeded your current quota')
  ) {
    const retryMatch = msg.match(/retry in ([0-9.]+s)/i);
    const retryNote = retryMatch ? ` Please retry in ${retryMatch[1]}.` : ' Please retry in a few moments.';
    const err = new Error(
      `Google Gemini API rate limit or quota exceeded (free tier limit reached).${retryNote} Check your quota at Google AI Studio (https://aistudio.google.com).`
    );
    err.statusCode = 429;
    err.code = 'QUOTA_EXCEEDED';
    throw err;
  }

  // 4. Provider High Demand / Temporary Service Unavailable (503)
  if (
    status === 503 ||
    msg.includes('high demand') ||
    msg.includes('UNAVAILABLE') ||
    msg.includes('temporarily unavailable')
  ) {
    const err = new Error('Google Gemini API is currently experiencing temporary high demand (503 UNAVAILABLE). Please retry in a few moments.');
    err.statusCode = 503;
    err.code = 'SERVICE_UNAVAILABLE';
    throw err;
  }

  // 4. Network or connection errors
  if (
    error.code === 'ENOTFOUND' ||
    error.code === 'ECONNREFUSED' ||
    error.code === 'ETIMEDOUT' ||
    msg.toLowerCase().includes('fetch failed') ||
    msg.toLowerCase().includes('network')
  ) {
    const err = new Error('Network error connecting to Google Gemini API service. Please verify server internet connectivity.');
    err.statusCode = 503;
    err.code = 'NETWORK_ERROR';
    throw err;
  }

  // 5. General error
  const err = new Error(error.message || `Failed to perform AI ${actionDesc} via Google Gemini.`);
  err.statusCode = typeof status === 'number' && status >= 400 && status < 600 ? status : 500;
  err.code = 'GEMINI_GENERATION_ERROR';
  throw err;
};

/**
 * Generate social media caption using Google Gemini API
 */
export const generateCaption = async ({ prompt, topic, audience, tone, platform, keywords, useFallback = false }) => {
  const userPrompt = (prompt || topic || '').trim();
  if (!userPrompt) {
    const err = new Error('A prompt or topic is required to generate a caption.');
    err.statusCode = 400;
    throw err;
  }

  const client = getGeminiClient();
  const model = getGeminiModel();

  // If no Gemini key configured or fallback explicitly requested
  if (!client || useFallback) {
    if (!client && !useFallback) {
      const err = new Error('GEMINI_API_KEY is not configured in server/.env. Please configure your Google Gemini API key.');
      err.statusCode = 503;
      err.code = 'MISSING_API_KEY';
      throw err;
    }

    return {
      caption: generateFallbackCaption({ prompt: userPrompt, topic: userPrompt, audience, tone, platform, keywords }),
      isMock: true,
      notice: !client
        ? 'Generated using local template fallback mode. To enable live Google Gemini generation, configure GEMINI_API_KEY in server/.env.'
        : 'Generated using local template fallback mode (fallback requested).',
      model: 'local-heuristic-v1',
    };
  }

  try {
    const platformInstructions = {
      instagram: 'Instagram: Engaging hook in the very first sentence, conversational storytelling, relevant emojis, clean line breaks for readability, and a clear call-to-action inviting users to visit/comment/engage.',
      linkedin: 'LinkedIn: Professional, insightful, high-value tone, clean paragraph spacing or bullet points if appropriate, business/career context, and an engaging professional discussion question.',
      facebook: 'Facebook: Community-friendly, warm and approachable, clearly highlights key details/discounts/events, and ends with an inviting question or CTA.',
      twitter: 'Twitter / X: Punchy, high-impact, concise (under 260 characters), with 1-2 relevant hashtags.',
      x: 'X / Twitter: Punchy, high-impact, concise (under 260 characters), with 1-2 relevant hashtags.',
    };

    const platformKey = (platform || 'general').toLowerCase();
    const platformRule = platformInstructions[platformKey] || 'General social media: Engaging hook, well-structured body, and relevant call-to-action.';

    const systemInstruction = `You are an expert social media copywriter and growth marketer.
Write a complete, highly engaging social media caption based directly and faithfully on the user's prompt.
Strictly adhere to the following:
1. Directly incorporate and address all specific requests, discounts, events, instructions, and details mentioned in the prompt. Do not produce generic content.
2. Adhere strictly to the platform guidelines and tone.
3. Output ONLY the final caption text. Do not include preamble, conversational filler, or enclosing quotation marks.`;

    const userMessageContent = `User Prompt: "${userPrompt}"
Target Platform: ${platform || 'General Social Media'}
Platform Guidelines: ${platformRule}
${tone ? `Tone: ${tone}` : ''}
${audience ? `Target Audience: ${audience}` : ''}
${keywords && keywords.length > 0 ? `Key Points / Keywords to include: ${keywords.join(', ')}` : ''}`;

    const response = await client.models.generateContent({
      model,
      contents: userMessageContent,
      config: {
        systemInstruction,
        temperature: 0.7,
        maxOutputTokens: 800,
      },
    });

    const caption = response.text ? response.text.trim() : '';

    return {
      caption,
      isMock: false,
      model,
      usage: response.usageMetadata
        ? {
            prompt_tokens: response.usageMetadata.promptTokenCount,
            completion_tokens: response.usageMetadata.candidatesTokenCount,
            total_tokens: response.usageMetadata.totalTokenCount,
          }
        : undefined,
    };
  } catch (error) {
    handleGeminiError(error, 'Caption Generation');
  }
};

/**
 * Generate optimized hashtags using Google Gemini API
 */
export const generateHashtags = async ({ prompt, topic, platform, count = 6, useFallback = false }) => {
  const userPrompt = (prompt || topic || '').trim();
  if (!userPrompt) {
    const err = new Error('A prompt or topic is required to generate hashtags.');
    err.statusCode = 400;
    throw err;
  }

  const client = getGeminiClient();
  const model = getGeminiModel();

  if (!client || useFallback) {
    if (!client && !useFallback) {
      const err = new Error('GEMINI_API_KEY is not configured in server/.env. Please configure your Google Gemini API key.');
      err.statusCode = 503;
      err.code = 'MISSING_API_KEY';
      throw err;
    }

    return {
      hashtags: generateFallbackHashtags({ prompt: userPrompt, topic: userPrompt, platform, count }),
      isMock: true,
      notice: !client
        ? 'Generated using local template fallback mode. Add GEMINI_API_KEY in server/.env for live Gemini responses.'
        : 'Generated using local template fallback mode (fallback requested).',
      model: 'local-heuristic-v1',
    };
  }

  try {
    const systemInstruction = `You are a social media hashtag optimization specialist. Return only a valid JSON array of ${count} trending, highly relevant hashtags without the leading '#' symbol, e.g. ["CoffeeShop", "GrandOpening", "LatteArt"]. Do not include any other text or markdown code fences outside the JSON array.`;

    const userMessageContent = `Generate ${count} relevant hashtags for this post:
Prompt: "${userPrompt}"
Platform: ${platform || 'social media'}`;

    const response = await client.models.generateContent({
      model,
      contents: userMessageContent,
      config: {
        systemInstruction,
        temperature: 0.6,
        maxOutputTokens: 250,
        responseMimeType: 'application/json',
      },
    });

    const raw = response.text ? response.text.trim() : '[]';
    let hashtags = [];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        hashtags = parsed;
      } else if (parsed && typeof parsed === 'object') {
        hashtags = Object.values(parsed).flat();
      }
    } catch {
      hashtags = raw
        .replace(/```json/gi, '')
        .replace(/```/g, '')
        .replace(/[\[\]"]/g, '')
        .split(/[,\n]/)
        .map((tag) => tag.replace(/^#/, '').trim())
        .filter(Boolean);
    }

    if (!Array.isArray(hashtags)) {
      hashtags = [];
    }

    // Sanitize to clean alphanumeric/camelCase tags without punctuation
    const cleaned = hashtags
      .map((h) => String(h).replace(/^#/, '').replace(/[^a-zA-Z0-9_]/g, '').trim())
      .filter((h) => h.length > 1)
      .slice(0, count);

    return {
      hashtags: cleaned,
      isMock: false,
      model,
    };
  } catch (error) {
    handleGeminiError(error, 'Hashtag Generation');
  }
};

/**
 * Unified content generation (captions, hashtags, or both)
 */
export const generateUnifiedContent = async ({
  prompt,
  topic,
  audience,
  tone,
  platform,
  keywords,
  type = 'all',
  count = 6,
  useFallback = false,
}) => {
  const userPrompt = (prompt || topic || '').trim();

  if (type === 'caption') {
    const cap = await generateCaption({ prompt: userPrompt, topic: userPrompt, audience, tone, platform, keywords, useFallback });
    return {
      caption: cap.caption,
      hashtags: [],
      isMock: cap.isMock,
      model: cap.model,
      notice: cap.notice,
      usage: cap.usage,
    };
  }

  if (type === 'hashtags') {
    const hash = await generateHashtags({ prompt: userPrompt, topic: userPrompt, platform, count, useFallback });
    return {
      caption: '',
      hashtags: hash.hashtags,
      isMock: hash.isMock,
      model: hash.model,
      notice: hash.notice,
    };
  }

  // Generate both caption and hashtags in parallel
  const [cap, hash] = await Promise.all([
    generateCaption({ prompt: userPrompt, topic: userPrompt, audience, tone, platform, keywords, useFallback }),
    generateHashtags({ prompt: userPrompt, topic: userPrompt, platform, count, useFallback }),
  ]);

  return {
    caption: cap.caption,
    hashtags: hash.hashtags,
    isMock: cap.isMock || hash.isMock,
    model: cap.model,
    notice: cap.notice || hash.notice,
    usage: cap.usage,
  };
};

export default {
  getGeminiApiKey,
  getGeminiModel,
  getGeminiClient,
  getOpenAIApiKey,
  getOpenAIClient,
  checkAIStatus,
  generateCaption,
  generateHashtags,
  generateUnifiedContent,
};
