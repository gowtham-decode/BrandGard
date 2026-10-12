import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { BRAND_EASE, useReducedMotion } from '@/lib/motion'
import {
  Lock,
  Eye,
  EyeOff,
  Check,
  X,
  ShieldCheck,
  CheckCircle2,
  FileText,
  AlertCircle,
} from 'lucide-react'

interface Authentication12Props {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

export const Authentication12: React.FC<Authentication12Props> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [agreedTerms, setAgreedTerms] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [isSuccess, setIsSuccess] = useState(false)
  const modalRef = useRef<HTMLDivElement>(null)
  const firstInputRef = useRef<HTMLInputElement>(null)
  const reducedMotion = useReducedMotion()

  const lockedEmail = 'analyst@brandguard-team.com'

  // Calculate password strength (0 to 4 bars)
  const strengthScore = (() => {
    if (!password) return 0
    let score = 0
    if (password.length >= 8) score++
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++
    if (/\d/.test(password)) score++
    if (/[^A-Za-z0-9]/.test(password) || password.length >= 12) score++
    return score
  })()

  const strengthLabels = ['Too weak', 'Weak', 'Fair', 'Strong', 'Very strong']

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setFullName('')
      setPassword('')
      setShowPassword(false)
      setAgreedTerms(false)
      setErrorMsg('')
      setIsSuccess(false)
      setTimeout(() => firstInputRef.current?.focus(), 50)
    }
  }, [isOpen])

  // Focus trap & Escape key
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }

      if (e.key === 'Tab') {
        if (!modalRef.current) return
        const focusable = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
        if (focusable.length === 0) return

        const first = focusable[0]
        const last = focusable[focusable.length - 1]

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault()
            last.focus()
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault()
            first.focus()
          }
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')

    if (!fullName.trim()) {
      setErrorMsg('Please enter your full name.')
      return
    }

    // Validation: at least 8 chars, upper and lower case, number or symbol
    if (password.length < 8) {
      setErrorMsg('Password must be at least 8 characters long.')
      return
    }
    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password)) {
      setErrorMsg('Password must include both uppercase and lowercase letters.')
      return
    }
    if (!/\d/.test(password) && !/[^A-Za-z0-9]/.test(password)) {
      setErrorMsg('Password must include at least one number or special symbol.')
      return
    }
    if (!agreedTerms) {
      setErrorMsg('You must agree to the BrandGuard Security Terms.')
      return
    }

    // Trigger animated checkmark success
    setIsSuccess(true)
    setTimeout(() => {
      if (onSuccess) onSuccess()
      onClose()
    }, 1800)
  }

  if (!isOpen) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="invite-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
    >
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm -z-10"
        onClick={onClose}
      />

      {/* Modal Container */}
      <motion.div
        ref={modalRef}
        initial={
          reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.94, y: 16 }
        }
        animate={
          reducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }
        }
        exit={
          reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.94, y: 12 }
        }
        transition={{ duration: 0.28, ease: BRAND_EASE }}
        className="relative w-full max-w-3xl rounded-panel bg-panel border border-line shadow-2xl overflow-hidden"
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close modal"
          className="absolute top-4 right-4 z-20 w-8 h-8 rounded-full bg-bg hover:bg-line/40 text-muted hover:text-ink flex items-center justify-center transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {isSuccess ? (
          /* Animated Success State */
          <div className="p-12 sm:p-16 text-center flex flex-col items-center justify-center space-y-4">
            <div className="w-20 h-20 rounded-full bg-ok/15 text-ok flex items-center justify-center">
              <svg className="w-12 h-12" viewBox="0 0 48 48" fill="none">
                <motion.path
                  d="M10 24L20 34L38 14"
                  stroke="currentColor"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.7, ease: BRAND_EASE }}
                />
              </svg>
            </div>
            <h3 className="text-2xl font-extrabold text-ink tracking-tight">
              Welcome to Acme Bank Defense
            </h3>
            <p className="text-sm text-muted max-w-sm">
              Your analyst credentials have been activated. Redirecting you to the security dashboard...
            </p>
          </div>
        ) : (
          /* Dual-column Invitation Screen */
          <div className="grid grid-cols-1 md:grid-cols-5 min-h-[440px]">
            {/* Left Column: Role & Capabilities */}
            <div className="md:col-span-2 p-6 sm:p-8 bg-bg border-b md:border-b-0 md:border-r border-line flex flex-col justify-between">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20 mb-4">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Teammate Invitation</span>
                </div>
                <h3 className="text-lg font-bold text-ink leading-snug">
                  What a Brand analyst can do
                </h3>
                <p className="text-xs text-muted mt-1 leading-relaxed">
                  As an authorized analyst for Acme Bank, you will have certified privileges:
                </p>

                <ul className="mt-5 space-y-3.5 text-xs text-ink/90">
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-ok shrink-0 mt-0.5" />
                    <span>Review incoming lookalike alerts and anomaly evidence.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-ok shrink-0 mt-0.5" />
                    <span>Register brand trademarks, social handles & verified contact points.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-ok shrink-0 mt-0.5" />
                    <span>Export defense packages for takedown notices to platforms.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-ok shrink-0 mt-0.5" />
                    <span>Audit false positives and train signal thresholds.</span>
                  </li>
                </ul>
              </div>

              <div className="pt-6 mt-6 border-t border-line text-[11px] text-muted">
                Invited by <strong>Priya Raman</strong> (Chief Information Security Officer)
              </div>
            </div>

            {/* Right Column: Acceptance Form */}
            <div className="md:col-span-3 p-6 sm:p-8 flex flex-col justify-between">
              <div>
                <h2
                  id="invite-modal-title"
                  className="text-xl sm:text-2xl font-extrabold text-ink tracking-tight"
                >
                  Priya Raman invited you to protect Acme Bank
                </h2>
                <p className="text-xs text-muted mt-1">
                  Complete your analyst account setup to accept this team invitation.
                </p>

                {errorMsg && (
                  <div className="mt-4 p-3 rounded-button bg-bad/10 border border-bad/30 text-bad text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="mt-5 space-y-4">
                  {/* Locked Email */}
                  <div>
                    <label className="block text-xs font-semibold text-muted mb-1">
                      Assigned email (Locked)
                    </label>
                    <div className="relative">
                      <input
                        type="email"
                        value={lockedEmail}
                        disabled
                        className="w-full pl-3.5 pr-10 py-2 rounded-input bg-bg border border-line text-xs font-mono text-muted cursor-not-allowed opacity-80"
                      />
                      <Lock className="w-3.5 h-3.5 text-muted absolute right-3.5 top-1/2 -translate-y-1/2" />
                    </div>
                  </div>

                  {/* Full Name */}
                  <div>
                    <label
                      htmlFor="invite-fullname"
                      className="block text-xs font-semibold text-ink mb-1"
                    >
                      Full name
                    </label>
                    <input
                      ref={firstInputRef}
                      type="text"
                      id="invite-fullname"
                      required
                      placeholder="e.g. Arun Sharma"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-input bg-bg border border-line text-xs text-ink placeholder:text-muted focus:border-primary transition-colors"
                    />
                  </div>

                  {/* Password with Strength Meter */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label
                        htmlFor="invite-password"
                        className="text-xs font-semibold text-ink"
                      >
                        Create password
                      </label>
                      <span className="text-[11px] font-mono text-muted">
                        {strengthLabels[strengthScore]}
                      </span>
                    </div>

                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        id="invite-password"
                        required
                        placeholder="Min 8 chars, uppercase, lowercase & symbol"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full pl-3.5 pr-10 py-2 rounded-input bg-bg border border-line text-xs text-ink placeholder:text-muted focus:border-primary transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((p) => !p)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
                      >
                        {showPassword ? (
                          <EyeOff className="w-3.5 h-3.5" />
                        ) : (
                          <Eye className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>

                    {/* 4-bar strength indicator */}
                    <div className="grid grid-cols-4 gap-1.5 mt-2">
                      {[1, 2, 3, 4].map((bar) => {
                        const isFilled = strengthScore >= bar
                        const color =
                          strengthScore <= 1
                            ? 'bg-bad'
                            : strengthScore === 2
                            ? 'bg-warn'
                            : strengthScore === 3
                            ? 'bg-primary'
                            : 'bg-ok'
                        return (
                          <div
                            key={bar}
                            className={`h-1 rounded-full transition-colors ${
                              isFilled ? color : 'bg-line'
                            }`}
                          />
                        )
                      })}
                    </div>
                  </div>

                  {/* Terms Checkbox */}
                  <div className="flex items-start gap-2.5 pt-1">
                    <input
                      type="checkbox"
                      id="invite-terms"
                      checked={agreedTerms}
                      onChange={(e) => setAgreedTerms(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded border-line text-primary focus:ring-primary"
                    />
                    <label
                      htmlFor="invite-terms"
                      className="text-xs text-muted leading-tight cursor-pointer"
                    >
                      I agree to the BrandGuard Security Terms and Confidentiality Agreement.
                    </label>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-2.5 pt-3">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-4 py-2 rounded-button bg-bg hover:bg-line/40 text-ink text-xs font-semibold border border-line transition-colors"
                    >
                      Decline
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-button bg-primary hover:bg-primary-hover text-white text-xs font-semibold shadow-sm transition-colors"
                    >
                      Accept invitation
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  )
}
