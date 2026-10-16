import mongoose from 'mongoose';

const postSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    title: {
      type: String,
      trim: true,
      default: '',
      maxlength: [120, 'Title cannot exceed 120 characters'],
    },
    content: {
      type: String,
      required: [true, 'Post content is required'],
      trim: true,
      maxlength: [5000, 'Post content cannot exceed 5000 characters'],
    },
    hashtags: {
      type: [String],
      default: [],
    },
    mediaUrls: [
      {
        url: { type: String, required: true },
        filename: { type: String, required: true },
        mimeType: { type: String, required: true },
        size: { type: Number },
      },
    ],
    selectedPlatforms: {
      type: [
        {
          type: String,
          enum: ['twitter', 'linkedin', 'facebook', 'instagram', 'threads', 'pinterest', 'youtube'],
          lowercase: true,
        },
      ],
      default: [],
    },
    status: {
      type: String,
      enum: ['draft', 'scheduled', 'publishing', 'published', 'failed', 'cancelled'],
      default: 'draft',
      index: true,
    },
    scheduledAt: {
      type: Date,
      default: null,
      index: true,
    },
    publishedAt: {
      type: Date,
      default: null,
    },
    zernioPostId: {
      type: String,
      default: null,
    },
    providerResults: [
      {
        provider: { type: String, required: true },
        providerPostId: { type: String, default: null },
        platformPostUrl: { type: String, default: null },
        status: {
          type: String,
          enum: ['published', 'failed', 'pending', 'processing', 'uploading'],
          default: 'pending',
        },
        responsePayload: { type: mongoose.Schema.Types.Mixed },
        publishedAt: { type: Date },
        errorMessage: { type: String, default: null },
        errorCategory: { type: String, default: null },
      },
    ],
    errorMessage: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for fast querying & scheduler processing
postSchema.index({ userId: 1, createdAt: -1 });
postSchema.index({ status: 1, scheduledAt: 1 });

const Post = mongoose.model('Post', postSchema);
export default Post;
