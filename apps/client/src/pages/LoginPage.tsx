import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import styles from './LoginPage.module.css';

interface GoogleConfig {
  client_id: string;
  callback: (response: GoogleResponse) => Promise<void>;
}

interface GoogleResponse {
  credential: string;
}

interface GoogleAccounts {
  id: {
    initialize: (config: GoogleConfig) => void;
    renderButton: (element: HTMLElement, options: Record<string, unknown>) => void;
    cancel: () => void;
  };
}

declare global {
  interface Window {
    google?: {
      accounts: GoogleAccounts;
    };
  }
}

const LoginPage: React.FC = () => {
  const { login, isLoading } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  const handleMockLogin = React.useCallback(async () => {
    setError(null);
    try {
      // Use the email address from seed data
      const mockEmail = 'admin@shoham.united-hatzalah.org.il';
      await login(mockEmail);
      navigate('/admin');
    } catch (err) {
      setError('נכשל בהתחברות. אנא נסה שוב.');
      console.error('Login error:', err);
    }
  }, [login, navigate]);

  const handleGoogleCallback = React.useCallback(async (response: GoogleResponse) => {
    setError(null);
    try {
      console.log('Google callback received, credential length:', response.credential.length);
      await login(response.credential);
      console.log('Login successful, navigating to admin');
      navigate('/admin');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'נכשל בהתחברות. אנא נסה שוב.';
      setError(errorMessage);
      console.error('Login error:', err);
    }
  }, [login, navigate]);

  React.useEffect(() => {
    const initGoogleSignIn = () => {
      if (window.google) {
        window.google.accounts.id.initialize({
          client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
          callback: handleGoogleCallback,
        });

        const buttonElement = document.getElementById('google-signin-button');
        if (buttonElement) {
          window.google.accounts.id.renderButton(buttonElement, {
            type: 'standard',
            size: 'large',
            theme: 'outline',
            text: 'signin_with',
            locale: 'he',
          });
        }
      }
    };

    // Load Google Sign-In script
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = initGoogleSignIn;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    }
  }, [handleGoogleCallback]);

  return (
    <div className={styles.container}>
      <div className={styles.loginBox}>
        <div className={styles.header}>
          <h1>פאנל ניהול</h1>
          <p>איחוד הצלה סניף שוהם</p>
        </div>

        <div className={styles.loginContent}>
          <h2>כניסה לניהול</h2>
          <p className={styles.subtitle}>התחבר עם חשבון Google שלך כדי לנהל את האתר</p>

          {error && <div className={styles.error}>{error}</div>}

          <div id="google-signin-button" className={styles.googleButton}></div>

          {isLoading && <div className={styles.loading}>טוען...</div>}

          {/* Mock Login - Local Development Only */}
          {import.meta.env.DEV && (
            <div className={styles.mockLoginSection}>
              <p className={styles.mockLabel}>📌 מצב פיתוח - התחברות ללא אמות:</p>
              <button
                onClick={handleMockLogin}
                disabled={isLoading}
                className={styles.mockLoginButton}
              >
                {isLoading ? 'מתחבר...' : 'התחברות כמנהל (Mock)'}
              </button>
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <p>רק מנהלים מורשים יכולים להיכנס לפאנל זה</p>
        </div>
      </div>

      <div className={styles.background}></div>
    </div>
  );
};

export default LoginPage;
