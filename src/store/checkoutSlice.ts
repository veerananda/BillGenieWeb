import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from './index';

interface CheckoutState {
  activeOrderId: string | null;
  isProcessing: boolean;
}

const initialState: CheckoutState = {
  activeOrderId: null,
  isProcessing: false,
};

const checkoutSlice = createSlice({
  name: 'checkout',
  initialState,
  reducers: {
    startCheckout(state, action: PayloadAction<string>) {
      state.activeOrderId = action.payload;
      state.isProcessing = false;
    },
    cancelCheckout(state) {
      state.activeOrderId = null;
      state.isProcessing = false;
    },
    setCheckoutProcessing(state, action: PayloadAction<boolean>) {
      state.isProcessing = action.payload;
    },
  },
});

export const { startCheckout, cancelCheckout, setCheckoutProcessing } = checkoutSlice.actions;

export const selectCheckoutOrderId = (state: RootState) => state.checkout.activeOrderId;
export const selectCheckoutProcessing = (state: RootState) => state.checkout.isProcessing;

export default checkoutSlice.reducer;
