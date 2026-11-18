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
  return process.env.GEMINI_MODEL || config.geminiModel || 'gemini-3.5-flash-lite';
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

// Priority list of fast, modern Gemini flash models supported by Google GenAI SDK
const SUPPORTED_GEMINI_MODELS = ['gemini-3.5-flash-lite', 'gemini-3.5-flash', 'gemini-3.1-flash-lite'];

/**
 * Resilient Gemini content generation with automatic failover across supported Flash models
 * when temporary high demand (503 UNAVAILABLE) or model deprecation occurs.
 */
const callGeminiWithResilience = async (client, initialModel, options) => {
  const modelsToTry = [initialModel, ...SUPPORTED_GEMINI_MODELS]
    .filter((v, idx, arr) => v && arr.indexOf(v) === idx);

  let lastError = null;
  for (const model of modelsToTry) {
    try {
      const response = await client.models.generateContent({
        ...options,
        model,
      });
      return { response, modelUsed: model };
    } catch (err) {
      lastError = err;
      const status = err.status || err.statusCode;
      const msg = err.message || '';
      
      // Only failover to alternate model on 503 UNAVAILABLE, 404 NOT_FOUND, or high demand
      const isCapacityError = status === 503 || msg.includes('UNAVAILABLE') || msg.includes('high demand') || msg.includes('temporarily unavailable');
      const isNotFoundError = status === 404 || msg.includes('not found') || msg.includes('no longer available');

      if (isCapacityError || isNotFoundError) {
        console.warn(`[Gemini Service] Model ${model} returned ${status || 'capacity error'}. Trying backup model candidate...`);
        continue;
      }

      // Authentication, rate limit, quota, and invalid requests must throw immediately
      throw err;
    }
  }

  throw lastError;
};

/**
 * Intelligent local template generator for when fallback is explicitly requested
 */
const generateFallbackCaption = ({ prompt, topic, audience, tone, platform, keywords }) => {
  const text = (prompt || topic || '').trim() || 'our latest updates';
  const keywordStr = keywords && keywords.length > 0 ? ` Features: ${keywords.join(', ')}.` : '';
  const audienceStr = audience && audience.trim() ? ` Targeted for ${audience.trim()}.` : '';

  const toneAdjectives = {
    professional: 'pleased to share our perspective on',
    casual: 'excited to talk about',
    educational: 'breaking down key fundamentals behind',
    promotional: 'thrilled to announce the latest developments in',
    creative: 'exploring fresh ideas around',
  };

  const intro = toneAdjectives[tone?.toLowerCase()] || 'sharing updates on';
  const plat = (platform || '').toLowerCase();

  if (plat === 'twitter' || plat === 'x') {
    return `🚀 We're ${intro} ${text}!${keywordStr}${audienceStr} What are your thoughts? #Update #Insights`;
  }

  if (plat === 'linkedin') {
    return `💡 Update\n\nWe are ${intro} ${text}.${keywordStr}${audienceStr}\n\nKey Highlights:\n• Clear execution aligned with practical goals\n• Focus on quality, simplicity, and relevance\n\nWhat are your thoughts on this? Let's discuss in the comments below!`;
  }

  if (plat === 'facebook') {
    return `🎉 Update!\n\nWe are ${intro} ${text}.${keywordStr}${audienceStr}\n\nCheck it out and let us know your thoughts in the comments below! 👇`;
  }

  return `✨ Exploring ${text}!\n\nWe are ${intro} this domain.${keywordStr}${audienceStr} Check out our latest updates and join the conversation!`;
};

/**
 * Generate intelligent hashtags fallback
 */
const generateFallbackHashtags = ({ prompt, topic, platform, count = 5 }) => {
  const base = (prompt || topic || '')
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .split(' ')
    .filter(w => w.length > 3)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());

  const defaults = [...base.slice(0, 3), 'Updates', 'Trending', 'SocialMedia', 'Content', 'Insights'];
  const unique = Array.from(new Set(defaults));
  return unique.slice(0, Math.min(count, unique.length));
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

  // 5. Network or connection errors
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

  // 6. General error
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
  const configuredModel = getGeminiModel();

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
        : 'Generated using local template fallback mode (explicitly requested).',
      model: 'local-heuristic-v1',
    };
  }

  try {
    const platformInstructions = {
      instagram: 'Instagram: Engaging hook in the very first sentence, conversational storytelling, relevant emojis, clean line breaks for readability, and a clear call-to-action inviting users to visit/comment/engage.',
      linkedin: 'LinkedIn: Professional, insightful, high-value tone, clean paragraph spacing or bullet points if appropriate, business/career context, and an engaging professional discussion question.',
      facebook: 'Facebook: Community-friendly, warm and approachable, clearly highlights key details/events, and ends with an inviting question or CTA.',
      twitter: 'Twitter / X: Punchy, high-impact, concise (under 260 characters), with 1-2 relevant hashtags.',
      x: 'X / Twitter: Punchy, high-impact, concise (under 260 characters), with 1-2 relevant hashtags.',
    };

    const platformKey = (platform || 'general').toLowerCase();
    const platformRule = platformInstructions[platformKey] || 'General social media: Engaging hook, well-structured body, and relevant call-to-action.';

    const systemInstruction = `You are a professional social media copywriter. Generate content based on the user's exact request. The user's prompt is the primary source of truth. Do not invent a different business, product, event, discount, audience, or offer unless the user requests it. Use the selected platform, tone, target audience, and keywords as additional guidance. Return a complete, relevant caption. If the user's request is ambiguous, produce a reasonable general response without inventing specific facts.
Strict adherence:
1. Output ONLY the final caption text. Do not include introductory notes, conversational preambles, "Option 1 / Option 2" listings, quotation marks, or meta-commentary.
2. Adhere directly to the requested platform style.`;

    const promptParts = [
      `User Prompt: "${userPrompt}"`,
      `Target Platform: ${platform || 'General Social Media'}`,
      `Platform Style Guidelines: ${platformRule}`,
    ];
    if (tone) {
      promptParts.push(`Requested Tone: ${tone}`);
    }
    if (audience && audience.trim()) {
      promptParts.push(`Target Audience: ${audience.trim()}`);
    }
    if (keywords && keywords.length > 0) {
      promptParts.push(`Key Points / Keywords to include: ${keywords.join(', ')}`);
    }
    const userMessageContent = promptParts.join('\n');

    const { response, modelUsed } = await callGeminiWithResilience(client, configuredModel, {
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
      model: modelUsed,
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
  const configuredModel = getGeminiModel();

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
        : 'Generated using local template fallback mode (explicitly requested).',
      model: 'local-heuristic-v1',
    };
  }

  try {
    const systemInstruction = `You are a social media hashtag optimization specialist. Return only a valid JSON array of ${count} relevant hashtags without the leading '#' symbol, e.g. ["Tech", "Coding", "Developer"]. Base the hashtags directly on the user's prompt. Do not invent unrelated topics or products. If the prompt is generic, return versatile social media hashtags. Do not include any text or markdown formatting outside the JSON array.`;

    const userMessageContent = `Generate ${count} relevant hashtags for this post:
User Prompt: "${userPrompt}"
Platform: ${platform || 'General Social Media'}`;

    const { response, modelUsed } = await callGeminiWithResilience(client, configuredModel, {
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
      model: modelUsed,
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
  if (!userPrompt) {
    const err = new Error('A prompt or topic is required for AI generation.');
    err.statusCode = 400;
    throw err;
  }

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

  const client = getGeminiClient();
  const configuredModel = getGeminiModel();

  // If fallback is explicitly requested or client key missing
  if (!client || useFallback) {
    if (!client && !useFallback) {
      const err = new Error('GEMINI_API_KEY is not configured in server/.env. Please configure your Google Gemini API key.');
      err.statusCode = 503;
      err.code = 'MISSING_API_KEY';
      throw err;
    }

    return {
      caption: generateFallbackCaption({ prompt: userPrompt, topic: userPrompt, audience, tone, platform, keywords }),
      hashtags: generateFallbackHashtags({ prompt: userPrompt, topic: userPrompt, platform, count }),
      isMock: true,
      notice: !client
        ? 'Generated using local template fallback mode. Add GEMINI_API_KEY in server/.env for live Gemini responses.'
        : 'Generated using local template fallback mode (explicitly requested).',
      model: 'local-heuristic-v1',
    };
  }

  // Unified single-call generation with structured JSON for maximum speed and prompt coherence
  try {
    const platformInstructions = {
      instagram: 'Instagram: Engaging hook in the very first sentence, conversational storytelling, relevant emojis, clean line breaks for readability, and a clear call-to-action inviting users to comment/engage.',
      linkedin: 'LinkedIn: Professional, insightful, high-value tone, clean paragraph spacing or bullet points if appropriate, business/career context, and an engaging professional discussion question.',
      facebook: 'Facebook: Community-friendly, warm and approachable, clearly highlights key details/events, and ends with an inviting question or CTA.',
      twitter: 'Twitter / X: Punchy, high-impact, concise (under 260 characters), with 1-2 relevant hashtags.',
      x: 'X / Twitter: Punchy, high-impact, concise (under 260 characters), with 1-2 relevant hashtags.',
    };

    const platformKey = (platform || 'general').toLowerCase();
    const platformRule = platformInstructions[platformKey] || 'General social media: Engaging hook, well-structured body, and relevant call-to-action.';

    const systemInstruction = `You are a professional social media copywriter. Generate content based on the user's exact request. The user's prompt is the primary source of truth. Do not invent a different business, product, event, discount, audience, or offer unless the user requests it. Use the selected platform, tone, target audience, and keywords as additional guidance. Return a complete, relevant caption and suitable hashtags. If the user's request is ambiguous, produce a reasonable general response without inventing specific facts.
Return a valid JSON object with exactly two keys:
1. "caption": A string containing the complete, ready-to-publish social media caption. Do not include markdown code fences, "Option" listings, or conversational preambles inside the caption.
2. "hashtags": An array of ${count} relevant hashtag strings without the leading '#' symbol.`;

    const promptParts = [
      `User Prompt: "${userPrompt}"`,
      `Target Platform: ${platform || 'General Social Media'}`,
      `Platform Style Guidelines: ${platformRule}`,
    ];
    if (tone) {
      promptParts.push(`Requested Tone: ${tone}`);
    }
    if (audience && audience.trim()) {
      promptParts.push(`Target Audience: ${audience.trim()}`);
    }
    if (keywords && keywords.length > 0) {
      promptParts.push(`Key Points / Keywords to include: ${keywords.join(', ')}`);
    }
    const userMessageContent = promptParts.join('\n');

    const { response, modelUsed } = await callGeminiWithResilience(client, configuredModel, {
      contents: userMessageContent,
      config: {
        systemInstruction,
        temperature: 0.7,
        maxOutputTokens: 950,
        responseMimeType: 'application/json',
      },
    });

    const raw = response.text ? response.text.trim() : '{}';
    let parsedCaption = '';
    let parsedHashtags = [];

    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed.caption === 'string') {
        parsedCaption = parsed.caption.trim();
      }
      if (Array.isArray(parsed.hashtags)) {
        parsedHashtags = parsed.hashtags;
      }
    } catch {
      // If direct parse fails, extract caption or use fallback parser
      const match = raw.match(/"caption"\s*:\s*"([\s\S]*?)"\s*,\s*"hashtags"/);
      parsedCaption = match ? match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"') : raw;
    }

    // Clean and sanitize hashtags
    const cleanedHashtags = parsedHashtags
      .map((h) => String(h).replace(/^#/, '').replace(/[^a-zA-Z0-9_]/g, '').trim())
      .filter((h) => h.length > 1)
      .slice(0, count);

    // If for some reason hashtags were empty from JSON, generate quick fallback hashtags
    const finalHashtags = cleanedHashtags.length > 0
      ? cleanedHashtags
      : generateFallbackHashtags({ prompt: userPrompt, topic: userPrompt, platform, count });

    return {
      caption: parsedCaption || userPrompt,
      hashtags: finalHashtags,
      isMock: false,
      model: modelUsed,
      usage: response.usageMetadata
        ? {
            prompt_tokens: response.usageMetadata.promptTokenCount,
            completion_tokens: response.usageMetadata.candidatesTokenCount,
            total_tokens: response.usageMetadata.totalTokenCount,
          }
        : undefined,
    };
  } catch (error) {
    handleGeminiError(error, 'Unified Generation');
  }
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
