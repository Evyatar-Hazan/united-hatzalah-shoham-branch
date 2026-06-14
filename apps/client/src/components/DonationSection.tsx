import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useScrollTrigger } from '../hooks/useScrollTrigger';
import styles from './DonationSection.module.css';

const PRESET_AMOUNTS = [50, 100, 250, 500];
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const DonationSection: React.FC = () => {
  const { ref, isVisible } = useScrollTrigger();
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleDonate = async () => {
    const amount = selectedAmount || parseFloat(customAmount);
    if (amount > 0) {
      setIsLoading(true);
      try {
        const response = await fetch(`${API_URL}/api/donations`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            amount,
            donorName: 'Anonymous',
            donorEmail: 'donor@example.com',
            message: 'Thank you for the opportunity to save lives!',
          }),
        });

        if (response.ok) {
          setShowSuccess(true);
          setTimeout(() => {
            setShowSuccess(false);
            setSelectedAmount(null);
            setCustomAmount('');
          }, 3000);
        }
      } catch (error) {
        console.error('Donation error:', error);
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <section ref={ref} className={`${styles.donation} section`}>
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isVisible ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.8 }}
        >
          <h2 className={styles.title}>תרומה מצילת חיים</h2>
          <p className={styles.subtitle}>
            כל תרומה חשובה לנו ועוזרת לצוות שלנו להצליח בחירום
          </p>

          <div className={styles.formContainer}>
            <div className={styles.amountsGrid}>
              {PRESET_AMOUNTS.map((amount) => (
                <motion.button
                  key={amount}
                  className={`${styles.amountButton} ${
                    selectedAmount === amount ? styles.active : ''
                  }`}
                  onClick={() => {
                    setSelectedAmount(amount);
                    setCustomAmount('');
                  }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  ₪{amount}
                </motion.button>
              ))}
            </div>

            <div className={styles.customAmountGroup}>
              <label htmlFor="customAmount" className={styles.label}>
                או הזן סכום אחר:
              </label>
              <div className={styles.inputWrapper}>
                <input
                  id="customAmount"
                  type="number"
                  min="1"
                  placeholder="סכום בש״ח"
                  value={customAmount}
                  onChange={(e) => {
                    setCustomAmount(e.target.value);
                    setSelectedAmount(null);
                  }}
                  className={styles.input}
                  aria-label="סכום תרומה מותאם"
                />
                <span className={styles.currencySymbol}>₪</span>
              </div>
            </div>

            <div className={styles.securityInfo}>
              <span>🔒</span>
              <p>התרומה מאובטחת בהצפנה SSL חזקה</p>
            </div>

            <motion.button
              className={styles.donateButton}
              onClick={handleDonate}
              disabled={!selectedAmount && !customAmount || isLoading}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              aria-label="שלח תרומה"
            >
              {isLoading ? 'שליחה...' : 'תרומה מהרצי'}
            </motion.button>
          </div>

          <AnimatePresence>
            {showSuccess && (
              <motion.div
                className={styles.successMessage}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <div className={styles.successContent}>
                  <span className={styles.checkmark}>✓</span>
                  <h3>תודה על התרומה!</h3>
                  <p>התרומה שלך קיבלה במהלך השנייה</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </section>
  );
};

export default DonationSection;
