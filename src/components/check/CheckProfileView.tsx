import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Platform, DetectionResult, BrandRecord, FlaggedPage } from '@/data/types'
import { analyseAgainstDatabase, extractHandleFromUrl } from '@/data/detection'
import { BRAND_EASE, useReducedMotion } from '@/lib/motion'
import { GlideSelect } from '@/components/free/GlideSelect'
import { LatticeLoader } from '@/components/free/LatticeLoader'
import { CallChip, CallChipState } from '@/components/free/CallChip'
import { RiskReport } from './RiskReport'
import {
  Link as LinkIcon,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Sparkles,
  ShieldAlert,
  Search,
  ExternalLink,
} from 'lucide-react'

interface CheckProfileViewProps {
  brands: BrandRecord[]
  onAddFlaggedPage: (page: FlaggedPage) => void
  initialUrl?: string
  initialPlatform?: Platform
}

export const CheckProfileView: React.FC<CheckProfileViewProps> = ({
  brands,
  onAddFlaggedPage,
  initialUrl = '',
  initialPlatform = 'Telegram',
}) => {
  const [url, setUrl] = useState(initialUrl)
  const [platform, setPlatform] = useState<Platform>(initialPlatform)
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [showOptionalFields, setShowOptionalFields] = useState(false)

  // Validation
  const [urlError, setUrlError] = useState<string | null>(null)

  // Analysis Animation States
  const [isAnalysing, setIsAnalysing] = useState(false)
  const [analysisComplete, setAnalysisComplete] = useState(false)
  const [chip1State, setChip1State] = useState<CallChipState>('idle')
  const [chip2State, setChip2State] = useState<CallChipState>('idle')
  const [chip3State, setChip3State] = useState<CallChipState>('idle')

  // Result & Watch state
  const [result, setResult] = useState<DetectionResult | null>(null)
  const [isWatching, setIsWatching] = useState(false)

  const reducedMotion = useReducedMotion()

  useEffect(() => {
    if (initialUrl) {
      setUrl(initialUrl)
    }
    if (initialPlatform) {
      setPlatform(initialPlatform)
    }
  }, [initialUrl, initialPlatform])

  // Validate URL with plain, helpful explanations
  const validateUrl = (value: string, plat: Platform): string | null => {
    if (!value.trim()) {
      return 'Enter or paste a profile or website URL to begin analysis.'
    }
    const val = value.toLowerCase().trim()

    if (plat === 'Instagram') {
      if (val.includes('t.me') || val.includes('telegram.org')) {
        return "This URL looks like a Telegram link. Check the platform you chose or select 'Telegram'."
      }
      if (val.includes('x.com') || val.includes('twitter.com')) {
        return "This URL looks like a Twitter link. Check the platform you chose or select 'Twitter'."
      }
      if (val.includes('linkedin.com')) {
        return "This URL looks like a LinkedIn link. Check the platform you chose or select 'LinkedIn'."
      }
    } else if (plat === 'Telegram') {
      if (val.includes('instagram.com')) {
        return "This URL looks like an Instagram link. Check the platform you chose or select 'Instagram'."
      }
      if (val.includes('x.com') || val.includes('twitter.com')) {
        return "This URL looks like a Twitter link. Check the platform you chose or select 'Twitter'."
      }
    } else if (plat === 'Twitter') {
      if (val.includes('t.me') || val.includes('telegram.org')) {
        return "This URL looks like a Telegram link. Check the platform you chose or select 'Telegram'."
      }
      if (val.includes('instagram.com')) {
        return "This URL looks like an Instagram link. Check the platform you chose or select 'Instagram'."
      }
    }

    // Basic URL/Handle shape sanity check
    if (!val.includes('.') && !val.includes('/') && !val.startsWith('@')) {
      return 'Please enter a valid profile handle with @ or a complete URL (e.g., https://...).'
    }

    return null
  }

  // Pre-seed 3 demo examples
  const loadExample = (type: 'fake' | 'official' | 'unique') => {
    setUrlError(null)
    setAnalysisComplete(false)
    setResult(null)
    setIsWatching(false)

    if (type === 'fake') {
      setUrl('https://t.me/acme_bank_helpdesk')
      setPlatform('Telegram')
      setDisplayName('Acme Bank 24/7 Customer Support & Help Desk')
      setBio('Urgent customer resolution helpline. Contact here for frozen accounts, card limits, KYC renewal, immediate refunds.')
      setPhone('+19991234567')
      setEmail('helpdesk@acme-support-portal.org')
      setShowOptionalFields(true)
    } else if (type === 'official') {
      setUrl('https://instagram.com/acmebank')
      setPlatform('Instagram')
      setDisplayName('Acme Bank')
      setBio('Official Instagram handle for Acme Bank. Banking simplified.')
      setPhone('+18005550199')
      setEmail('support@acmebank.com')
      setShowOptionalFields(true)
    } else {
      setUrl('https://instagram.com/wanderlust_baking_club')
      setPlatform('Instagram')
      setDisplayName('Artisan Sourdough & Pastry Baker')
      setBio('Weekly sourdough drops, micro-bakery sourdough crumb shots & recipes. Based in Seattle.')
      setPhone('')
      setEmail('')
      setShowOptionalFields(false)
    }
  }

  // Run analysis workflow
  const handleStartAnalysis = () => {
    const error = validateUrl(url, platform)
    if (error) {
      setUrlError(error)
      return
    }
    setUrlError(null)
    setIsAnalysing(true)
    setAnalysisComplete(false)
    setResult(null)
    setIsWatching(false)

    // Compute actual engine result
    const computedResult = analyseAgainstDatabase(
      {
        url,
        platform,
        displayName: displayName || undefined,
        bio: bio || undefined,
        phone: phone || undefined,
        email: email || undefined,
      },
      brands
    )

    if (reducedMotion) {
      // Instant execution for reduced motion
      setChip1State('done')
      setChip2State('done')
      setChip3State('done')
      setIsAnalysing(false)
      setAnalysisComplete(true)
      setResult(computedResult)

      if (!computedResult.isOfficialRecord && computedResult.verdict !== 'Unique') {
        onAddFlaggedPage({
          id: `page-${Date.now()}`,
          platform,
          handle: computedResult.handleExtracted,
          url,
          riskLevel: computedResult.verdict as 'Low' | 'Medium' | 'High',
          matchPercentage: computedResult.matchPercentage,
          brandImitated: computedResult.matchedBrand?.name || 'Acme Bank',
          foundAt: 'Just now',
          timestamp: Date.now(),
          matchAreaSummary: [
            computedResult.matchArea.handle ? 'Handle' : '',
            computedResult.matchArea.displayName ? 'Display Name' : '',
            computedResult.matchArea.domain ? 'Domain' : '',
          ].filter(Boolean),
        })
      }
      return
    }

    // Orchestrated sequence:
    // Step 1: Search ID handle (0 - 550ms)
    setChip1State('running')
    setChip2State('idle')
    setChip3State('idle')

    setTimeout(() => {
      setChip1State('done')
      setChip2State('running')

      // Step 2: Compare brand names (550 - 1150ms)
      setTimeout(() => {
        setChip2State('done')
        setChip3State('running')

        // Step 3: Match phone / email (1150 - 1800ms)
        setTimeout(() => {
          setChip3State('done')
          setIsAnalysing(false)
          setAnalysisComplete(true)
          setResult(computedResult)

          // Add to identified pages if matched and non-official
          if (!computedResult.isOfficialRecord && computedResult.verdict !== 'Unique') {
            onAddFlaggedPage({
              id: `page-${Date.now()}`,
              platform,
              handle: computedResult.handleExtracted,
              url,
              riskLevel: computedResult.verdict as 'Low' | 'Medium' | 'High',
              matchPercentage: computedResult.matchPercentage,
              brandImitated: computedResult.matchedBrand?.name || 'Acme Bank',
              foundAt: 'Just now',
              timestamp: Date.now(),
              matchAreaSummary: [
                computedResult.matchArea.handle ? 'Handle' : '',
                computedResult.matchArea.displayName ? 'Display Name' : '',
                computedResult.matchArea.domain ? 'Domain' : '',
              ].filter(Boolean),
            })
          }
        }, 650)
      }, 600)
    }, 550)
  }

  const extractedHandle = extractHandleFromUrl(url || '@handle', platform)

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      {/* Page Title & Context */}
      <div className="pb-2 border-b border-line flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-ink">
            Check a suspect profile
          </h1>
          <p className="text-sm text-muted mt-1">
            Examine public handles, links, and profile details against authorized brand records.
          </p>
        </div>

        {/* 3 Example Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-muted mr-1 hidden sm:inline">
            Load demo:
          </span>
          <button
            type="button"
            onClick={() => loadExample('fake')}
            className="px-2.5 py-1.5 rounded-button bg-bad/10 hover:bg-bad/20 text-bad text-xs font-semibold border border-bad/30 transition-colors"
          >
            Fake support account
          </button>
          <button
            type="button"
            onClick={() => loadExample('official')}
            className="px-2.5 py-1.5 rounded-button bg-ok/10 hover:bg-ok/20 text-ok text-xs font-semibold border border-ok/30 transition-colors"
          >
            Official account
          </button>
          <button
            type="button"
            onClick={() => loadExample('unique')}
            className="px-2.5 py-1.5 rounded-button bg-bg hover:bg-line/40 text-ink text-xs font-semibold border border-line transition-colors"
          >
            Unrelated profile
          </button>
        </div>
      </div>

      {/* Main Grid: 4-Step Left Panel & Results Right Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT PANEL: NUMBERED 4-STEP FORM (7 cols) */}
        <section
          aria-label="Profile investigation steps"
          className="lg:col-span-6 xl:col-span-6 p-5 sm:p-6 rounded-panel bg-panel border border-line shadow-sm space-y-6"
        >
          {/* STEP 1: Paste the URL */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label
                htmlFor="input-url"
                className="text-sm font-bold text-ink flex items-center gap-2"
              >
                <span className="w-5 h-5 rounded-full bg-primary text-white text-xs flex items-center justify-center font-bold">
                  1
                </span>
                <span>Paste the URL</span>
              </label>
              {url && (
                <span className="text-[11px] font-mono text-muted">
                  Handle: @{extractedHandle}
                </span>
              )}
            </div>

            <div className="relative">
              <input
                type="text"
                id="input-url"
                placeholder="e.g. https://t.me/acme_bank_helpdesk"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value)
                  if (urlError) setUrlError(null)
                }}
                className={`w-full px-3.5 py-2.5 rounded-input bg-bg border text-sm text-ink placeholder:text-muted transition-colors ${
                  urlError
                    ? 'border-bad ring-1 ring-bad/20'
                    : 'border-line focus:border-primary'
                }`}
              />
              <LinkIcon className="w-4 h-4 text-muted absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {urlError && (
              <div className="p-2.5 rounded-button bg-bad/10 border border-bad/30 text-bad text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{urlError}</span>
              </div>
            )}
          </div>

          {/* STEP 2: Choose the platform */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-ink flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-primary text-white text-xs flex items-center justify-center font-bold">
                2
              </span>
              <span>Choose the platform</span>
            </label>

            {/* GlideSelect Component */}
            <GlideSelect
              value={platform}
              onChange={(newPlat) => {
                setPlatform(newPlat)
                if (urlError) setUrlError(null)
              }}
            />
          </div>

          {/* STEP 3: Optional Profile Details & Analyse Button */}
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold text-ink flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-primary text-white text-xs flex items-center justify-center font-bold">
                  3
                </span>
                <span>Analyse against the database</span>
              </label>

              <button
                type="button"
                onClick={() => setShowOptionalFields((prev) => !prev)}
                className="text-xs text-primary font-semibold hover:underline flex items-center gap-1"
              >
                <span>{showOptionalFields ? 'Hide details' : 'Add profile details'}</span>
                {showOptionalFields ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>
            </div>

            <p className="text-xs text-muted">
              Search handle, then cross-reference with brand registry. More details give a more accurate match.
            </p>

            {/* Optional profile fields disclosure */}
            <AnimatePresence>
              {showOptionalFields && (
                <motion.div
                  initial={
                    reducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }
                  }
                  animate={
                    reducedMotion ? { opacity: 1 } : { opacity: 1, height: 'auto' }
                  }
                  exit={
                    reducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }
                  }
                  transition={{ duration: 0.25, ease: BRAND_EASE }}
                  className="space-y-3 p-3.5 rounded-button bg-bg border border-line overflow-hidden text-xs"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-muted font-semibold mb-1">
                        Display name shown on profile
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Acme Bank Help Desk"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-input bg-panel border border-line text-ink"
                      />
                    </div>
                    <div>
                      <label className="block text-muted font-semibold mb-1">
                        Phone shown (if any)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. +1 800 555 0199"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-input bg-panel border border-line text-ink font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-muted font-semibold mb-1">
                        Email shown on profile
                      </label>
                      <input
                        type="email"
                        placeholder="e.g. support@acme-support.org"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-input bg-panel border border-line text-ink font-mono"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-muted font-semibold mb-1">
                        Bio text or account description
                      </label>
                      <textarea
                        rows={2}
                        placeholder="Paste profile biography text..."
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-input bg-panel border border-line text-ink"
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Analysis Progress: LatticeLoader & CallChips */}
            {isAnalysing && (
              <div className="p-4 rounded-button bg-bg border border-line space-y-3">
                <div className="flex items-center justify-between">
                  <LatticeLoader
                    isLoading={isAnalysing}
                    isComplete={analysisComplete}
                  />
                </div>

                <div className="space-y-2">
                  <CallChip
                    label={`Search ID @${extractedHandle}`}
                    sublabel={platform}
                    state={chip1State}
                    targetDurationMs={550}
                  />
                  <CallChip
                    label="Compare brand names & registry"
                    sublabel={`${brands.length} brands`}
                    state={chip2State}
                    targetDurationMs={600}
                  />
                  <CallChip
                    label="Match contact credentials & bio"
                    sublabel="Phone, email & text similarity"
                    state={chip3State}
                    targetDurationMs={650}
                  />
                </div>
              </div>
            )}

            {/* Trigger Button */}
            <button
              type="button"
              id="analyse-database-button"
              disabled={isAnalysing}
              onClick={handleStartAnalysis}
              className={`w-full py-2.5 px-4 rounded-button bg-primary hover:bg-primary-hover text-white text-sm font-semibold shadow-sm transition-all flex items-center justify-center gap-2 ${
                isAnalysing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
              }`}
            >
              <Search className="w-4 h-4" />
              <span>
                {isAnalysing ? 'Analysing against database...' : 'Analyse against database'}
              </span>
            </button>
          </div>

          {/* STEP 4: Branch on the result info */}
          <div className="pt-3 border-t border-line text-xs text-muted flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-line text-muted text-xs flex items-center justify-center font-bold shrink-0 mt-0.5">
              4
            </span>
            <p>
              <strong>Branch on result:</strong> Matched lookalikes output match percentage, anomaly range and sub-checks. Certified official accounts return verified status. Unrelated profiles output unique confirmation.
            </p>
          </div>
        </section>

        {/* RIGHT PANEL: RISK REPORT / EMPTY STATE (5-6 cols) */}
        <section
          aria-label="Risk assessment report"
          className="lg:col-span-6 xl:col-span-6 space-y-4"
        >
          {result ? (
            <RiskReport
              result={result}
              isWatching={isWatching}
              onToggleWatch={() => setIsWatching((w) => !w)}
            />
          ) : (
            /* Standby State */
            <div className="p-8 sm:p-12 text-center rounded-panel bg-panel/60 border border-line border-dashed space-y-3 flex flex-col items-center justify-center min-h-[380px]">
              <div className="w-12 h-12 rounded-xl bg-bg text-muted flex items-center justify-center border border-line">
                <ShieldAlert className="w-6 h-6 stroke-[1.8]" />
              </div>
              <h3 className="text-base font-bold text-ink">
                Awaiting profile submission
              </h3>
              <p className="text-xs text-muted max-w-sm leading-relaxed">
                Paste a link on the left and click <strong>Analyse against database</strong> to run handle normalization, brand similarity scoring, and credential checks.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
