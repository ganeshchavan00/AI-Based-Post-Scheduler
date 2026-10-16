import express from 'express';
import {
  getIntegrationStatus,
  getAccounts,
  getConnectUrl,
  connectAccount,
  disconnectAccount,
  syncAccounts,
} from '../controllers/social.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

router.use(protect);

router.get('/status', getIntegrationStatus);
router.get('/accounts', getAccounts);
router.get('/connect-url', getConnectUrl);
router.post('/connect', connectAccount);
router.post('/sync', syncAccounts);
router.delete('/accounts/:id', disconnectAccount);

export default router;
