import express from 'express';
import { register, login, getMe } from '../controllers/auth.controller.js';
import { registerValidator, loginValidator, validate } from '../validators/auth.validator.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

// Registration route
router.post('/register', registerValidator, validate, register);

// Login route
router.post('/login', loginValidator, validate, login);

// Current user profile route
router.get('/me', protect, getMe);

export default router;
