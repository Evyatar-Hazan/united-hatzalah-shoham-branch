import React, { createContext, useContext, useState } from 'react';

interface User {
  id: string;
  email: string;
  name: string;
  picture: string | null;
  isAdmin: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (credential: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_URL = import.meta.env.VITE_API_URL || '';

const isUnexpiredSessionToken = (token: string) => {
  const parts = token.split('.');
  if (parts.length !== 3) return false;

  try {
    const normalized = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const payload = JSON.parse(atob(padded));
    return typeof payload.exp === 'number' && payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
};

const getStoredAuth = (): { user: User | null; token: string | null } => {
  const savedToken = localStorage.getItem('authToken');
  const savedUser = localStorage.getItem('authUser');

  if (!savedToken || !savedUser) {
    return { user: null, token: null };
  }

  try {
    if (!isUnexpiredSessionToken(savedToken)) {
      throw new Error('Stored admin session is invalid');
    }
    return { user: JSON.parse(savedUser), token: savedToken };
  } catch (error) {
    console.error('Failed to restore auth:', error);
    localStorage.removeItem('authToken');
    localStorage.removeItem('authUser');
    return { user: null, token: null };
  }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [storedAuth] = useState(getStoredAuth);
  const [user, setUser] = useState<User | null>(storedAuth.user);
  const [token, setToken] = useState<string | null>(storedAuth.token);
  const [isLoading, setIsLoading] = useState(false);

  const login = async (credential: string) => {
    try {
      setIsLoading(true);
      if (!credential || credential.split('.').length !== 3) {
        throw new Error('Google credential is missing or invalid');
      }

      const response = await fetch(`${API_URL}/api/auth/google-verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          credential,
        }),
      });

      if (!response.ok) {
        const errorResult = await response.json().catch(() => null);
        throw new Error(errorResult?.error || 'Authentication failed');
      }

      const result = await response.json();

      if (result.success && result.data) {
        const { sessionToken, ...userData } = result.data;
        if (typeof sessionToken !== 'string' || sessionToken.split('.').length !== 3) {
          throw new Error('Invalid admin session response');
        }
        setToken(sessionToken);
        setUser(userData);

        localStorage.setItem('authToken', sessionToken);
        localStorage.setItem('authUser', JSON.stringify(userData));
      } else {
        throw new Error('Invalid auth response');
      }
    } catch (error) {
      setIsLoading(false);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('authToken');
    localStorage.removeItem('authUser');

    // Clear Google Sign-In state if available
    if (window.google) {
      window.google.accounts.id.cancel();
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        login,
        logout,
        isAuthenticated: !!user && !!token,
        isLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

const useAuthHook = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = useAuthHook;
