"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
  type ReactNode,
} from "react";

import {
  CART_STORAGE_KEY,
  cartReducer,
  createEmptyCart,
  parseStoredCart,
  serialiseCart,
} from "@/lib/store/cart";
import type { Cart } from "@/types/cart";
import type { Product } from "@/types/database";

/** What every cart consumer gets: the cart itself plus the actions on it. */
export interface CartContextValue {
  cart: Cart;
  /**
   * False until the persisted cart has been read back. Consumers that render
   * a count should show a neutral value while this is false, otherwise the
   * badge would animate from 0 up to the restored total on every page load.
   */
  isHydrated: boolean;
  addItem: (product: Product, quantity?: number) => void;
  setQuantity: (product: Product, quantity: number) => void;
  removeItem: (product: Product) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export interface CartProviderProps {
  children: ReactNode;
}

/**
 * Client-side cart state, persisted to `localStorage`.
 *
 * The reducer and the storage encoding both live in `lib/store/cart.ts` as
 * pure functions, so this file only owns the React half: state, the effect that
 * rehydrates from storage, and the effect that writes changes back.
 *
 * Mounted once in `app/layout.tsx`, which is why the navbar badge and the
 * "add to cart" button on a server-rendered page can share one cart.
 */
export function CartProvider({ children }: CartProviderProps) {
  const [cart, dispatch] = useReducer(cartReducer, undefined, createEmptyCart);
  const [isHydrated, setIsHydrated] = useState(false);

  // Rehydrate after mount rather than during render: `localStorage` does not
  // exist on the server, and reading it while rendering would desynchronise
  // the server HTML from the first client render.
  useEffect(() => {
    const stored = parseStoredCart(window.localStorage.getItem(CART_STORAGE_KEY));

    if (stored) dispatch({ type: "hydrate", cart: stored });
    setIsHydrated(true);
  }, []);

  // Persist every change. Guarded on `isHydrated` so the first render — still
  // holding the empty cart — cannot overwrite a saved cart that has not been
  // read back yet.
  useEffect(() => {
    if (!isHydrated) return;

    if (cart.lines.length === 0) {
      window.localStorage.removeItem(CART_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(CART_STORAGE_KEY, serialiseCart(cart));
  }, [cart, isHydrated]);

  const addItem = useCallback(
    (product: Product, quantity = 1) => dispatch({ type: "add", product, quantity }),
    [],
  );
  const setQuantity = useCallback(
    (product: Product, quantity: number) => dispatch({ type: "setQuantity", product, quantity }),
    [],
  );
  const removeItem = useCallback((product: Product) => dispatch({ type: "remove", product }), []);
  const clearCart = useCallback(() => dispatch({ type: "clear" }), []);

  // Memoised so the badge in the navbar does not re-render every consumer of
  // this context whenever an unrelated part of the tree updates.
  const value = useMemo<CartContextValue>(
    () => ({ cart, isHydrated, addItem, setQuantity, removeItem, clearCart }),
    [cart, isHydrated, addItem, setQuantity, removeItem, clearCart],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

/**
 * Reads the cart. Throws outside a `CartProvider` rather than returning a
 * silently inert default, so a missing provider in the layout fails loudly in
 * development instead of looking like a cart that never updates.
 */
export function useCart(): CartContextValue {
  const context = useContext(CartContext);

  if (!context) {
    throw new Error("useCart must be used inside a <CartProvider> (see app/layout.tsx).");
  }

  return context;
}
