import React from 'react';
import { Link } from 'react-router-dom';
import styles from './Footer.module.css';

const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className={styles.footer}>
      <div className="container">
        <div className={styles.content}>
          <div className={styles.section}>
            <h3>אודות</h3>
            <ul>
              <li>
                <a href="#about">על הסניף</a>
              </li>
              <li>
                <a href="#team">הצוות שלנו</a>
              </li>
              <li>
                <a href="#contact">יצירת קשר</a>
              </li>
            </ul>
          </div>

          <div className={styles.section}>
            <h3>משפטי</h3>
            <ul>
              <li>
                <a href="/privacy">מדיניות הפרטיות</a>
              </li>
              <li>
                <a href="/terms">תנאים וביטחון</a>
              </li>
              <li>
                <a href="/cookies">קבצי קוקיז</a>
              </li>
            </ul>
          </div>

          <div className={styles.section}>
            <h3>קהילה</h3>
            <ul>
              <li>
                <a href="#testimonials">חוות דעות</a>
              </li>
              <li>
                <a href="#stories">סיפורי הצלה</a>
              </li>
              <li>
                <a href="#volunteer">הצטרף כמתנדב</a>
              </li>
            </ul>
          </div>

          <div className={styles.section}>
            <h3>ניהול</h3>
            <ul>
              <li>
                <Link to="/admin" className={styles.adminLink}>פאנל ניהול</Link>
              </li>
            </ul>
          </div>
        </div>

        <div className={styles.divider}></div>

        <div className={styles.bottom}>
          <p>
            &copy; {currentYear} סניף איחוד הצלה שוהם. כל הזכויות שמורות.
          </p>
          <p className={styles.credits}>
            עוצב וייושם עם ❤️ לשמירה על חיים
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
