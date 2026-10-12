import React from 'react'
import { motion } from 'motion/react'
import { BRAND_EASE, getEntranceVariants, useReducedMotion } from '@/lib/motion'
import { Radio, Bell, Clock, SearchCode } from 'lucide-react'

interface MonitoringViewProps {
  onNavigateToCheck: () => void
}

export const MonitoringView: React.FC<MonitoringViewProps> = ({
  onNavigateToCheck,
}) => {
  const reducedMotion = useReducedMotion()

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="pb-2 border-b border-line">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-ink">
          Persistent monitoring
        </h1>
        <p className="text-sm text-muted mt-1">
          Automated background surveillance and alert delivery engine.
        </p>
      </div>

      {/* Honest Phase 2 Notice */}
      <motion.div
        variants={getEntranceVariants(reducedMotion)}
        initial="hidden"
        animate="visible"
        className="p-8 sm:p-12 rounded-panel bg-panel border border-line shadow-sm space-y-6 text-center max-w-2xl mx-auto"
      >
        <div className="w-16 h-16 rounded-2xl bg-warn/10 text-warn flex items-center justify-center mx-auto border border-warn/20">
          <Radio className="w-8 h-8 stroke-[2]" />
        </div>

        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-warn/10 text-warn border border-warn/20 mb-1">
            <Clock className="w-3.5 h-3.5" />
            <span>Arriving in Phase 2</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-ink">
            Scheduled watch lists & background push alerts
          </h2>
          <p className="text-xs sm:text-sm text-muted leading-relaxed">
            Persistent automated monitoring and recurring daily web crawler sweeps arrive in a later version of BrandGuard.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left pt-2">
          <div className="p-3.5 rounded-button bg-bg border border-line text-xs space-y-1">
            <strong className="text-ink font-semibold flex items-center gap-1.5">
              <Bell className="w-4 h-4 text-primary" />
              Webhook & Telegram Alerts
            </strong>
            <p className="text-[11px] text-muted">
              Immediate notifications when new lookalike domains or social handles appear.
            </p>
          </div>

          <div className="p-3.5 rounded-button bg-bg border border-line text-xs space-y-1">
            <strong className="text-ink font-semibold flex items-center gap-1.5">
              <Radio className="w-4 h-4 text-primary" />
              Automated Registry Scanning
            </strong>
            <p className="text-[11px] text-muted">
              Continuous background queries across app store listings and WHOIS records.
            </p>
          </div>
        </div>

        <div className="pt-4 border-t border-line">
          <button
            type="button"
            onClick={onNavigateToCheck}
            className="flex items-center gap-2 px-5 py-2.5 rounded-button bg-primary hover:bg-primary-hover text-white text-xs font-semibold shadow-sm transition-colors mx-auto"
          >
            <SearchCode className="w-4 h-4" />
            <span>Check a profile manually</span>
          </button>
        </div>
      </motion.div>
    </div>
  )
}
