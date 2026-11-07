import React from 'react';
import { motion } from 'framer-motion';
import { useScrollTrigger } from '../hooks/useScrollTrigger';
import { branchHighlights } from '../content/branchContent';
import styles from './About.module.css';

const About: React.FC = () => {
  const { ref, isVisible } = useScrollTrigger();

  return (
    <section ref={ref} className={`${styles.about} section`} id="about">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isVisible ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.8 }}
        >
          <h2 className={styles.title}>על סניף שוהם</h2>
          <p className={styles.description}>
            סניף איחוד הצלה בשוהם והמושבים פועל מתוך חיבור עמוק לקהילה המקומית. המתנדבים
            מכירים את האזור, זמינים 24/7, ומגיעים במהירות כדי להעניק טיפול ראשוני מקצועי
            עד להגעת כוחות ההמשך.
          </p>
          <div className={styles.layout}>
            <div className={styles.valuesGrid}>
              {branchHighlights.map((item) => (
                <motion.div
                  key={item.id}
                  className={styles.valueCard}
                  whileHover={{ y: -5 }}
                  transition={{ duration: 0.3 }}
                >
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                </motion.div>
              ))}
            </div>

            <div className={styles.visualPanel}>
              <div className={styles.imageStack}>
                <img src="/images/shoham/album/album-12.jpg" alt="מפגש שטח של מתנדבי שוהם" />
                <img src="/images/shoham/community-evening.jpg" alt="ערב הוקרה וקהילה של הסניף" />
              </div>
              <div className={styles.quoteBox}>
                <p>
                  "הכוח של הסניף מתחיל במקצועיות, אבל נבנה באמת מהקרבה לתושבים,
                  לשטח ולאנשים שמרימים את המענה הזה בכל יום מחדש."
                </p>
                <span>הקהילה והמתנדבים של שוהם והמושבים</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default About;
