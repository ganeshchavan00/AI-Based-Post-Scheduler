import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';

// Fetch paginated posts with filters
export const fetchPosts = createAsyncThunk(
  'posts/fetchPosts',
  async (params = {}, { rejectWithValue }) => {
    try {
      const { status, platform, search, page = 1, limit = 10 } = params;
      const queryParams = new URLSearchParams();
      if (status && status !== 'all') queryParams.append('status', status);
      if (platform && platform !== 'all') queryParams.append('platform', platform);
      if (search) queryParams.append('search', search);
      queryParams.append('page', page);
      queryParams.append('limit', limit);

      const response = await api.get(`/posts?${queryParams.toString()}`);
      return response.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message || 'Failed to fetch posts');
    }
  }
);

// Fetch dashboard stats & recent posts
export const fetchDashboardStats = createAsyncThunk(
  'posts/fetchDashboardStats',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get('/dashboard/stats');
      return response.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message || 'Failed to fetch dashboard metrics');
    }
  }
);

// Create new post (supports FormData for media uploads)
export const createPost = createAsyncThunk(
  'posts/createPost',
  async (postData, { rejectWithValue }) => {
    try {
      const isFormData = postData instanceof FormData;
      const headers = isFormData ? { 'Content-Type': 'multipart/form-data' } : {};

      const response = await api.post('/posts', postData, { headers });
      return response.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message || 'Failed to create post');
    }
  }
);

// Update existing post
export const updatePost = createAsyncThunk(
  'posts/updatePost',
  async ({ id, postData }, { rejectWithValue }) => {
    try {
      const isFormData = postData instanceof FormData;
      const headers = isFormData ? { 'Content-Type': 'multipart/form-data' } : {};

      const response = await api.put(`/posts/${id}`, postData, { headers });
      return response.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message || 'Failed to update post');
    }
  }
);

// Delete post
export const deletePost = createAsyncThunk(
  'posts/deletePost',
  async (id, { rejectWithValue }) => {
    try {
      await api.delete(`/posts/${id}`);
      return id;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message || 'Failed to delete post');
    }
  }
);

// Cancel scheduled post
export const cancelSchedule = createAsyncThunk(
  'posts/cancelSchedule',
  async ({ id, toDraft = false }, { rejectWithValue }) => {
    try {
      const response = await api.post(`/posts/${id}/cancel${toDraft ? '?toDraft=true' : ''}`);
      return response.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message || 'Failed to cancel post schedule');
    }
  }
);

// Reschedule post
export const reschedulePost = createAsyncThunk(
  'posts/reschedulePost',
  async ({ id, scheduledAt }, { rejectWithValue }) => {
    try {
      const response = await api.post(`/posts/${id}/reschedule`, { scheduledAt });
      return response.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message || 'Failed to reschedule post');
    }
  }
);

// Publish post now
export const publishPostNow = createAsyncThunk(
  'posts/publishPostNow',
  async (id, { rejectWithValue }) => {
    try {
      const response = await api.post(`/posts/${id}/publish`);
      return response.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message || 'Failed to publish post');
    }
  }
);

// Trigger manual run of due scheduler queue
export const runDueScheduler = createAsyncThunk(
  'posts/runDueScheduler',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.post('/posts/scheduler/run-due');
      return response.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message || 'Failed to trigger scheduler queue');
    }
  }
);

const initialState = {
  posts: [],
  recentPosts: [],
  currentPost: null,
  stats: {
    total: 0,
    published: 0,
    scheduled: 0,
    draft: 0,
    failed: 0,
    cancelled: 0,
  },
  total: 0,
  page: 1,
  totalPages: 1,
  loading: false,
  submitting: false,
  actionLoadingId: null,
  error: null,
  successMessage: null,
};

const postsSlice = createSlice({
  name: 'posts',
  initialState,
  reducers: {
    clearPostMessages: (state) => {
      state.error = null;
      state.successMessage = null;
    },
    setCurrentPost: (state, action) => {
      state.currentPost = action.payload;
    },
  },
  extraReducers: (builder) => {
    // Fetch posts
    builder
      .addCase(fetchPosts.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchPosts.fulfilled, (state, action) => {
        state.loading = false;
        state.posts = action.payload.posts || [];
        state.total = action.payload.total || 0;
        state.page = action.payload.page || 1;
        state.totalPages = action.payload.totalPages || 1;
        if (action.payload.stats) {
          state.stats = action.payload.stats;
        }
      })
      .addCase(fetchPosts.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // Fetch dashboard stats
    builder.addCase(fetchDashboardStats.fulfilled, (state, action) => {
      if (action.payload.stats) {
        state.stats = action.payload.stats;
      }
      if (action.payload.recentPosts) {
        state.recentPosts = action.payload.recentPosts;
      }
    });

    // Create post
    builder
      .addCase(createPost.pending, (state) => {
        state.submitting = true;
        state.error = null;
        state.successMessage = null;
      })
      .addCase(createPost.fulfilled, (state, action) => {
        state.submitting = false;
        state.posts.unshift(action.payload.post);
        state.stats.total += 1;
        if (action.payload.post.status === 'draft') state.stats.draft += 1;
        if (action.payload.post.status === 'scheduled') state.stats.scheduled += 1;
        state.successMessage = 'Post saved successfully!';
      })
      .addCase(createPost.rejected, (state, action) => {
        state.submitting = false;
        state.error = action.payload;
      });

    // Update post
    builder
      .addCase(updatePost.pending, (state) => {
        state.submitting = true;
        state.error = null;
      })
      .addCase(updatePost.fulfilled, (state, action) => {
        state.submitting = false;
        state.posts = state.posts.map((p) =>
          p._id === action.payload.post._id ? action.payload.post : p
        );
        state.successMessage = 'Post updated successfully!';
      })
      .addCase(updatePost.rejected, (state, action) => {
        state.submitting = false;
        state.error = action.payload;
      });

    // Delete post
    builder.addCase(deletePost.fulfilled, (state, action) => {
      const deletedId = action.payload;
      state.posts = state.posts.filter((p) => p._id !== deletedId);
      state.recentPosts = state.recentPosts.filter((p) => p._id !== deletedId);
      state.stats.total = Math.max(0, state.stats.total - 1);
      state.successMessage = 'Post deleted successfully.';
    });

    // Cancel schedule
    builder
      .addCase(cancelSchedule.pending, (state, action) => {
        state.actionLoadingId = action.meta.arg.id;
        state.error = null;
      })
      .addCase(cancelSchedule.fulfilled, (state, action) => {
        state.actionLoadingId = null;
        const updated = action.payload.post;
        state.posts = state.posts.map((p) => (p._id === updated._id ? updated : p));
        state.successMessage = action.payload.message || 'Post schedule cancelled.';
      })
      .addCase(cancelSchedule.rejected, (state, action) => {
        state.actionLoadingId = null;
        state.error = action.payload;
      });

    // Reschedule post
    builder
      .addCase(reschedulePost.pending, (state, action) => {
        state.actionLoadingId = action.meta.arg.id;
        state.error = null;
      })
      .addCase(reschedulePost.fulfilled, (state, action) => {
        state.actionLoadingId = null;
        const updated = action.payload.post;
        state.posts = state.posts.map((p) => (p._id === updated._id ? updated : p));
        state.successMessage = action.payload.message || 'Post rescheduled successfully.';
      })
      .addCase(reschedulePost.rejected, (state, action) => {
        state.actionLoadingId = null;
        state.error = action.payload;
      });

    // Publish post now
    builder
      .addCase(publishPostNow.pending, (state, action) => {
        state.actionLoadingId = action.meta.arg;
        state.error = null;
      })
      .addCase(publishPostNow.fulfilled, (state, action) => {
        state.actionLoadingId = null;
        const updated = action.payload.post;
        state.posts = state.posts.map((p) => (p._id === updated._id ? updated : p));
        state.successMessage = action.payload.message || 'Post published successfully!';
      })
      .addCase(publishPostNow.rejected, (state, action) => {
        state.actionLoadingId = null;
        state.error = action.payload;
      });

    // Run due scheduler
    builder
      .addCase(runDueScheduler.fulfilled, (state, action) => {
        state.successMessage = `Scheduler processed: ${action.payload.summary?.published || 0} post(s) published.`;
      })
      .addCase(runDueScheduler.rejected, (state, action) => {
        state.error = action.payload;
      });
  },
});

export const { clearPostMessages, setCurrentPost } = postsSlice.actions;
export default postsSlice.reducer;
