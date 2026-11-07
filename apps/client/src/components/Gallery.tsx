import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useScrollTrigger } from '../hooks/useScrollTrigger';
import { branchGalleryFallback } from '../content/branchContent';
import styles from './Gallery.module.css';

interface GalleryItem {
  id: string | number;
  title: string;
  category: string;
  imageUrl?: string;
}

const API_URL = import.meta.env.VITE_API_URL || '';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const GalleryItemComponent: React.FC<{ item: GalleryItem; variants: any }> = ({
  item,
  variants,
}) => {
  return (
    <motion.div
      className={styles.item}
      variants={variants}
      whileHover={{ y: -8 }}
    >
      <div className={styles.itemImage}>
        <img
          src={item.imageUrl}
          alt={item.title}
          className={`${styles.lazyImage} ${styles.loaded}`}
          loading="lazy"
        />
      </div>
      <div className={styles.itemInfo}>
        <p className={styles.itemCategory}>{item.category}</p>
        <h3 className={styles.itemTitle}>{item.title}</h3>
      </div>
    </motion.div>
  );
};

const Gallery: React.FC = () => {
  const { ref, isVisible } = useScrollTrigger();
  const [galleryItems, setGalleryItems] = useState<GalleryItem[]>(branchGalleryFallback);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchGallery = async () => {
      try {
        const response = await fetch(`${API_URL}/api/media/gallery`);
        if (response.ok) {
          const result = await response.json();
          const items = Array.isArray(result.data) ? result.data : [];
          const hasRealImages = items.some(
            (item: GalleryItem) => item.imageUrl && !item.imageUrl.includes('placehold.co')
          );
          setGalleryItems(hasRealImages ? items : branchGalleryFallback);
        }
      } catch (error) {
        console.error('Failed to fetch gallery:', error);
        setGalleryItems(branchGalleryFallback);
      } finally {
        setLoading(false);
      }
    };

    fetchGallery();
  }, []);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, scale: 0.8 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: { duration: 0.5 },
    },
  };

  if (loading) {
    return (
      <section ref={ref} className={`${styles.gallery} section`} id="gallery">
        <div className="container">
          <h2 className={styles.title}>גלריית מדיה</h2>
          <p>טוען...</p>
        </div>
      </section>
    );
  }

  return (
    <section ref={ref} className={`${styles.gallery} section`} id="gallery">
      <div className="container">
        <h2 className={styles.title}>הסניף בפעילות</h2>
        <p className={styles.lead}>
          מבט ישיר לשטח: אימונים, כוננות, קהילה, ציוד ורגעים שמספרים איך נראה מענה
          רפואי מקומי כשהוא חי ופועל באמת.
        </p>
        <motion.div
          className={styles.grid}
          variants={containerVariants}
          initial="hidden"
          animate={isVisible ? 'visible' : 'hidden'}
        >
          {galleryItems.map((item) => (
            <GalleryItemComponent key={item.id} item={item} variants={itemVariants} />
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default Gallery;
