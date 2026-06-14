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

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

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
      
      // For Google OAuth, credential is the JWT ID token
      // Decode the JWT to extract user info
      let email = '';
      let name = '';
      let picture = '';

      // Try to decode JWT if it looks like a Google token
      if (credential.includes('.') && credential.split('.').length === 3) {
        try {
          const payload = JSON.parse(atob(credential.split('.')[1]));
          email = payload.email || '';
          name = payload.name || '';
          picture = payload.picture || '';
        } catch {
          // If decode fails, treat as email for mock login
          email = credential;
          name = credential.split('@')[0];
          picture = '';
        }
      } else {
        // Treat as email for mock login
        email = credential;
        name = credential.split('@')[0];
        picture = '';
      }

      console.log('Sending auth request with:', { email, name });

      const response = await fetch(`${API_URL}/api/auth/google-verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          name,
          picture,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Auth response error:', errorText);
        throw new Error('Authentication failed');
      }

      const result = await response.json();
      console.log('Auth response:', result);

      if (result.success && result.data) {
        const userData = result.data;
        // Store email as token since we use it for Bearer auth
        const authToken = userData.email;
        setToken(authToken);
        setUser(userData);

        // Save to localStorage
        localStorage.setItem('authToken', authToken);
        localStorage.setItem('authUser', JSON.stringify(userData));
        
        console.log('Login successful, user:', userData);
      } else {
        throw new Error('Invalid auth response');
      }
    } catch (error) {
      console.error('Login error:', error);
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
