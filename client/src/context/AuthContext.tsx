/**
 * Authentication context for managing user auth state.
 * Persists token to localStorage. Auth happens via chat commands.
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import type { Player } from "../types";
import * as api from "../api";

const TOKEN_KEY = "mud_auth_token";

type AuthState = "unauthenticated" | "authenticated" | "needs_character";

type AuthContextValue = {
  token: string | null;
  player: Player | null;
  authState: AuthState;
  isLoading: boolean;
  setAuth: (token: string, player: Player | null) => void;
  setPlayer: (player: Player) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

type AuthData = {
  token: string | null;
  player: Player | null;
  isLoading: boolean;
};

/**
 * Provider component for authentication context.
 * @param props - Component props
 * @param props.children - Child components to wrap
 * @returns Provider component wrapping children
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [authData, setAuthData] = useState<AuthData>({
    token: null,
    player: null,
    isLoading: true,
  });

  // Load token from localStorage on mount and fetch player data
  useEffect(() => {
    const loadAuth = async () => {
      const storedToken = localStorage.getItem(TOKEN_KEY);
      if (!storedToken) {
        setAuthData({ token: null, player: null, isLoading: false });
        return;
      }

      // Try to fetch player data
      try {
        const result = await api.getMe(storedToken);
        if (result.success && result.player) {
          // User has token and character - fully authenticated
          setAuthData({
            token: storedToken,
            player: result.player,
            isLoading: false,
          });
        } else if (result.success) {
          // User has token but no character - needs to create one
          setAuthData({
            token: storedToken,
            player: null,
            isLoading: false,
          });
        } else {
          // Token is invalid, clear it
          localStorage.removeItem(TOKEN_KEY);
          setAuthData({ token: null, player: null, isLoading: false });
        }
      } catch {
        // Network error - keep token but no player
        // User will need to re-authenticate if token is invalid
        setAuthData({
          token: storedToken,
          player: null,
          isLoading: false,
        });
      }
    };

    loadAuth();
  }, []);

  const setAuth = useCallback((newToken: string, newPlayer: Player | null) => {
    localStorage.setItem(TOKEN_KEY, newToken);
    setAuthData((prev) => ({
      ...prev,
      token: newToken,
      player: newPlayer,
    }));
  }, []);

  const setPlayer = useCallback((newPlayer: Player) => {
    setAuthData((prev) => ({
      ...prev,
      player: newPlayer,
    }));
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setAuthData((prev) => ({
      ...prev,
      token: null,
      player: null,
    }));
  }, []);

  const authState: AuthState = !authData.token
    ? "unauthenticated"
    : !authData.player
      ? "needs_character"
      : "authenticated";

  return (
    <AuthContext.Provider
      value={{
        token: authData.token,
        player: authData.player,
        authState,
        isLoading: authData.isLoading,
        setAuth,
        setPlayer,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook to access authentication state and functions.
 * @returns Auth context value
 * @throws Error if used outside of AuthProvider
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
