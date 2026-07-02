import { configureStore } from '@reduxjs/toolkit';
import authReducer from './authSlice';
import menuReducer from './menuSlice';
import ordersReducer from './ordersSlice';
import tablesReducer from './tablesSlice';
import profileReducer from './profileSlice';
import inventoryReducer from './inventorySlice';
import checkoutReducer from './checkoutSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    menu: menuReducer,
    orders: ordersReducer,
    tables: tablesReducer,
    profile: profileReducer,
    inventory: inventoryReducer,
    checkout: checkoutReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
