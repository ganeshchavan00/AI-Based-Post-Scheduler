import mongoose from 'mongoose';

const socialAccountSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    provider: {
      type: String,
      required: [true, 'Social provider is required'],
      enum: {
        values: ['twitter', 'linkedin', 'facebook', 'instagram', 'threads', 'pinterest', 'youtube'],
        message: '{VALUE} is not a supported social provider',
      },
      lowercase: true,
      trim: true,
    },
    providerAccountId: {
      type: String,
      required: [true, 'Provider account ID is required'],
      trim: true,
    },
    accountDisplayName: {
      type: String,
      required: [true, 'Account display name is required'],
      trim: true,
    },
    accountUsername: {
      type: String,
      trim: true,
      default: '',
    },
    accountAvatarUrl: {
      type: String,
      trim: true,
      default: '',
    },
    // Encrypted token payload or provider-managed reference
    encryptedCredentials: {
      type: {
        iv: String,
        data: String,
        tag: String,
      },
      select: false, // Exclude from ordinary queries for security
    },
    connectionStatus: {
      type: String,
      enum: ['connected', 'disconnected', 'expired', 'error'],
      default: 'connected',
      index: true,
    },
    isSimulated: {
      type: Boolean,
      default: false,
      index: true,
    },
    zernioProfileId: {
      type: String,
      trim: true,
      default: null,
    },
    lastSyncAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        delete ret.encryptedCredentials;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Compound index to ensure a user cannot link the duplicate account for the same provider twice
socialAccountSchema.index({ userId: 1, provider: 1, providerAccountId: 1 }, { unique: true });

const SocialAccount = mongoose.model('SocialAccount', socialAccountSchema);
export default SocialAccount;
