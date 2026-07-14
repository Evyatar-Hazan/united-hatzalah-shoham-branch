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

const getStoredAuth = (): { user: User | null; token: string | null } => {
  const savedToken = localStorage.getItem('authToken');
  const savedUser = localStorage.getItem('authUser');

  if (!savedToken || !savedUser) {
    return { user: null, token: null };
  }

  try {
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
        const userData = result.data;
        // Store email as token since we use it for Bearer auth
        const authToken = userData.email;
        setToken(authToken);
        setUser(userData);

        // Save to localStorage
        localStorage.setItem('authToken', authToken);
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
