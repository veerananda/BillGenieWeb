import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from './index';
import type { RestaurantProfile } from '../services/api';

interface ProfileState {
  profile: RestaurantProfile | null;
  hydrated: boolean;
}

const initialState: ProfileState = {
  profile: null,
  hydrated: false,
};

const profileSlice = createSlice({
  name: 'profile',
  initialState,
  reducers: {
    setProfile(state, action: PayloadAction<RestaurantProfile>) {
      state.profile = action.payload;
      state.hydrated = true;
    },
    updateProfile(state, action: PayloadAction<Partial<RestaurantProfile>>) {
      if (state.profile) {
        state.profile = { ...state.profile, ...action.payload };
      }
    },
    clearProfile(state) {
      state.profile = null;
      state.hydrated = false;
    },
  },
});

export const { setProfile, updateProfile, clearProfile } = profileSlice.actions;

export const selectProfile = (state: RootState) => state.profile.profile;
export const selectProfileHydrated = (state: RootState) => state.profile.hydrated;
export const selectIsSelfService = (state: RootState) =>
  state.profile.profile?.is_self_service ?? false;

export default profileSlice.reducer;
