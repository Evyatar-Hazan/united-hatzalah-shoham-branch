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

  const handleGoogleCallback = React.useCallback(async (response: GoogleResponse) => {
    setError(null);
    try {
      await login(response.credential);
      navigate('/admin');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'נכשל בהתחברות. אנא נסה שוב.';
      setError(errorMessage);
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
