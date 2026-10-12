import React from 'react'
import { motion } from 'motion/react'
import { DetectionResult } from '@/data/types'
import { BRAND_EASE, getEntranceVariants, useReducedMotion } from '@/lib/motion'
import { BellToggle } from '@/components/free/BellToggle'
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Info,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Eye,
  Hash,
  AtSign,
  Globe,
  Phone,
  Mail,
  Building,
} from 'lucide-react'

interface RiskReportProps {
  result: DetectionResult
  isWatching: boolean
  onToggleWatch: () => void
}

export const RiskReport: React.FC<RiskReportProps> = ({
  result,
  isWatching,
  onToggleWatch,
}) => {
  const reducedMotion = useReducedMotion()

  const isOfficial = result.isOfficialRecord || result.verdict === 'Official'
  const isUnique = result.verdict === 'Unique'
  const isHigh = result.verdict === 'High'
  const isMedium = result.verdict === 'Medium'
  const isLow = result.verdict === 'Low'

  // Anomaly scale marker position (0% to 100%)
  const markerPos = isUnique
    ? 0
    : isOfficial
    ? 0
    : isLow
    ? Math.max(12, Math.min(32, result.matchPercentage))
    : isMedium
    ? Math.max(38, Math.min(58, result.matchPercentage))
    : Math.max(65, Math.min(95, result.matchPercentage))

  return (
    <motion.div
      variants={getEntranceVariants(reducedMotion)}
      initial="hidden"
      animate="visible"
      className="p-5 sm:p-6 rounded-panel bg-panel border border-line shadow-sm space-y-6"
      aria-live="polite"
    >
      {/* 1. VERDICT FIRST */}
      <div className="pb-4 border-b border-line">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {isOfficial ? (
              <div className="w-12 h-12 rounded-xl bg-ok/15 text-ok flex items-center justify-center shrink-0">
                <ShieldCheck className="w-7 h-7 stroke-[2.2]" />
              </div>
            ) : isUnique ? (
              <div className="w-12 h-12 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
                <ShieldCheck className="w-7 h-7 stroke-[2.2]" />
              </div>
            ) : isHigh ? (
              <div className="w-12 h-12 rounded-xl bg-bad/15 text-bad flex items-center justify-center shrink-0">
                <ShieldAlert className="w-7 h-7 stroke-[2.2]" />
              </div>
            ) : isMedium ? (
              <div className="w-12 h-12 rounded-xl bg-warn/15 text-warn flex items-center justify-center shrink-0">
                <AlertTriangle className="w-7 h-7 stroke-[2.2]" />
              </div>
            ) : (
              <div className="w-12 h-12 rounded-xl bg-ok/15 text-ok flex items-center justify-center shrink-0">
                <Info className="w-7 h-7 stroke-[2.2]" />
              </div>
            )}

            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl sm:text-2xl font-extrabold text-ink tracking-tight">
                  {isOfficial
                    ? 'Official Identity'
                    : isUnique
                    ? "No match found. You're unique."
                    : `${result.verdict} Risk Impersonation`}
                </h3>
              </div>
              <p className="text-xs sm:text-sm text-muted mt-0.5">
                {isOfficial
                  ? `Authenticated official entity record for ${result.matchedBrand?.name}.`
                  : isUnique
                  ? `Checked against ${result.brandsCheckedCount} registered brands in database.`
                  : `Likely imitating registered brand ${result.matchedBrand?.name}. Review evidence below.`}
              </p>
            </div>
          </div>

          {/* Match level percentage badge */}
          {!isUnique && !isOfficial && (
            <div className="flex flex-col items-end shrink-0">
              <span className="text-xs text-muted font-medium">Match level</span>
              <span
                className={`text-2xl sm:text-3xl font-extrabold font-mono tracking-tight ${
                  isHigh ? 'text-bad' : isMedium ? 'text-warn' : 'text-ok'
                }`}
              >
                {result.matchPercentage}%
              </span>
            </div>
          )}
        </div>
      </div>

      {/* UNIQUE / CLEAN RESULT SPECIAL SECTION */}
      {isUnique && (
        <div className="p-4 rounded-button bg-bg border border-line space-y-2 text-xs text-muted leading-relaxed">
          <div className="flex items-center gap-2 font-semibold text-ink">
            <CheckCircle2 className="w-4 h-4 text-primary" />
            <span>Clean database match</span>
          </div>
          <p>
            No corresponding handles, domains, or contact information matched any of the{' '}
            <strong className="text-ink">{result.brandsCheckedCount}</strong> registered brands.
          </p>
          <div className="pt-2 text-[11px] text-muted border-t border-line/60 flex items-start gap-1.5">
            <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-muted" />
            <span>
              <strong>Note:</strong> A clean result does not confirm the profile is trustworthy. Always perform due diligence before sharing sensitive information or transactions.
            </span>
          </div>
        </div>
      )}

      {/* OFFICIAL RESULT BADGE */}
      {isOfficial && (
        <div className="p-4 rounded-button bg-ok/10 border border-ok/30 space-y-2 text-xs">
          <div className="flex items-center gap-2 font-bold text-ok text-sm">
            <CheckCircle2 className="w-4 h-4" />
            <span>Verified Authentic Brand Channel</span>
          </div>
          <p className="text-ink/80 leading-relaxed">
            This handle/domain exactly matches certified registration credentials for{' '}
            <strong>{result.matchedBrand?.name}</strong>. Safe for transactions and customer communications.
          </p>
        </div>
      )}

      {/* MATCHED RESULT DETAILS (ANOMALY SCALE, MATCH AREA, SUB-CHECKS) */}
      {!isUnique && (
        <div className="space-y-5">
          {/* 2. MATCH AREA PILLS */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-muted uppercase tracking-wider">
              Matched Area
            </span>
            <div className="flex flex-wrap gap-2 text-xs">
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border ${
                  result.matchArea.handle
                    ? 'bg-primary/10 border-primary/30 text-primary font-semibold'
                    : 'bg-bg border-line text-muted line-through opacity-60'
                }`}
              >
                <AtSign className="w-3.5 h-3.5" />
                ID / Handle
              </span>
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border ${
                  result.matchArea.displayName
                    ? 'bg-primary/10 border-primary/30 text-primary font-semibold'
                    : 'bg-bg border-line text-muted line-through opacity-60'
                }`}
              >
                <Building className="w-3.5 h-3.5" />
                Display Name
              </span>
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border ${
                  result.matchArea.domain
                    ? 'bg-primary/10 border-primary/30 text-primary font-semibold'
                    : 'bg-bg border-line text-muted line-through opacity-60'
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                Domain
              </span>
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border ${
                  result.matchArea.phone
                    ? 'bg-primary/10 border-primary/30 text-primary font-semibold'
                    : 'bg-bg border-line text-muted line-through opacity-60'
                }`}
              >
                <Phone className="w-3.5 h-3.5" />
                Phone
              </span>
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border ${
                  result.matchArea.email
                    ? 'bg-primary/10 border-primary/30 text-primary font-semibold'
                    : 'bg-bg border-line text-muted line-through opacity-60'
                }`}
              >
                <Mail className="w-3.5 h-3.5" />
                Email
              </span>
            </div>
          </div>

          {/* 3. ANOMALY RANGE SCALE */}
          {!isOfficial && (
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-muted uppercase tracking-wider">
                  Anomaly Range
                </span>
                <span className="font-bold font-mono text-ink">
                  {result.anomalyRange} Anomaly
                </span>
              </div>

              {/* Range bar with 3 segments and sliding marker */}
              <div className="relative pt-3 pb-1">
                <div className="h-2.5 w-full rounded-full flex overflow-hidden border border-line">
                  <div className="w-[35%] bg-ok/30 relative" title="Low risk band (0 - 35%)" />
                  <div className="w-[25%] bg-warn/30 relative" title="Medium risk band (35 - 60%)" />
                  <div className="w-[40%] bg-bad/30 relative" title="High risk band (60 - 100%)" />
                </div>

                {/* Animated pin marker */}
                <motion.div
                  initial={reducedMotion ? false : { left: '0%' }}
                  animate={{ left: `${markerPos}%` }}
                  transition={{ duration: 0.7, ease: BRAND_EASE }}
                  className="absolute top-1.5 -translate-x-1/2 flex flex-col items-center pointer-events-none"
                >
                  <div
                    className={`w-4 h-4 rounded-full border-2 border-panel shadow-md ${
                      isHigh ? 'bg-bad' : isMedium ? 'bg-warn' : 'bg-ok'
                    }`}
                  />
                </motion.div>

                {/* Scale labels */}
                <div className="flex justify-between text-[10px] text-muted font-mono mt-1 px-1">
                  <span>0% (Low)</span>
                  <span>35% (Medium)</span>
                  <span>60% (High)</span>
                  <span>100%</span>
                </div>
              </div>
            </div>
          )}

          {/* 4. TWO SUB-CHECKS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            {/* Sub-check 1: Content Match */}
            <div className="p-3.5 rounded-button bg-bg border border-line space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-muted">1. Content Match</span>
                <span className="font-mono font-bold text-ink">
                  {result.subChecks.contentMatch.score}%
                </span>
              </div>
              <div className="font-medium text-ink">
                {result.subChecks.contentMatch.summary}
              </div>
              <p className="text-[11px] text-muted">
                {result.subChecks.contentMatch.details}
              </p>
            </div>

            {/* Sub-check 2: Email / Phone Match */}
            <div className="p-3.5 rounded-button bg-bg border border-line space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-muted">2. Email / Phone Match</span>
                <span
                  className={`capitalize font-bold px-2 py-0.5 rounded-full text-[10px] ${
                    result.subChecks.contactMatch.status === 'matched'
                      ? 'bg-ok/10 text-ok'
                      : result.subChecks.contactMatch.status === 'no match'
                      ? 'bg-bad/10 text-bad'
                      : 'bg-line/40 text-muted'
                  }`}
                >
                  {result.subChecks.contactMatch.status}
                </span>
              </div>
              <p className="text-[11px] text-muted">
                {result.subChecks.contactMatch.details}
              </p>
            </div>
          </div>

          {/* 5. FIRED SIGNALS & EVIDENCE */}
          {result.firedSignals.length > 0 && (
            <div className="space-y-2 pt-2">
              <span className="text-xs font-semibold text-muted uppercase tracking-wider">
                Fired Signals & Evidence
              </span>
              <div className="space-y-2">
                {result.firedSignals.map((sig) => (
                  <div
                    key={sig.id}
                    className="p-3 rounded-button bg-bg/80 border border-line text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between font-semibold text-ink">
                      <span>{sig.label}</span>
                      {sig.weight > 0 && (
                        <span className="text-[10px] font-mono text-muted">
                          weight: +{Math.round(sig.weight * 100)}%
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted leading-relaxed">
                      {sig.evidence}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 6. WATCH THIS PROFILE (For matched, non-official results) */}
          {!isOfficial && (
            <div className="p-4 rounded-button bg-primary/5 border border-primary/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3">
              <div>
                <h4 className="text-xs font-bold text-ink">Watch this profile</h4>
                <p className="text-[11px] text-muted mt-0.5">
                  Receive notification alerts if this profile renames, changes links or posts new contact details.
                </p>
              </div>
              <BellToggle isNotified={isWatching} onToggle={onToggleWatch} />
            </div>
          )}
        </div>
      )}

      {/* MANDATORY LEGAL & ETHICAL NOTICE */}
      <div className="pt-3 border-t border-line text-[11px] text-muted flex items-start gap-2">
        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-muted" />
        <p className="leading-relaxed">
          <strong>Notice:</strong> Results are risk estimates with evidence, never accusations. BrandGuard analyzes submitted text and public signals against registered brand records.
        </p>
      </div>
    </motion.div>
  )
}
