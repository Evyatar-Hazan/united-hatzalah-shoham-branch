import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useScrollTrigger } from '../hooks/useScrollTrigger';
import styles from './Gallery.module.css';

interface GalleryItem {
  id: number;
  title: string;
  category: string;
  imageUrl?: string;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// Custom hook for image lazy loading with Intersection Observer
const useImageLazyLoad = (ref: React.RefObject<HTMLImageElement | null>) => {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting) {
          const img = ref.current;
          if (img) {
            img.src = img.dataset.src || '';
            img.onload = () => setIsLoaded(true);
            observer.unobserve(img);
          }
        }
      },
      { threshold: 0.01 }
    );

    const currentRef = ref.current;

    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [ref]);

  return isLoaded;
};

// Gallery Item Component with Lazy Loading
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const GalleryItemComponent: React.FC<{ item: GalleryItem; variants: any }> = ({
  item,
  variants,
}) => {
  const imgRef = useRef<HTMLImageElement>(null);
  const isLoaded = useImageLazyLoad(imgRef);

  return (
    <motion.div
      className={styles.item}
      variants={variants}
      whileHover={{ y: -8 }}
    >
      <div className={styles.itemImage}>
        <img
          ref={imgRef}
          data-src={item.imageUrl}
          alt={item.title}
          className={`${styles.lazyImage} ${isLoaded ? styles.loaded : ''}`}
          loading="lazy"
        />
        {!isLoaded && <div className={styles.placeholder}></div>}
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
  const [galleryItems, setGalleryItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchGallery = async () => {
      try {
        const response = await fetch(`${API_URL}/api/media/gallery`);
        if (response.ok) {
          const result = await response.json();
          setGalleryItems(result.data || []);
        }
      } catch (error) {
        console.error('Failed to fetch gallery:', error);
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
      <section ref={ref} className={`${styles.gallery} section`}>
        <div className="container">
          <h2 className={styles.title}>גלריית מדיה</h2>
          <p>טוען...</p>
        </div>
      </section>
    );
  }

  return (
    <section ref={ref} className={`${styles.gallery} section`}>
      <div className="container">
        <h2 className={styles.title}>גלריית מדיה</h2>
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
