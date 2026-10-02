import React from 'react';
import { motion } from 'framer-motion';
import styles from './Hero.module.css';

const Hero: React.FC = () => {
  const quickStats = [
    { value: '24/7', label: 'כוננות מקומית' },
    { value: 'דקות', label: 'מרגע הקריאה עד היציאה' },
    { value: 'קהילה', label: 'שותפות שמחזיקה את הסניף' },
  ];

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
    <section className={styles.hero} id="top">
      <div className={styles.heroBackground}></div>
      <motion.div
        className={`${styles.container} container`}
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <div className={styles.heroLayout}>
          <div className={styles.copyColumn}>
            <motion.p variants={itemVariants} className={styles.eyebrow}>
              סניף שוהם והמושבים | איחוד הצלה
            </motion.p>
            <motion.h1 variants={itemVariants} className={styles.title}>
              מתנדבים מקומיים. תגובה מהירה. נוכחות שמצילה חיים.
            </motion.h1>
            <motion.p variants={itemVariants} className={styles.subtitle}>
              סניף איחוד הצלה שוהם פועל מסביב לשעון כדי להגיע בתוך דקות לקריאות חירום,
              להעניק טיפול ראשוני מקצועי, ולהחזיק מערך קהילתי חזק שנראה בשטח גם בשגרה.
            </motion.p>
            <motion.div variants={itemVariants} className={styles.actions}>
              <motion.a
                href="#gallery"
                className={styles.ctaButton}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.98 }}
              >
                לצפייה בפעילות הסניף
              </motion.a>
              <motion.a
                href="#contact"
                className={styles.secondaryButton}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.98 }}
              >
                יצירת קשר עם הסניף
              </motion.a>
            </motion.div>
            <motion.div variants={itemVariants} className={styles.statsRow}>
              {quickStats.map((stat) => (
                <div key={stat.label} className={styles.statCard}>
                  <strong>{stat.value}</strong>
                  <span>{stat.label}</span>
                </div>
              ))}
            </motion.div>
          </div>

          <motion.div variants={itemVariants} className={styles.mediaColumn}>
            <div className={styles.heroCardLarge}>
              <img src="/images/shoham/album/album-08.jpg" alt="ציוד ומוכנות של סניף שוהם" />
              <div className={styles.heroCardCaption}>
                <span>מוכנות רפואית</span>
                <p>ציוד, תרגול ותגובה מהירה בשטח.</p>
              </div>
            </div>
            <div className={styles.heroCardGrid}>
              <div className={styles.heroCardSmall}>
                <img src="/images/shoham/album/album-09.jpg" alt="פעילות קהילתית של הסניף" />
              </div>
              <div className={styles.heroCardSmall}>
                <img src="/images/shoham/album/album-12.jpg" alt="מפגש מתנדבים וקהילה" />
              </div>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
};

export default Hero;
