import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from './index';

export interface InventoryIngredient {
  id: string;
  name: string;
  unit: string;
  currentStock: number;
  fullStock: number;
  alertQuantity: number;
}

interface InventoryState {
  ingredients: InventoryIngredient[];
  hydrated: boolean;
}

const initialState: InventoryState = {
  ingredients: [],
  hydrated: false,
};

const inventorySlice = createSlice({
  name: 'inventory',
  initialState,
  reducers: {
    setInventoryIngredients(state, action: PayloadAction<InventoryIngredient[]>) {
      state.ingredients = action.payload;
      state.hydrated = true;
    },
    upsertInventoryIngredient(state, action: PayloadAction<InventoryIngredient>) {
      const index = state.ingredients.findIndex((i) => i.id === action.payload.id);
      if (index >= 0) {
        state.ingredients[index] = { ...state.ingredients[index], ...action.payload };
      } else {
        state.ingredients.push(action.payload);
      }
      state.hydrated = true;
    },
    removeInventoryIngredient(state, action: PayloadAction<string>) {
      state.ingredients = state.ingredients.filter((i) => i.id !== action.payload);
    },
    clearInventory(state) {
      state.ingredients = [];
      state.hydrated = false;
    },
  },
});

export const {
  setInventoryIngredients,
  upsertInventoryIngredient,
  removeInventoryIngredient,
  clearInventory,
} = inventorySlice.actions;

export const selectInventoryIngredients = (state: RootState) => state.inventory.ingredients;
export const selectInventoryHydrated = (state: RootState) => state.inventory.hydrated;
export const selectLowStockIngredients = (state: RootState) =>
  state.inventory.ingredients.filter(
    (i) => i.alertQuantity > 0 && i.currentStock <= i.alertQuantity
  );

export default inventorySlice.reducer;
