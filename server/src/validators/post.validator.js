import { body, validationResult } from 'express-validator';

/**
 * Middleware to evaluate validation errors
 */
export const validatePost = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map((err) => ({
      field: err.path || err.param,
      message: err.msg,
    }));

    return res.status(400).json({
      success: false,
      message: formattedErrors[0]?.message || 'Validation failed for post',
      errors: formattedErrors,
    });
  }
  next();
};

/**
 * Validation rules for creating a post
 */
export const createPostValidator = [
  body('content')
    .trim()
    .notEmpty()
    .withMessage('Post content cannot be empty')
    .isLength({ max: 5000 })
    .withMessage('Post content cannot exceed 5000 characters'),
  body('title')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 120 })
    .withMessage('Post title cannot exceed 120 characters'),
  body('scheduledAt')
    .optional({ checkFalsy: true })
    .custom((value, { req }) => {
      const scheduledDate = new Date(value);
      if (isNaN(scheduledDate.getTime())) {
        throw new Error('Scheduled date must be a valid ISO date');
      }
      if (req.body.status === 'scheduled' && scheduledDate <= new Date()) {
        throw new Error('Scheduled date and time must be set in the future');
      }
      return true;
    }),
];

/**
 * Validation rules for updating a post
 */
export const updatePostValidator = [
  body('content')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Post content cannot be empty')
    .isLength({ max: 5000 })
    .withMessage('Post content cannot exceed 5000 characters'),
  body('title')
    .optional()
    .trim()
    .isLength({ max: 120 })
    .withMessage('Post title cannot exceed 120 characters'),
  body('scheduledAt')
    .optional({ checkFalsy: true })
    .custom((value, { req }) => {
      const scheduledDate = new Date(value);
      if (isNaN(scheduledDate.getTime())) {
        throw new Error('Scheduled date must be a valid ISO date');
      }
      if (req.body.status === 'scheduled' && scheduledDate <= new Date()) {
        throw new Error('Scheduled date and time must be set in the future');
      }
      return true;
    }),
];

/**
 * Validation rules for rescheduling a post
 */
export const reschedulePostValidator = [
  body('scheduledAt')
    .notEmpty()
    .withMessage('Scheduled date and time is required')
    .custom((value) => {
      const scheduledDate = new Date(value);
      if (isNaN(scheduledDate.getTime())) {
        throw new Error('Scheduled date must be a valid date');
      }
      if (scheduledDate <= new Date()) {
        throw new Error('Scheduled date and time must be set in the future');
      }
      return true;
    }),
];

