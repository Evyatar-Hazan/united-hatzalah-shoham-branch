import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useScrollTrigger } from '../hooks/useScrollTrigger';
import styles from './Donors.module.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

interface Donor {
  id: string;
  name: string;
  category: string;
  logo?: string;
}

const Donors: React.FC = () => {
  const { ref, isVisible } = useScrollTrigger();
  const [donors, setDonors] = useState<Donor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDonors = async () => {
      try {
        const response = await fetch(`${API_URL}/api/donors`);
        const result = await response.json();
        if (result.success && result.data) {
          setDonors(result.data);
        }
      } catch (error) {
        console.error('Failed to fetch donors:', error);
        // Fallback to empty array if API fails
        setDonors([]);
      } finally {
        setLoading(false);
      }
    };

    fetchDonors();
  }, []);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
        delayChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, scale: 0.9 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: { duration: 0.4 },
    },
  };

  if (loading) {
    return (
      <section ref={ref} className={`${styles.donors} section`}>
        <div className="container">
          <h2 className={styles.title}>תורמים וחסויות</h2>
          <p style={{ textAlign: 'center', color: '#999' }}>טוען...</p>
        </div>
      </section>
    );
  }

  return (
    <section ref={ref} className={`${styles.donors} section`}>
      <div className="container">
        <h2 className={styles.title}>תורמים וחסויות</h2>
        <motion.div
          className={styles.grid}
          variants={containerVariants}
          initial="hidden"
          animate={isVisible ? 'visible' : 'hidden'}
        >
          {donors.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#999', gridColumn: '1 / -1' }}>אין תורמים זמינים</p>
          ) : (
            donors.map((donor) => (
              <motion.div
                key={donor.id}
                className={styles.donorCard}
                variants={itemVariants}
                whileHover={{ y: -4 }}
              >
                <div className={styles.logo}>
                  <span>{donor.name.charAt(0)}</span>
                </div>
                <h3 className={styles.name}>{donor.name}</h3>
                <p className={styles.category}>{donor.category}</p>
              </motion.div>
            ))
          )}
        </motion.div>
      </div>
    </section>
  );
};

export default Donors;
