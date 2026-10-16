import express from 'express';
import {
  getAIStatus,
  handleGenerate,
  handleGenerateCaption,
  handleGenerateHashtags,
} from '../controllers/ai.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

// Protected by JWT authentication
router.use(protect);

router.get('/status', getAIStatus);
router.post('/generate', handleGenerate);
router.post('/generate-caption', handleGenerateCaption);
router.post('/generate-hashtags', handleGenerateHashtags);

export default router;
