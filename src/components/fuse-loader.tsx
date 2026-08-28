"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

const LINES = [
  "Scanning imagination...",
  "Mixing DNA...",
  "Breaking the laws of physics...",
  "Inventing something impossible...",
  "Generating concept...",
];

export function FuseLoader({ active }: { active: boolean }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setIndex((n) => (n + 1) % LINES.length), 1600);
    return () => clearInterval(id);
  }, [active]);

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-center bg-black/70 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="flex w-[min(92vw,420px)] flex-col items-center gap-6 text-center">
            <motion.div
              className="relative h-28 w-28"
              animate={{ rotate: 360 }}
              transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
            >
              <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-fuchsia-500 via-cyan-400 to-amber-300 blur-md" />
              <div className="absolute inset-2 grid place-items-center rounded-full bg-black">
                <Sparkles className="h-8 w-8" />
              </div>
            </motion.div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <motion.div
                className="h-full bg-gradient-to-r from-fuchsia-400 to-cyan-300"
                animate={{ x: ["-100%", "100%"] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
              />
            </div>
            <p className="text-lg font-medium text-white">{LINES[index]}</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
