import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { BRAND_EASE, useReducedMotion } from '@/lib/motion'
import { Check } from 'lucide-react'

interface LatticeLoaderProps {
  isLoading: boolean
  isComplete: boolean
  onDone?: () => void
  durationSeconds?: number
}

export const LatticeLoader: React.FC<LatticeLoaderProps> = ({
  isLoading,
  isComplete,
  durationSeconds = 1.8,
}) => {
  const [elapsed, setElapsed] = useState(0)
  const startTimeRef = useRef<number | null>(null)
  const reducedMotion = useReducedMotion()

  useEffect(() => {
    if (isLoading && !isComplete) {
      startTimeRef.current = performance.now()
      const interval = setInterval(() => {
        if (startTimeRef.current) {
          const now = performance.now()
          setElapsed(Math.min(durationSeconds, (now - startTimeRef.current) / 1000))
        }
      }, 50)
      return () => clearInterval(interval)
    } else if (isComplete) {
      setElapsed(durationSeconds)
    } else {
      setElapsed(0)
      startTimeRef.current = null
    }
  }, [isLoading, isComplete, durationSeconds])

  return (
    <div className="flex items-center gap-3 select-none" aria-live="polite">
      <AnimatePresence mode="wait">
        {!isComplete ? (
          <motion.div
            key="lattice-active"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.25, ease: BRAND_EASE }}
            className="flex items-center gap-3"
          >
            {/* 3x3 Lattice Orbit Pattern */}
            <div
              className="relative w-7 h-7 grid grid-cols-3 grid-rows-3 gap-1 p-0.5 rounded-md bg-panel border border-line"
              aria-hidden="true"
            >
              {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((idx) => {
                const row = Math.floor(idx / 3)
                const col = idx % 3
                // Wave/orbit phase based on distance from center (1,1)
                const dist = Math.abs(row - 1) + Math.abs(col - 1)
                return (
                  <motion.div
                    key={idx}
                    animate={
                      reducedMotion
                        ? { opacity: 0.7 }
                        : {
                            scale: [0.6, 1.1, 0.6],
                            opacity: [0.35, 1, 0.35],
                            backgroundColor: [
                              'var(--line)',
                              'var(--primary)',
                              'var(--line)',
                            ],
                          }
                    }
                    transition={
                      reducedMotion
                        ? { duration: 0 }
                        : {
                            duration: 1.2,
                            repeat: Infinity,
                            delay: dist * 0.16 + (idx % 2) * 0.08,
                            ease: BRAND_EASE,
                          }
                    }
                    className="w-1.5 h-1.5 rounded-full bg-primary"
                  />
                )
              })}
            </div>

            <div className="flex flex-col">
              <span className="text-xs font-semibold tracking-wide uppercase text-ink flex items-center gap-1.5">
                <span>Analysing</span>
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              </span>
              <span className="text-[11px] font-mono text-muted tabular-nums">
                {elapsed.toFixed(1)}s elapsed
              </span>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="lattice-done"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.35, ease: BRAND_EASE }}
            className="flex items-center gap-2.5"
          >
            <div className="w-6 h-6 rounded-full bg-ok text-white flex items-center justify-center shadow-sm">
              <Check className="w-3.5 h-3.5 stroke-[3]" aria-hidden="true" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-ok tracking-wide">
                Done in {durationSeconds.toFixed(1)}s
              </span>
              <span className="text-[11px] text-muted">Verification complete</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
