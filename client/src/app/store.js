import { configureStore } from '@reduxjs/toolkit';
import authReducer from '../features/auth/authSlice';
import postsReducer from '../features/posts/postsSlice';
import socialReducer from '../features/social/socialSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    posts: postsReducer,
    social: socialReducer,
  },
  devTools: import.meta.env.MODE !== 'production',
});

export default store;
