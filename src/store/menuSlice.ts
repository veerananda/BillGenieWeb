import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from './index';

export interface MenuItem {
  id: string;
  restaurant_id: string;
  name: string;
  category: string;
  price: number;
  cost_price?: number;
  is_veg: boolean;
  is_available: boolean;
  readily_available?: boolean;
}

interface MenuState {
  items: MenuItem[];
  hydrated: boolean;
}

const initialState: MenuState = {
  items: [],
  hydrated: false,
};

const menuSlice = createSlice({
  name: 'menu',
  initialState,
  reducers: {
    setMenuItems(state, action: PayloadAction<MenuItem[]>) {
      state.items = action.payload;
      state.hydrated = true;
    },
    addMenuItem(state, action: PayloadAction<MenuItem>) {
      state.items.push(action.payload);
    },
    updateMenuItem(state, action: PayloadAction<MenuItem>) {
      const index = state.items.findIndex((i) => i.id === action.payload.id);
      if (index >= 0) state.items[index] = action.payload;
    },
    removeMenuItem(state, action: PayloadAction<string>) {
      state.items = state.items.filter((i) => i.id !== action.payload);
    },
    clearMenu(state) {
      state.items = [];
      state.hydrated = false;
    },
  },
});

export const { setMenuItems, addMenuItem, updateMenuItem, removeMenuItem, clearMenu } = menuSlice.actions;

export const selectMenuItems = (state: RootState) => state.menu.items;
export const selectMenuHydrated = (state: RootState) => state.menu.hydrated;
export const selectMenuCategories = (state: RootState) =>
  [...new Set(state.menu.items.map((i) => i.category))].sort();

export default menuSlice.reducer;
