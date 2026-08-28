"use client";

import { motion } from "framer-motion";

const DOTS = Array.from({ length: 28 }, (_, i) => i);

export function Particles() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {DOTS.map((i) => (
        <motion.span
          key={i}
          className="absolute h-1 w-1 rounded-full bg-white/40"
          initial={{
            x: `${(i * 37) % 100}vw`,
            y: `${(i * 53) % 100}vh`,
            opacity: 0.2,
          }}
          animate={{
            y: ["0vh", "100vh"],
            opacity: [0.15, 0.7, 0.15],
          }}
          transition={{
            duration: 12 + (i % 8),
            repeat: Infinity,
            delay: i * 0.2,
            ease: "linear",
          }}
        />
      ))}
    </div>
  );
}
