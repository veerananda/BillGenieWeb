import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from './index';
import type { RestaurantTable } from '../services/api';

interface TablesState {
  tables: RestaurantTable[];
  hydrated: boolean;
}

const initialState: TablesState = {
  tables: [],
  hydrated: false,
};

const tablesSlice = createSlice({
  name: 'tables',
  initialState,
  reducers: {
    setTables(state, action: PayloadAction<RestaurantTable[]>) {
      state.tables = action.payload;
      state.hydrated = true;
    },
    upsertTable(state, action: PayloadAction<RestaurantTable>) {
      const index = state.tables.findIndex((t) => t.id === action.payload.id);
      if (index >= 0) {
        state.tables[index] = { ...state.tables[index], ...action.payload };
      } else {
        state.tables.push(action.payload);
      }
    },
    setTableOccupied(
      state,
      action: PayloadAction<{ tableId: string; isOccupied: boolean; currentOrderId?: string | null }>
    ) {
      const t = state.tables.find((t) => t.id === action.payload.tableId);
      if (t) {
        t.is_occupied = action.payload.isOccupied;
        if (action.payload.currentOrderId !== undefined) {
          t.current_order_id = action.payload.currentOrderId ?? undefined;
        }
        if (!action.payload.isOccupied) {
          t.current_order_id = undefined;
        }
      }
    },
    removeTable(state, action: PayloadAction<string>) {
      state.tables = state.tables.filter((t) => t.id !== action.payload);
    },
    clearTables(state) {
      state.tables = [];
      state.hydrated = false;
    },
  },
});

export const { setTables, upsertTable, setTableOccupied, removeTable, clearTables } = tablesSlice.actions;

export const selectTables = (state: RootState) => state.tables.tables;
export const selectTablesHydrated = (state: RootState) => state.tables.hydrated;
export const selectOccupiedTables = (state: RootState) =>
  state.tables.tables.filter((t) => t.is_occupied);
export const selectVacantTables = (state: RootState) =>
  state.tables.tables.filter((t) => !t.is_occupied);

export default tablesSlice.reducer;
