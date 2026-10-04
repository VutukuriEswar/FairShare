import React from 'react';
import { motion } from 'framer-motion';
export default function Loader({ label = '💎 Summoning royal percentages…' }) {
  return (
    <div role="status" aria-live="polite" style={{ display: 'grid', gap: 12 }}>
      <motion.div
        className="neon-hero"
        animate={{ opacity: [0.75, 1, 0.75] }}
        transition={{ duration: 1.4, repeat: Infinity }}
        style={{ padding: 22 }}
      >
        <div style={{ fontSize: '2rem' }}>👑</div>
        <strong>{label}</strong>
        <div className="stackbar" style={{ marginTop: 12 }}>
          <motion.div
            animate={{ x: ['-100%', '250%'] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
            style={{ width: '40%', background: 'linear-gradient(90deg,#FFC93C,#FF6B9D)' }}
          />
        </div>
      </motion.div>
      <div className="skel" />
      <div className="skel" />
    </div>
  );
}
