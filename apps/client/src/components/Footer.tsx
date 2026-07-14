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
            <h3>ניווט</h3>
            <ul>
              <li>
                <a href="#about">על הסניף</a>
              </li>
              <li>
                <a href="#gallery">גלריה</a>
              </li>
              <li>
                <a href="#contact">יצירת קשר</a>
              </li>
            </ul>
          </div>

          <div className={styles.section}>
            <h3>פעילות</h3>
            <ul>
              <li>
                <a href="#stories">מאחורי הפעילות</a>
              </li>
              <li>
                <a href="#donors">שותפים ותורמים</a>
              </li>
              <li>
                <a href="#donate">תרומה לסניף</a>
              </li>
            </ul>
          </div>

          <div className={styles.section}>
            <h3>קהילה</h3>
            <ul>
              <li>
                <a href="#gallery">תמונות מהשטח</a>
              </li>
              <li>
                <a href="#stories">סיפורי הצלה</a>
              </li>
              <li>
                <a href="#contact">הצטרפות ויצירת קשר</a>
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
            נבנה כדי לשקף פעילות אמיתית, זמינות קהילתית והצלת חיים.
          </p>
          <p className={styles.builderCredit}>
            נבנה באהבה על ידי{' '}
            <a
              href="https://evyatarhazan.com"
              target="_blank"
              rel="noopener noreferrer"
            >
              evyatarhazan.com
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
