import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useScrollTrigger } from '../hooks/useScrollTrigger';
import styles from './Statistics.module.css';

interface StatItemApi {
  id: string;
  title: string;
  value: number;
  unit?: string | null;
  order?: number;
}

interface StatisticItemProps {
  label: string;
  value: number;
  suffix?: string;
  isVisible: boolean;
}

const StatisticItem: React.FC<StatisticItemProps> = ({
  label,
  value,
  suffix = '',
  isVisible,
}) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (!isVisible) return;

    const start = 0;
    const increment = value / 50;
    let current = start;

    const timer = setInterval(() => {
      current += increment;
      if (current >= value) {
        setDisplayValue(value);
        clearInterval(timer);
      } else {
        setDisplayValue(Math.floor(current));
      }
    }, 30);

    return () => clearInterval(timer);
  }, [isVisible, value]);

  return (
    <motion.div
      className={styles.statItem}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={isVisible ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8 }}
      transition={{ duration: 0.6 }}
    >
      <div className={styles.statValue}>
        {displayValue.toLocaleString('he-IL')}
        {suffix}
      </div>
      <div className={styles.statLabel}>{label}</div>
    </motion.div>
  );
};

const Statistics: React.FC = () => {
  const { ref, isVisible } = useScrollTrigger({ threshold: 0.3 });
  const [items, setItems] = useState<StatItemApi[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
        const res = await fetch(`${apiUrl}/api/statistics`);
        const json = await res.json();
        if (json?.success && Array.isArray(json.data)) {
          const sorted = [...(json.data as StatItemApi[])].sort(
            (a, b) => (a.order ?? 0) - (b.order ?? 0)
          );
          setItems(sorted);
        }
      } catch (error) {
        console.error('Failed to load statistics', error);
      }
    };

    load();
  }, []);

  return (
    <section ref={ref} className={`${styles.statistics} section`}>
      <div className="container">
        <h2 className={styles.title}>הנתונים שלנו</h2>
        <div className={styles.statsGrid}>
          {(items.length > 0 ? items : [
            { id: 'placeholder-1', title: 'מתנדבים פעילים', value: 0 },
            { id: 'placeholder-2', title: 'קריאות חירום שטופלו', value: 0 },
          ]).map((item) => (
            <StatisticItem
              key={item.id}
              label={item.title}
              value={item.value}
              suffix={item.unit ? ` ${item.unit}` : ''}
              isVisible={isVisible}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export default Statistics;
