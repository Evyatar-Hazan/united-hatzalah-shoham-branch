import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useScrollTrigger } from '../hooks/useScrollTrigger';
import styles from './Stories.module.css';

interface Story {
  id: number;
  title: string;
  description: string;
  image?: string;
  date: string;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const Stories: React.FC = () => {
  const { ref } = useScrollTrigger();
  const [activeStory, setActiveStory] = useState(0);
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStories = async () => {
      try {
        const response = await fetch(`${API_URL}/api/media/stories`);
        if (response.ok) {
          const result = await response.json();
          setStories(result.data || []);
        }
      } catch (error) {
        console.error('Failed to fetch stories:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStories();
  }, []);

  const nextStory = () => {
    setActiveStory((prev) => (prev + 1) % stories.length);
  };

  const prevStory = () => {
    setActiveStory((prev) => (prev - 1 + stories.length) % stories.length);
  };

  // Get limited indicators to show (first, last, and active page range)
  const getVisibleIndicators = () => {
    const maxIndicators = 5;
    if (stories.length <= maxIndicators) {
      return Array.from({ length: stories.length }, (_, i) => i);
    }

    const indices = new Set<number>();
    indices.add(0); // First
    indices.add(stories.length - 1); // Last
    indices.add(activeStory); // Current

    // Add neighbors around current
    if (activeStory > 0) indices.add(activeStory - 1);
    if (activeStory < stories.length - 1) indices.add(activeStory + 1);

    return Array.from(indices).sort((a, b) => a - b);
  };

  if (loading) {
    return (
      <section ref={ref} className={`${styles.stories} section`}>
        <div className="container">
          <h2 className={styles.title}>סיפורי הצלה מהשטח</h2>
          <p>טוען...</p>
        </div>
      </section>
    );
  }

  if (stories.length === 0) {
    return null;
  }

  return (
    <section ref={ref} className={`${styles.stories} section`}>
      <div className="container">
        <h2 className={styles.title}>סיפורי הצלה מהשטח</h2>

        <div className={styles.carousel}>
          <div className={styles.carouselContent}>
            <AnimatePresence mode="wait">
              <motion.div
                key={stories[activeStory].id}
                className={styles.storyCard}
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -50 }}
                transition={{ duration: 0.5 }}
              >
                {stories[activeStory].image && (
                  <img
                    src={stories[activeStory].image}
                    alt={stories[activeStory].title}
                    className={styles.storyImage}
                  />
                )}
                <div className={styles.storyContent}>
                  <h3 className={styles.storyTitle}>
                    {stories[activeStory].title}
                  </h3>
                  <p className={styles.storyDescription}>
                    {stories[activeStory].description}
                  </p>
                  <time className={styles.storyDate}>
                    {stories[activeStory].date}
                  </time>
                </div>
              </motion.div>
            </AnimatePresence>

            <div className={styles.controls}>
              <button
                className={styles.navButton}
                onClick={prevStory}
                aria-label="סיפור קודם"
              >
                ❮
              </button>
              <button
                className={styles.navButton}
                onClick={nextStory}
                aria-label="סיפור הבא"
              >
                ❯
              </button>
            </div>
          </div>

          <div className={styles.controlsBottom}>
            <div className={styles.indicators}>
              {getVisibleIndicators().map((index) => (
                <button
                  key={index}
                  className={`${styles.indicator} ${
                    index === activeStory ? styles.active : ''
                  }`}
                  onClick={() => setActiveStory(index)}
                  aria-label={`עבור לסיפור ${index + 1}`}
                  title={`סיפור ${index + 1}`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Stories;
