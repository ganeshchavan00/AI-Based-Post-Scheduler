import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';

// Check Zernio configuration & connectivity status
export const fetchIntegrationStatus = createAsyncThunk(
  'social/fetchIntegrationStatus',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get('/social/status');
      return response.data.status;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message || 'Failed to check Zernio status');
    }
  }
);

// Fetch user's connected social accounts
export const fetchAccounts = createAsyncThunk(
  'social/fetchAccounts',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get('/social/accounts');
      return response.data.accounts || [];
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message || 'Failed to fetch social accounts');
    }
  }
);

// Get real OAuth connect authorization URL from Zernio
export const fetchConnectUrl = createAsyncThunk(
  'social/fetchConnectUrl',
  async ({ platform, redirectUrl }, { rejectWithValue }) => {
    try {
      const query = new URLSearchParams({ platform });
      if (redirectUrl) query.append('redirectUrl', redirectUrl);
      const response = await api.get(`/social/connect-url?${query.toString()}`);
      return response.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message || 'Failed to get connection URL');
    }
  }
);

// Connect a social account (OAuth callback / authorization save)
export const connectAccount = createAsyncThunk(
  'social/connectAccount',
  async (accountData, { rejectWithValue }) => {
    try {
      const response = await api.post('/social/connect', accountData);
      return response.data.account;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message || 'Failed to connect social account');
    }
  }
);

// Disconnect account
export const disconnectAccount = createAsyncThunk(
  'social/disconnectAccount',
  async (id, { rejectWithValue }) => {
    try {
      await api.delete(`/social/accounts/${id}`);
      return id;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message || 'Failed to disconnect account');
    }
  }
);

// Publish post immediately via connected provider
export const publishPost = createAsyncThunk(
  'social/publishPost',
  async (postId, { rejectWithValue }) => {
    try {
      const response = await api.post(`/posts/${postId}/publish`);
      return response.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message || 'Failed to publish post');
    }
  }
);

// Sync accounts directly from Zernio
export const syncAccounts = createAsyncThunk(
  'social/syncAccounts',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.post('/social/sync');
      return response.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message || 'Failed to sync accounts from Zernio');
    }
  }
);

const initialState = {
  accounts: [],
  integrationStatus: null,
  loading: false,
  connecting: false,
  syncing: false,
  publishing: false,
  error: null,
  successMessage: null,
};

const socialSlice = createSlice({
  name: 'social',
  initialState,
  reducers: {
    clearSocialMessages: (state) => {
      state.error = null;
      state.successMessage = null;
    },
  },
  extraReducers: (builder) => {
    // Fetch integration status
    builder.addCase(fetchIntegrationStatus.fulfilled, (state, action) => {
      state.integrationStatus = action.payload;
    });

    // Fetch accounts
    builder
      .addCase(fetchAccounts.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAccounts.fulfilled, (state, action) => {
        state.loading = false;
        state.accounts = action.payload;
      })
      .addCase(fetchAccounts.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // Fetch connect URL
    builder
      .addCase(fetchConnectUrl.pending, (state) => {
        state.connecting = true;
        state.error = null;
      })
      .addCase(fetchConnectUrl.fulfilled, (state) => {
        state.connecting = false;
      })
      .addCase(fetchConnectUrl.rejected, (state, action) => {
        state.connecting = false;
        state.error = action.payload;
      });

    // Connect account
    builder
      .addCase(connectAccount.pending, (state) => {
        state.connecting = true;
        state.error = null;
      })
      .addCase(connectAccount.fulfilled, (state, action) => {
        state.connecting = false;
        const index = state.accounts.findIndex(
          (a) => a.provider === action.payload.provider && a.providerAccountId === action.payload.providerAccountId
        );
        if (index >= 0) {
          state.accounts[index] = action.payload;
        } else {
          state.accounts.push(action.payload);
        }
        state.successMessage = action.payload.isSimulated
          ? `Connected ${action.payload.provider.toUpperCase()} (Simulated Test Account)!`
          : `Successfully verified and connected ${action.payload.provider.toUpperCase()} via Zernio!`;
      })
      .addCase(connectAccount.rejected, (state, action) => {
        state.connecting = false;
        state.error = action.payload;
      });

    // Disconnect account
    builder
      .addCase(disconnectAccount.fulfilled, (state, action) => {
        state.accounts = state.accounts.filter((a) => a._id !== action.payload);
        state.successMessage = 'Account disconnected successfully.';
      })
      .addCase(disconnectAccount.rejected, (state, action) => {
        state.error = action.payload;
      });

    // Publish post
    builder
      .addCase(publishPost.pending, (state) => {
        state.publishing = true;
        state.error = null;
        state.successMessage = null;
      })
      .addCase(publishPost.fulfilled, (state) => {
        state.publishing = false;
        state.successMessage = 'Post successfully published to connected social networks via Zernio!';
      })
      .addCase(publishPost.rejected, (state, action) => {
        state.publishing = false;
        state.error = action.payload;
      });

    // Sync accounts from Zernio
    builder
      .addCase(syncAccounts.pending, (state) => {
        state.syncing = true;
        state.error = null;
      })
      .addCase(syncAccounts.fulfilled, (state, action) => {
        state.syncing = false;
        state.accounts = action.payload.accounts || [];
        state.successMessage = action.payload.message || 'Accounts successfully synchronized from Zernio.';
      })
      .addCase(syncAccounts.rejected, (state, action) => {
        state.syncing = false;
        state.error = action.payload;
      });
  },
});

export const { clearSocialMessages } = socialSlice.actions;
export default socialSlice.reducer;

