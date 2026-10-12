import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { FlaggedPage, Platform } from '@/data/types'
import { BRAND_EASE, getEntranceVariants, useReducedMotion } from '@/lib/motion'
import {
  Search,
  X,
  ExternalLink,
  RotateCw,
  AlertTriangle,
  ShieldAlert,
  Clock,
  Layers,
  Sparkles,
} from 'lucide-react'

interface Filtering7Props {
  pages: FlaggedPage[]
  onCheckAgain: (page: FlaggedPage) => void
  onNavigateToCheck: () => void
}

export const Filtering7: React.FC<Filtering7Props> = ({
  pages,
  onCheckAgain,
  onNavigateToCheck,
}) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedPlatforms, setSelectedPlatforms] = useState<Set<Platform>>(new Set())
  const [selectedRisks, setSelectedRisks] = useState<Set<'Low' | 'Medium' | 'High'>>(new Set())
  const [selectedBrands, setSelectedBrands] = useState<Set<string>>(new Set())
  const reducedMotion = useReducedMotion()

  const availablePlatforms: Platform[] = [
    'Instagram',
    'Telegram',
    'Twitter',
    'Facebook',
    'LinkedIn',
    'Website',
    'App store',
  ]

  const availableRisks: ('High' | 'Medium' | 'Low')[] = ['High', 'Medium', 'Low']

  // Extract distinct brand names from pages
  const availableBrands = useMemo(() => {
    const brands = new Set<string>()
    pages.forEach((p) => brands.add(p.brandImitated))
    return Array.from(brands)
  }, [pages])

  // Count helper functions
  const getPlatformCount = (platform: Platform) =>
    pages.filter((p) => p.platform === platform).length

  const getRiskCount = (risk: 'Low' | 'Medium' | 'High') =>
    pages.filter((p) => p.riskLevel === risk).length

  const getBrandCount = (brand: string) =>
    pages.filter((p) => p.brandImitated === brand).length

  // Filter evaluation: OR within group, AND between groups
  const filteredPages = useMemo(() => {
    return pages.filter((page) => {
      // Search query matching handle, URL, or brand
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const matchesQuery =
          page.handle.toLowerCase().includes(q) ||
          page.url.toLowerCase().includes(q) ||
          page.brandImitated.toLowerCase().includes(q)
        if (!matchesQuery) return false
      }

      // Platform group (OR)
      if (selectedPlatforms.size > 0 && !selectedPlatforms.has(page.platform)) {
        return false
      }

      // Risk group (OR)
      if (selectedRisks.size > 0 && !selectedRisks.has(page.riskLevel)) {
        return false
      }

      // Brand group (OR)
      if (selectedBrands.size > 0 && !selectedBrands.has(page.brandImitated)) {
        return false
      }

      return true
    })
  }, [pages, searchQuery, selectedPlatforms, selectedRisks, selectedBrands])

  const isAnyFilterActive =
    searchQuery.trim().length > 0 ||
    selectedPlatforms.size > 0 ||
    selectedRisks.size > 0 ||
    selectedBrands.size > 0

  const handleClearFilters = () => {
    setSearchQuery('')
    setSelectedPlatforms(new Set())
    setSelectedRisks(new Set())
    setSelectedBrands(new Set())
  }

  const togglePlatform = (p: Platform) => {
    const next = new Set(selectedPlatforms)
    if (next.has(p)) next.delete(p)
    else next.add(p)
    setSelectedPlatforms(next)
  }

  const toggleRisk = (r: 'Low' | 'Medium' | 'High') => {
    const next = new Set(selectedRisks)
    if (next.has(r)) next.delete(r)
    else next.add(r)
    setSelectedRisks(next)
  }

  const toggleBrand = (b: string) => {
    const next = new Set(selectedBrands)
    if (next.has(b)) next.delete(b)
    else next.add(b)
    setSelectedBrands(next)
  }

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-2 border-b border-line">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-ink">
            Identified flagged pages
          </h1>
          <p className="text-sm text-muted mt-1">
            Active surveillance registry of confirmed and suspected lookalike entities.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-muted bg-panel px-3 py-1.5 rounded-full border border-line">
            Showing <strong className="text-ink">{filteredPages.length}</strong> of{' '}
            <strong className="text-ink">{pages.length}</strong> listings
          </span>
          {isAnyFilterActive && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Facet Bar */}
      <div className="p-4 sm:p-5 rounded-panel bg-panel border border-line shadow-sm space-y-4">
        {/* Search input */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
          <input
            type="search"
            id="facet-search-box"
            placeholder="Filter by handle, target brand, or URL..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-10 py-2.5 rounded-input bg-bg border border-line text-sm text-ink placeholder:text-muted focus:border-primary transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Facet Chips Groups */}
        <div className="space-y-3 pt-1">
          {/* Risk Level Chips */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-muted font-semibold w-16 shrink-0">Risk:</span>
            <div className="flex flex-wrap gap-1.5">
              {availableRisks.map((risk) => {
                const count = getRiskCount(risk)
                if (count === 0) return null
                const isSelected = selectedRisks.has(risk)
                return (
                  <button
                    key={risk}
                    type="button"
                    onClick={() => toggleRisk(risk)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border transition-colors ${
                      isSelected
                        ? risk === 'High'
                          ? 'bg-bad text-white border-bad font-semibold shadow-sm'
                          : risk === 'Medium'
                          ? 'bg-warn text-white border-warn font-semibold shadow-sm'
                          : 'bg-ok text-white border-ok font-semibold shadow-sm'
                        : 'bg-bg text-ink border-line hover:border-muted/50'
                    }`}
                  >
                    <span>{risk}</span>
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                        isSelected ? 'bg-black/20 text-white' : 'bg-line/60 text-muted'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Platform Chips */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-muted font-semibold w-16 shrink-0">Platform:</span>
            <div className="flex flex-wrap gap-1.5">
              {availablePlatforms.map((plat) => {
                const count = getPlatformCount(plat)
                if (count === 0) return null
                const isSelected = selectedPlatforms.has(plat)
                return (
                  <button
                    key={plat}
                    type="button"
                    onClick={() => togglePlatform(plat)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border transition-colors ${
                      isSelected
                        ? 'bg-primary text-white border-primary font-semibold shadow-sm'
                        : 'bg-bg text-ink border-line hover:border-muted/50'
                    }`}
                  >
                    <span>{plat}</span>
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                        isSelected ? 'bg-white/25 text-white' : 'bg-line/60 text-muted'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Brand Chips */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-muted font-semibold w-16 shrink-0">Brand:</span>
            <div className="flex flex-wrap gap-1.5">
              {availableBrands.map((brand) => {
                const count = getBrandCount(brand)
                const isSelected = selectedBrands.has(brand)
                return (
                  <button
                    key={brand}
                    type="button"
                    onClick={() => toggleBrand(brand)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border transition-colors ${
                      isSelected
                        ? 'bg-ink text-panel border-ink font-semibold shadow-sm'
                        : 'bg-bg text-ink border-line hover:border-muted/50'
                    }`}
                  >
                    <span>{brand}</span>
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                        isSelected ? 'bg-panel/30 text-panel' : 'bg-line/60 text-muted'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Asset Grid or Empty State */}
      {filteredPages.length === 0 ? (
        <div className="p-12 text-center rounded-panel bg-panel border border-line space-y-4">
          <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-ink">No flagged pages match your criteria</h3>
            <p className="text-sm text-muted max-w-md mx-auto mt-1">
              Try adjusting your facet chips, clearing search terms, or run an analysis on a new URL.
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            {isAnyFilterActive && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="px-4 py-2 rounded-button bg-bg border border-line text-sm font-semibold text-ink hover:bg-line/30 transition-colors"
              >
                Clear all filters
              </button>
            )}
            <button
              type="button"
              onClick={onNavigateToCheck}
              className="px-4 py-2 rounded-button bg-primary text-white text-sm font-semibold hover:bg-primary-hover shadow-sm transition-colors"
            >
              Check a new profile
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPages.map((page, index) => {
            const isHigh = page.riskLevel === 'High'
            const isMedium = page.riskLevel === 'Medium'
            const isJustNow = page.foundAt === 'Just now'

            return (
              <motion.div
                key={page.id}
                variants={getEntranceVariants(reducedMotion)}
                initial="hidden"
                animate="visible"
                className={`flex flex-col justify-between p-4 rounded-panel bg-panel border transition-shadow hover:shadow-md ${
                  isJustNow
                    ? 'border-primary ring-1 ring-primary/30'
                    : 'border-line hover:border-muted/50'
                }`}
              >
                {/* Card Top */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-bg border border-line text-ink">
                      {page.platform}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {isJustNow && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold tracking-wide uppercase px-2 py-0.5 rounded-full bg-primary text-white animate-pulse">
                          <Sparkles className="w-2.5 h-2.5" />
                          Just now
                        </span>
                      )}
                      <span
                        className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                          isHigh
                            ? 'bg-bad/10 text-bad border-bad/30'
                            : isMedium
                            ? 'bg-warn/10 text-warn border-warn/30'
                            : 'bg-ok/10 text-ok border-ok/30'
                        }`}
                      >
                        {page.riskLevel} Risk ({page.matchPercentage}%)
                      </span>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-base font-bold text-ink truncate font-mono">
                      @{page.handle}
                    </h4>
                    <a
                      href={page.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-muted hover:text-primary flex items-center gap-1 mt-0.5 truncate transition-colors"
                      title={page.url}
                    >
                      <span className="truncate">{page.url}</span>
                      <ExternalLink className="w-3 h-3 shrink-0" />
                    </a>
                  </div>

                  <div className="pt-2 border-t border-line/60 space-y-1 text-xs">
                    <div className="flex items-center justify-between text-muted">
                      <span>Imitating brand:</span>
                      <strong className="text-ink font-semibold">
                        {page.brandImitated}
                      </strong>
                    </div>
                    {page.matchAreaSummary && page.matchAreaSummary.length > 0 && (
                      <div className="flex items-center justify-between text-muted">
                        <span>Matched area:</span>
                        <span className="text-[11px] text-ink font-medium">
                          {page.matchAreaSummary.join(', ')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Bottom: Timestamp & Check again */}
                <div className="flex items-center justify-between pt-3 mt-3 border-t border-line">
                  <span className="text-[11px] text-muted flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {page.foundAt}
                  </span>

                  <button
                    type="button"
                    onClick={() => onCheckAgain(page)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-button bg-bg hover:bg-primary/10 text-ink hover:text-primary border border-line text-xs font-semibold transition-colors"
                  >
                    <RotateCw className="w-3 h-3" />
                    <span>Check again</span>
                  </button>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
