import React from 'react';
import { motion } from 'framer-motion';
import { useScrollTrigger } from '../hooks/useScrollTrigger';
import { branchOperations } from '../content/branchContent';
import styles from './Operations.module.css';

const Operations: React.FC = () => {
  const { ref, isVisible } = useScrollTrigger();

  return (
    <section ref={ref} className={`${styles.operations} section`} id="operations">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isVisible ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.8 }}
        >
          <div className={styles.header}>
            <p className={styles.eyebrow}>הפעילות מאחורי הקלעים</p>
            <h2 className={styles.title}>איך הסניף נראה ביום־יום</h2>
            <p className={styles.description}>
              מעבר למענה לקריאות, הסניף חי מתוך שגרת מוכנות, עבודה עם הקהילה, תחזוקת ציוד
              ובניית אמון שמאפשרים להגיע מוכנים יותר כשכל שנייה חשובה.
            </p>
          </div>

          <div className={styles.grid}>
            {branchOperations.map((item) => (
              <motion.article
                key={item.id}
                className={styles.card}
                whileHover={{ y: -6 }}
                transition={{ duration: 0.25 }}
              >
                <div className={styles.imageWrap}>
                  <img src={item.image} alt={item.title} />
                </div>
                <div className={styles.cardBody}>
                  <span className={styles.meta}>{item.meta}</span>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                </div>
              </motion.article>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default Operations;
