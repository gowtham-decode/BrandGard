import React, { useState, useEffect, useRef } from 'react'
import { motion } from 'motion/react'
import { BRAND_EASE, useReducedMotion } from '@/lib/motion'
import { Check, AlertCircle, RotateCw } from 'lucide-react'

export type CallChipState = 'idle' | 'running' | 'done' | 'error'

interface CallChipProps {
  label: string
  sublabel?: string
  state: CallChipState
  targetDurationMs?: number
  onRetry?: () => void
}

export const CallChip: React.FC<CallChipProps> = ({
  label,
  sublabel,
  state,
  targetDurationMs = 550,
  onRetry,
}) => {
  const [elapsedMs, setElapsedMs] = useState(0)
  const startTimeRef = useRef<number | null>(null)
  const reducedMotion = useReducedMotion()

  useEffect(() => {
    if (state === 'running') {
      startTimeRef.current = performance.now()
      const interval = setInterval(() => {
        if (startTimeRef.current) {
          const delta = Math.round(performance.now() - startTimeRef.current)
          setElapsedMs(Math.min(targetDurationMs, delta))
        }
      }, 25)
      return () => clearInterval(interval)
    } else if (state === 'done') {
      setElapsedMs(targetDurationMs)
    } else if (state === 'idle') {
      setElapsedMs(0)
      startTimeRef.current = null
    }
  }, [state, targetDurationMs])

  const progressPercent =
    state === 'done'
      ? 100
      : state === 'running'
      ? Math.min(100, Math.round((elapsedMs / targetDurationMs) * 100))
      : 0

  return (
    <div
      role="status"
      aria-live="polite"
      className={`relative overflow-hidden flex items-center justify-between px-3.5 py-2.5 rounded-panel border text-xs transition-colors duration-300 ${
        state === 'done'
          ? 'bg-ok/10 border-ok text-ok font-medium'
          : state === 'error'
          ? 'bg-bad/10 border-bad text-bad font-medium'
          : state === 'running'
          ? 'bg-panel border-primary/50 text-ink'
          : 'bg-panel/60 border-line text-muted'
      }`}
    >
      {/* Fill across animation bar while running */}
      {state === 'running' && (
        <motion.div
          className="absolute inset-y-0 left-0 bg-primary/10 -z-0"
          initial={{ width: '0%' }}
          animate={{ width: `${progressPercent}%` }}
          transition={{ ease: 'linear', duration: 0.05 }}
        />
      )}

      {/* Done full wash overlay */}
      {state === 'done' && !reducedMotion && (
        <motion.div
          className="absolute inset-0 bg-ok/15 -z-0 pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.35, ease: BRAND_EASE }}
        />
      )}

      {/* Content */}
      <div className="relative z-10 flex items-center gap-2 max-w-[70%] truncate">
        <span className="font-semibold truncate">{label}</span>
        {sublabel && (
          <span className="text-[11px] opacity-75 truncate hidden sm:inline">
            ({sublabel})
          </span>
        )}
      </div>

      {/* State Indicator */}
      <div className="relative z-10 flex items-center gap-1.5 shrink-0">
        {state === 'running' && (
          <span className="font-mono text-[11px] tabular-nums text-primary font-medium">
            {elapsedMs}ms
          </span>
        )}

        {state === 'done' && (
          <div className="flex items-center gap-1">
            <span className="font-mono text-[11px] tabular-nums opacity-90">
              {targetDurationMs}ms
            </span>
            <div className="w-4 h-4 rounded-full bg-ok text-white flex items-center justify-center">
              <Check className="w-2.5 h-2.5 stroke-[3]" aria-hidden="true" />
            </div>
          </div>
        )}

        {state === 'error' && (
          <div className="flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-bad" aria-hidden="true" />
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-bad/20 hover:bg-bad/30 text-bad text-[10px] font-semibold transition-colors"
              >
                <RotateCw className="w-2.5 h-2.5" />
                Retry
              </button>
            )}
          </div>
        )}

        {state === 'idle' && (
          <span className="text-[11px] text-muted">Queued</span>
        )}
      </div>
    </div>
  )
}
