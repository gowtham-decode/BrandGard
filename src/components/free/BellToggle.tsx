import React from 'react'
import { motion } from 'motion/react'
import { BRAND_EASE, useReducedMotion } from '@/lib/motion'
import { Bell, BellRing } from 'lucide-react'

interface BellToggleProps {
  isNotified: boolean
  onToggle: () => void
  disabled?: boolean
}

export const BellToggle: React.FC<BellToggleProps> = ({
  isNotified,
  onToggle,
  disabled = false,
}) => {
  const reducedMotion = useReducedMotion()

  return (
    <button
      type="button"
      id="bell-watch-toggle"
      aria-pressed={isNotified}
      disabled={disabled}
      onClick={onToggle}
      className={`group relative flex items-center gap-2.5 px-3.5 py-2 rounded-button text-xs font-semibold transition-all duration-200 ${
        isNotified
          ? 'bg-primary text-white shadow-sm ring-1 ring-primary/40'
          : 'bg-panel hover:bg-bg text-ink border border-line hover:border-muted/50'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      {/* Sound waves ripple when notified */}
      {isNotified && !reducedMotion && (
        <span className="absolute -left-1 -top-1 -right-1 -bottom-1 rounded-button border border-primary/40 animate-ping opacity-25 pointer-events-none" />
      )}

      {/* Bell Icon with ringing motion */}
      <div className="relative flex items-center justify-center">
        {isNotified ? (
          <motion.div
            key="ring"
            animate={
              reducedMotion
                ? {}
                : {
                    rotate: [0, -18, 18, -12, 12, -6, 6, 0],
                  }
            }
            transition={{ duration: 0.6, ease: BRAND_EASE }}
          >
            <BellRing className="w-4 h-4 stroke-[2.2]" aria-hidden="true" />
          </motion.div>
        ) : (
          <motion.div
            key="idle"
            className="group-hover:scale-105 transition-transform"
          >
            <Bell className="w-4 h-4 text-muted group-hover:text-ink stroke-[2]" aria-hidden="true" />
          </motion.div>
        )}
      </div>

      <span className="tracking-tight select-none">
        {isNotified ? "You'll be notified" : 'Notify me'}
      </span>
    </button>
  )
}
