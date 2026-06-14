import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useScrollTrigger } from '../hooks/useScrollTrigger';
import styles from './Contact.module.css';

interface ContactInfo {
  phone: string;
  email: string;
  address: string;
  socialLinks: {
    facebook: string;
    instagram: string;
    whatsapp: string;
  };
  emergencyNumber: string;
  businessHours: {
    weekday: string;
    weekend: string;
  };
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const Contact: React.FC = () => {
  const { ref, isVisible } = useScrollTrigger();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: '',
  });
  const [contactInfo, setContactInfo] = useState<ContactInfo | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  useEffect(() => {
    const fetchContactInfo = async () => {
      try {
        const response = await fetch(`${API_URL}/api/contact/info`);
        if (response.ok) {
          const result = await response.json();
          // Ensure data has all required fields with defaults
          const data = result.data || {};
          setContactInfo({
            email: data.email || 'contact@example.com',
            phone: data.phone || 'N/A',
            address: data.address || 'N/A',
            emergencyNumber: data.emergencyNumber || '101',
            businessHours: data.businessHours || {
              weekday: 'N/A',
              weekend: 'N/A',
            },
            socialLinks: data.socialLinks || {
              facebook: '#',
              instagram: '#',
              whatsapp: '#',
            },
          });
        }
      } catch (error) {
        console.error('Failed to fetch contact info:', error);
      }
    };

    fetchContactInfo();
  }, []);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_URL}/api/contact`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setSubmitSuccess(true);
        setFormData({ name: '', email: '', message: '' });
        setTimeout(() => setSubmitSuccess(false), 3000);
      }
    } catch (error) {
      console.error('Failed to submit form:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!contactInfo) {
    return (
      <section ref={ref} className={`${styles.contact} section`}>
        <div className="container">
          <h2 className={styles.title}>יצירת קשר</h2>
          <p>טוען...</p>
        </div>
      </section>
    );
  }

  return (
    <section ref={ref} className={`${styles.contact} section`}>
      <div className="container">
        <h2 className={styles.title}>יצירת קשר</h2>
        <div className={styles.content}>
          <motion.div
            className={styles.contactInfo}
            initial={{ opacity: 0, x: -30 }}
            animate={isVisible ? { opacity: 1, x: 0 } : { opacity: 0, x: -30 }}
            transition={{ duration: 0.8 }}
          >
            <div className={styles.infoItem}>
              <h3>📞 טלפון</h3>
              <a href={`tel:${contactInfo.phone.replace(/\s/g, '')}`}>
                {contactInfo.phone}
              </a>
            </div>
            <div className={styles.infoItem}>
              <h3>📧 דוא״ל</h3>
              <a href={`mailto:${contactInfo.email}`}>
                {contactInfo.email}
              </a>
            </div>
            <div className={styles.infoItem}>
              <h3>📍 כתובת</h3>
              <p>{contactInfo.address}</p>
            </div>
            <div className={styles.infoItem}>
              <h3>🚨 חירום</h3>
              <a href={`tel:${contactInfo.emergencyNumber}`}>
                {contactInfo.emergencyNumber}
              </a>
            </div>
            <div className={styles.socialLinks}>
              <h3>📱 עקב אחרינו</h3>
              <div className={styles.links}>
                <a 
                  href={contactInfo.socialLinks.facebook} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  aria-label="פייסבוק"
                >
                  f
                </a>
                <a 
                  href={contactInfo.socialLinks.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="אינסטגרם"
                >
                  📷
                </a>
                <a 
                  href={contactInfo.socialLinks.whatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="וואטסאפ"
                >
                  💬
                </a>
              </div>
            </div>
          </motion.div>

          <motion.form
            className={styles.form}
            onSubmit={handleSubmit}
            initial={{ opacity: 0, x: 30 }}
            animate={isVisible ? { opacity: 1, x: 0 } : { opacity: 0, x: 30 }}
            transition={{ duration: 0.8, delay: 0.1 }}
          >
            <div className={styles.formGroup}>
              <label htmlFor="name">שם מלא</label>
              <input
                id="name"
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                aria-required="true"
              />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="email">דוא״ל</label>
              <input
                id="email"
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                aria-required="true"
              />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="message">הודעה</label>
              <textarea
                id="message"
                name="message"
                value={formData.message}
                onChange={handleChange}
                rows={5}
                required
                aria-required="true"
              />
            </div>
            <motion.button
              type="submit"
              className={styles.submitButton}
              disabled={isSubmitting}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {isSubmitting ? 'שליחה...' : 'שלח הודעה'}
            </motion.button>
            {submitSuccess && (
              <div className={styles.successMessage}>
                ✓ ההודעה נשלחה בהצלחה!
              </div>
            )}
          </motion.form>
        </div>
      </div>
    </section>
  );
};

export default Contact;
