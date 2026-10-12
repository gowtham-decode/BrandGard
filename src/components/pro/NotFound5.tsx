import React, { useEffect } from 'react'
import { motion } from 'motion/react'
import { BRAND_EASE, useReducedMotion } from '@/lib/motion'
import { ArrowLeft, SearchCode, AlertCircle, ShieldAlert } from 'lucide-react'

interface NotFound5Props {
  failedPath?: string
  onGoHome: () => void
  onCheckProfile: () => void
}

export const NotFound5: React.FC<NotFound5Props> = ({
  failedPath = '/unknown/profile-route',
  onGoHome,
  onCheckProfile,
}) => {
  const reducedMotion = useReducedMotion()

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onGoHome()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onGoHome])

  const cards = [
    {
      id: 'c1',
      title: 'No match found',
      subtitle: 'Zero brand matches registered',
      rotate: -6,
      bg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400',
      x: '-left-4 -top-6 sm:-left-12 sm:-top-8',
    },
    {
      id: 'c2',
      title: 'Unknown handle',
      subtitle: '@unresolved_threat_id',
      rotate: 8,
      bg: 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400',
      x: '-right-4 -top-8 sm:-right-10 sm:-top-10',
    },
    {
      id: 'c3',
      title: 'Match level 0%',
      subtitle: 'Anomaly threshold: null',
      rotate: -5,
      bg: 'bg-indigo-500/10 border-indigo-500/30 text-indigo-600 dark:text-indigo-400',
      x: '-left-6 top-28 sm:-left-16 sm:top-24',
    },
    {
      id: 'c4',
      title: 'Broken link',
      subtitle: failedPath,
      rotate: 7,
      bg: 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400',
      x: '-right-6 top-32 sm:-right-16 sm:top-28',
    },
    {
      id: 'c5',
      title: 'Platform: Not selected',
      subtitle: 'Protocol unregistered',
      rotate: -7,
      bg: 'bg-sky-500/10 border-sky-500/30 text-sky-600 dark:text-sky-400',
      x: 'left-1/2 -translate-x-1/2 -bottom-10 sm:-bottom-12',
    },
  ]

  return (
    <div className="relative min-h-[75vh] flex flex-col items-center justify-center text-center px-4 py-12 select-none overflow-hidden">
      {/* Central 404 Stage with scattered cards */}
      <div className="relative flex items-center justify-center my-8">
        {/* Massive 404 typography */}
        <motion.h1
          initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.8 }}
          animate={reducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: BRAND_EASE }}
          className="text-8xl sm:text-9xl md:text-[13rem] font-extrabold tracking-tighter text-line select-none"
        >
          404
        </motion.h1>

        {/* Scattered Tilted Cards dropping in */}
        {cards.map((card, idx) => (
          <motion.div
            key={card.id}
            initial={
              reducedMotion
                ? { opacity: 0 }
                : {
                    opacity: 0,
                    y: -70,
                    scale: 0.85,
                    rotate: card.rotate * 1.5,
                  }
            }
            animate={
              reducedMotion
                ? { opacity: 1 }
                : {
                    opacity: 1,
                    y: 0,
                    scale: 1,
                    rotate: card.rotate,
                  }
            }
            transition={
              reducedMotion
                ? { duration: 0.15 }
                : {
                    duration: 0.75,
                    delay: 0.08 * idx,
                    type: 'spring',
                    stiffness: 260,
                    damping: 22,
                  }
            }
            className={`absolute ${card.x} p-3 sm:p-3.5 rounded-panel border shadow-lg backdrop-blur-md ${card.bg} text-left max-w-[190px] sm:max-w-[220px] pointer-events-none`}
          >
            <div className="text-xs font-bold truncate">{card.title}</div>
            <div className="text-[11px] font-mono opacity-80 truncate mt-0.5">
              {card.subtitle}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Main explanation & actions */}
      <div className="relative z-10 max-w-md mx-auto space-y-4 mt-6">
        <h2 className="text-xl sm:text-2xl font-extrabold text-ink tracking-tight">
          Destination does not exist
        </h2>
        <p className="text-xs sm:text-sm text-muted">
          The requested route was not found in BrandGuard. Check the URL or return to verify active social profiles.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={onGoHome}
            className="flex items-center gap-2 px-4 py-2.5 rounded-button bg-bg hover:bg-line/40 text-ink text-xs font-semibold border border-line transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Go back home</span>
            <span className="text-[10px] text-muted font-mono hidden sm:inline">(Esc)</span>
          </button>

          <button
            type="button"
            onClick={onCheckProfile}
            className="flex items-center gap-2 px-4 py-2.5 rounded-button bg-primary hover:bg-primary-hover text-white text-xs font-semibold shadow-sm transition-colors"
          >
            <SearchCode className="w-4 h-4" />
            <span>Check a profile</span>
          </button>
        </div>
      </div>
    </div>
  )
}
