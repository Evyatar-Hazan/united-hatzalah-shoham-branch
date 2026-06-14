import React from 'react';
import { motion } from 'framer-motion';
import { useScrollTrigger } from '../hooks/useScrollTrigger';
import styles from './About.module.css';

const About: React.FC = () => {
  const { ref, isVisible } = useScrollTrigger();

  return (
    <section ref={ref} className={`${styles.about} section`}>
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isVisible ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.8 }}
        >
          <h2 className={styles.title}>על סניף שוהם</h2>
          <p className={styles.description}>
            סניף איחוד הצלה בשוהם משמש כשומר מלאך לתושבי העיר והסביבה. אנחנו מתנדבים מוקדשים,
            מיומנים ויציבים, הזמינים 24/7 להגיע לחירום בכל שעה של היום והלילה.
          </p>
          <div className={styles.valuesGrid}>
            <motion.div
              className={styles.valueCard}
              whileHover={{ y: -5 }}
              transition={{ duration: 0.3 }}
            >
              <h3>💪 מסירות</h3>
              <p>נמסור את הנפש בשביל חיי התושבים</p>
            </motion.div>
            <motion.div
              className={styles.valueCard}
              whileHover={{ y: -5 }}
              transition={{ duration: 0.3 }}
            >
              <h3>⚡ מהירות</h3>
              <p>תגובה מיידית בכל שעה ובכל מקום</p>
            </motion.div>
            <motion.div
              className={styles.valueCard}
              whileHover={{ y: -5 }}
              transition={{ duration: 0.3 }}
            >
              <h3>🤝 שיתוף פעולה</h3>
              <p>עבודה בשיתוף הקהילה וגופים אחרים</p>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default About;
