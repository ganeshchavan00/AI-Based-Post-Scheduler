import express from 'express';
import {
  getPosts,
  getPostById,
  createPost,
  updatePost,
  deletePost,
  cancelScheduledPost,
  reschedulePost,
  triggerSchedulerRun,
} from '../controllers/post.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { upload } from '../middleware/upload.middleware.js';
import {
  createPostValidator,
  updatePostValidator,
  reschedulePostValidator,
  validatePost,
} from '../validators/post.validator.js';
import { publishPost } from '../controllers/social.controller.js';

const router = express.Router();

// Apply auth protection to all post routes
router.use(protect);

// Manual trigger for evaluating/running scheduler due queue
router.post('/scheduler/run-due', triggerSchedulerRun);

router
  .route('/')
  .get(getPosts)
  .post(upload.array('media', 4), createPostValidator, validatePost, createPost);

// Publishing & Scheduling state transitions
router.post('/:id/publish', publishPost);
router.post('/:id/cancel', cancelScheduledPost);
router.post('/:id/reschedule', reschedulePostValidator, validatePost, reschedulePost);

router
  .route('/:id')
  .get(getPostById)
  .put(upload.array('media', 4), updatePostValidator, validatePost, updatePost)
  .delete(deletePost);

export default router;
