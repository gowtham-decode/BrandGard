import React, { useState, useEffect } from 'react'
import { BrandRecord, FlaggedPage, Platform } from '@/data/types'
import { INITIAL_BRANDS, INITIAL_FLAGGED_PAGES } from '@/data/mockStore'
import { AppSidebar2, NavRoute } from '@/components/pro/AppSidebar2'
import { CheckProfileView } from '@/components/check/CheckProfileView'
import { Filtering7 } from '@/components/pro/Filtering7'
import { BrandDatabaseView } from '@/components/brands/BrandDatabaseView'
import { MonitoringView } from '@/components/monitoring/MonitoringView'
import { Authentication12 } from '@/components/pro/Authentication12'
import { NotFound5 } from '@/components/pro/NotFound5'
import { toggleThemeWithReveal } from '@/lib/theme'
import { useLenisScroll } from '@/hooks/useLenisScroll'
import { ShieldCheck, UserPlus, Bug, Sparkles } from 'lucide-react'

export function App() {
  // Theme state
  const [isDark, setIsDark] = useState<boolean>(true)

  // Navigation route: 'check' | 'pages' | 'brands' | 'monitoring' | '404'
  const [currentRoute, setCurrentRoute] = useState<string>('check')
  const [failedPath, setFailedPath] = useState<string>('/unknown/profile-threat')

  // Data state
  const [brands, setBrands] = useState<BrandRecord[]>(INITIAL_BRANDS)
  const [flaggedPages, setFlaggedPages] = useState<FlaggedPage[]>(INITIAL_FLAGGED_PAGES)

  // Check Profile prefill state (when "Check again" is clicked in Identified pages)
  const [checkPrefill, setCheckPrefill] = useState<{
    url: string
    platform: Platform
  } | null>(null)

  // Invitation Modal State
  const [isInviteOpen, setIsInviteOpen] = useState(false)

  // Initialize Lenis smooth scroll
  useLenisScroll()

  // Sync browser path or hash with internal route
  useEffect(() => {
    const handleLocation = () => {
      const hash = window.location.hash.replace(/^#\/?/, '')
      const path = window.location.pathname.replace(/^\//, '')
      const target = hash || path

      if (target === '' || target === 'check') {
        setCurrentRoute('check')
      } else if (target === 'pages') {
        setCurrentRoute('pages')
      } else if (target === 'brands') {
        setCurrentRoute('brands')
      } else if (target === 'monitoring') {
        setCurrentRoute('monitoring')
      } else if (target) {
        setFailedPath('/' + target)
        setCurrentRoute('404')
      }
    }

    handleLocation()
    window.addEventListener('popstate', handleLocation)
    window.addEventListener('hashchange', handleLocation)
    return () => {
      window.removeEventListener('popstate', handleLocation)
      window.removeEventListener('hashchange', handleLocation)
    }
  }, [])

  const navigateTo = (route: string) => {
    setCurrentRoute(route)
    window.history.pushState(null, '', `#/${route}`)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Theme toggle with View Transitions API circular reveal
  const handleToggleTheme = (e?: React.MouseEvent) => {
    toggleThemeWithReveal(isDark, setIsDark, e)
  }

  // Add newly identified page to the top as "Just now"
  const handleAddFlaggedPage = (newPage: FlaggedPage) => {
    setFlaggedPages((prev) => [newPage, ...prev])
  }

  // Brand management
  const handleAddBrand = (newBrand: BrandRecord) => {
    setBrands((prev) => [newBrand, ...prev])
  }

  const handleRemoveBrand = (brandId: string) => {
    setBrands((prev) => prev.filter((b) => b.id !== brandId))
  }

  // Trigger "Check again" from Identified pages gallery
  const handleCheckAgain = (page: FlaggedPage) => {
    setCheckPrefill({
      url: page.url,
      platform: page.platform,
    })
    navigateTo('check')
  }

  return (
    <div className="min-h-screen bg-bg text-ink flex flex-col md:flex-row antialiased">
      {/* App Sidebar 2: Rail on desktop, Bottom bar on mobile */}
      <AppSidebar2
        currentRoute={
          (currentRoute === 'pages' ||
          currentRoute === 'brands' ||
          currentRoute === 'monitoring'
            ? currentRoute
            : 'check') as NavRoute
        }
        onNavigate={(r) => navigateTo(r)}
        isDark={isDark}
        onToggleTheme={handleToggleTheme}
        flaggedCount={flaggedPages.length}
        brandsCount={brands.length}
        onOpenInviteModal={() => setIsInviteOpen(true)}
      />

      {/* Main Content Area (offset by rail on desktop, bottom bar on mobile) */}
      <div className="flex-1 md:pl-16 lg:pl-20 flex flex-col min-h-screen pb-20 md:pb-8">
        {/* Top App Header */}
        <header className="sticky top-0 z-30 bg-panel/85 backdrop-blur-md border-b border-line px-4 sm:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigateTo('check')}
              className="flex items-center gap-2 group text-left"
            >
              <span className="font-extrabold text-lg sm:text-xl tracking-tight text-ink group-hover:text-primary transition-colors">
                BrandGuard
              </span>
              <span className="text-[10px] font-mono text-muted bg-bg px-2 py-0.5 rounded-full border border-line">
                v1.0 Demo
              </span>
            </button>
            <span className="hidden sm:inline-block w-px h-4 bg-line" />
            <span className="hidden sm:inline text-xs text-muted">
              Kampus.VC Security Prototype
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Invite Teammate button */}
            <button
              type="button"
              onClick={() => setIsInviteOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-button bg-bg hover:bg-line/40 text-ink text-xs font-semibold border border-line transition-colors"
            >
              <UserPlus className="w-3.5 h-3.5 text-primary" />
              <span className="hidden sm:inline">Invite teammate</span>
              <span className="sm:hidden">Invite</span>
            </button>

            {/* Test 404 Trigger */}
            <button
              type="button"
              onClick={() => {
                setFailedPath('/broken-scam-feed/992')
                navigateTo('404')
              }}
              title="Test the 404 bounce screen"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-button bg-bg hover:bg-line/40 text-muted hover:text-ink text-xs font-semibold border border-line transition-colors"
            >
              <Bug className="w-3 h-3 text-warn" />
              <span className="hidden md:inline">Test 404</span>
            </button>
          </div>
        </header>

        {/* Route Render */}
        <main className="flex-1 p-4 sm:p-8 max-w-7xl w-full mx-auto">
          {currentRoute === 'check' && (
            <CheckProfileView
              brands={brands}
              onAddFlaggedPage={handleAddFlaggedPage}
              initialUrl={checkPrefill?.url}
              initialPlatform={checkPrefill?.platform}
            />
          )}

          {currentRoute === 'pages' && (
            <Filtering7
              pages={flaggedPages}
              onCheckAgain={handleCheckAgain}
              onNavigateToCheck={() => navigateTo('check')}
            />
          )}

          {currentRoute === 'brands' && (
            <BrandDatabaseView
              brands={brands}
              onAddBrand={handleAddBrand}
              onRemoveBrand={handleRemoveBrand}
            />
          )}

          {currentRoute === 'monitoring' && (
            <MonitoringView
              onNavigateToCheck={() => navigateTo('check')}
            />
          )}

          {currentRoute === '404' && (
            <NotFound5
              failedPath={failedPath}
              onGoHome={() => navigateTo('check')}
              onCheckProfile={() => navigateTo('check')}
            />
          )}
        </main>
      </div>

      {/* Authentication 12: Teammate Invitation Acceptance Modal */}
      <Authentication12
        isOpen={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
        onSuccess={() => setIsInviteOpen(false)}
      />
    </div>
  )
}
export default App
