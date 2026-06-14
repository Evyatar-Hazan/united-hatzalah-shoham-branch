import React from 'react';
import { motion } from 'framer-motion';
import styles from './Hero.module.css';

const Hero: React.FC = () => {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
        delayChildren: 0.3,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.8 },
    },
  };

  return (
    <section className={styles.hero}>
      <div className={styles.heroBackground}></div>
      <motion.div
        className={`${styles.container} container`}
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.h1 variants={itemVariants} className={styles.title}>
          הצלה שמצילה חיים
        </motion.h1>
        <motion.p variants={itemVariants} className={styles.subtitle}>
          סניף איחוד הצלה שוהם - שירותי חירום מקדמיים ותגובה מהירה לעת קריאה
        </motion.p>
        <motion.button
          variants={itemVariants}
          className={styles.ctaButton}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          aria-label="תרומה מצילת חיים"
        >
          תרומה מצילת חיים
        </motion.button>
      </motion.div>
    </section>
  );
};

export default Hero;
