import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { BRAND_EASE, SPRING_PILL, useReducedMotion } from '@/lib/motion'
import {
  ShieldAlert,
  SearchCode,
  Layers,
  Database,
  Radio,
  Sun,
  Moon,
  Sparkles,
  UserPlus,
} from 'lucide-react'

export type NavRoute = 'check' | 'pages' | 'brands' | 'monitoring'

interface AppSidebar2Props {
  currentRoute: NavRoute
  onNavigate: (route: NavRoute) => void
  isDark: boolean
  onToggleTheme: () => void
  flaggedCount: number
  brandsCount: number
  onOpenInviteModal: () => void
}

interface NavItemDef {
  id: NavRoute
  label: string
  subtitle: string
  icon: React.ElementType
  badge?: string | number
  isComingSoon?: boolean
}

export const AppSidebar2: React.FC<AppSidebar2Props> = ({
  currentRoute,
  onNavigate,
  isDark,
  onToggleTheme,
  flaggedCount,
  brandsCount,
  onOpenInviteModal,
}) => {
  const [hoveredRoute, setHoveredRoute] = useState<NavRoute | null>(null)
  const [focusedRoute, setFocusedRoute] = useState<NavRoute | null>(null)
  const [hasMeasured, setHasMeasured] = useState(false)
  const reducedMotion = useReducedMotion()

  const navItems: NavItemDef[] = [
    {
      id: 'check',
      label: 'Check profile',
      subtitle: 'Analyze URLs against brand registry for lookalikes & impersonation',
      icon: SearchCode,
    },
    {
      id: 'pages',
      label: 'Identified pages',
      subtitle: 'Registry of confirmed lookalike profiles, fake handles & scam listings',
      icon: Layers,
      badge: flaggedCount,
    },
    {
      id: 'brands',
      label: 'Brand database',
      subtitle: 'Manage verified brand identities, official domains & contact records',
      icon: Database,
      badge: brandsCount,
    },
    {
      id: 'monitoring',
      label: 'Monitoring',
      subtitle: 'Continuous scanning engine & automated push alerts (Phase 2)',
      icon: Radio,
      isComingSoon: true,
    },
  ]

  useEffect(() => {
    // Jump on first measurement
    const timer = setTimeout(() => setHasMeasured(true), 50)
    return () => clearTimeout(timer)
  }, [])

  return (
    <>
      {/* Desktop / Tablet Icon Rail (>= 820px) */}
      <aside
        aria-label="Primary navigation rail"
        className="hidden md:flex flex-col items-center justify-between w-16 lg:w-20 fixed left-0 top-0 bottom-0 z-40 bg-panel border-r border-line py-5 select-none"
      >
        {/* Brand Logo & Kampus.VC Tag */}
        <div className="flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={() => onNavigate('check')}
            title="BrandGuard Home"
            className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center shadow-md hover:scale-105 transition-transform"
          >
            <ShieldAlert className="w-5 h-5 stroke-[2.2]" />
          </button>
          <span className="text-[10px] font-bold tracking-tight text-primary uppercase bg-primary/10 px-1.5 py-0.5 rounded-full border border-primary/20">
            K.VC
          </span>
        </div>

        {/* Navigation Items with Sliding Indicator & Flyouts */}
        <nav className="relative flex flex-col items-center gap-4 my-auto w-full">
          {navItems.map((item) => {
            const isActive = currentRoute === item.id
            const isFlyoutOpen = hoveredRoute === item.id || focusedRoute === item.id
            const Icon = item.icon

            return (
              <div
                key={item.id}
                className="relative flex items-center justify-center w-full group"
                onMouseEnter={() => setHoveredRoute(item.id)}
                onMouseLeave={() => setHoveredRoute(null)}
              >
                {/* Active Sliding Indicator on the left rail border */}
                {isActive && (
                  <motion.div
                    layoutId="rail-active-marker"
                    transition={
                      !hasMeasured || reducedMotion
                        ? { duration: 0 }
                        : SPRING_PILL
                    }
                    className="absolute left-0 w-1 h-8 rounded-r-full bg-primary -translate-y-1/2 top-1/2"
                  />
                )}

                <button
                  type="button"
                  id={`nav-rail-${item.id}`}
                  onClick={() => onNavigate(item.id)}
                  onFocus={() => setFocusedRoute(item.id)}
                  onBlur={() => setFocusedRoute(null)}
                  aria-label={`${item.label} ${item.isComingSoon ? '(Coming later)' : ''}`}
                  className={`relative w-11 h-11 rounded-xl flex items-center justify-center transition-colors ${
                    isActive
                      ? 'bg-primary/10 text-primary font-semibold'
                      : 'text-muted hover:text-ink hover:bg-bg'
                  }`}
                >
                  <Icon className="w-5 h-5 stroke-[2]" />

                  {/* Badge count or status */}
                  {item.badge !== undefined && (
                    <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-primary text-white text-[10px] font-mono flex items-center justify-center font-bold">
                      {item.badge}
                    </span>
                  )}
                  {item.isComingSoon && (
                    <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-warn animate-pulse" />
                  )}
                </button>

                {/* Hover / Keyboard Flyout Card */}
                <AnimatePresence>
                  {isFlyoutOpen && (
                    <motion.div
                      role="tooltip"
                      initial={
                        reducedMotion
                          ? { opacity: 0 }
                          : { opacity: 0, x: -8, scale: 0.96 }
                      }
                      animate={
                        reducedMotion
                          ? { opacity: 1 }
                          : { opacity: 1, x: 0, scale: 1 }
                      }
                      exit={
                        reducedMotion
                          ? { opacity: 0 }
                          : { opacity: 0, x: -6, scale: 0.96 }
                      }
                      transition={{ duration: 0.18, ease: BRAND_EASE }}
                      className="absolute left-full ml-3 top-1/2 -translate-y-1/2 z-50 w-64 p-3.5 rounded-panel bg-panel border border-line shadow-2xl pointer-events-none text-left"
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-semibold text-sm text-ink flex items-center gap-1.5">
                          {item.label}
                        </span>
                        {item.isComingSoon ? (
                          <span className="text-[10px] uppercase font-bold text-warn bg-warn/15 px-2 py-0.5 rounded-full border border-warn/30">
                            Later Phase
                          </span>
                        ) : item.badge !== undefined ? (
                          <span className="text-xs font-mono text-muted">
                            {item.badge} recorded
                          </span>
                        ) : null}
                      </div>
                      <p className="text-xs text-muted leading-relaxed">
                        {item.subtitle}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </nav>

        {/* Footer controls: Team Invite & Theme Switch */}
        <div className="flex flex-col items-center gap-3 w-full">
          {/* Invite teammate button */}
          <button
            type="button"
            onClick={onOpenInviteModal}
            title="Teammate Invitation Screen"
            className="w-10 h-10 rounded-xl bg-bg hover:bg-line/40 text-ink flex items-center justify-center border border-line transition-colors relative group"
          >
            <UserPlus className="w-4 h-4 text-muted group-hover:text-primary transition-colors" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-primary rounded-full" />
          </button>

          {/* Theme Switch with Circular Reveal support */}
          <button
            type="button"
            id="theme-toggle-button"
            onClick={onToggleTheme}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            className="w-10 h-10 rounded-xl bg-bg hover:bg-line/40 text-ink flex items-center justify-center border border-line transition-colors"
          >
            {isDark ? (
              <Sun className="w-4 h-4 text-warn" />
            ) : (
              <Moon className="w-4 h-4 text-primary" />
            )}
          </button>
        </div>
      </aside>

      {/* Mobile Bottom Bar (< 820px) */}
      <nav
        aria-label="Mobile bottom navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-panel/95 backdrop-blur-md border-t border-line px-3 py-2 flex items-center justify-around select-none safe-bottom"
      >
        {navItems.map((item) => {
          const isActive = currentRoute === item.id
          const Icon = item.icon
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              className={`relative flex flex-col items-center gap-1 py-1 px-3 rounded-lg text-[11px] font-medium transition-colors ${
                isActive ? 'text-primary font-bold' : 'text-muted hover:text-ink'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span>{item.id === 'check' ? 'Check' : item.id === 'pages' ? 'Flagged' : item.id === 'brands' ? 'Brands' : 'Monitor'}</span>
              {item.isComingSoon && (
                <span className="absolute top-1 right-2 w-1.5 h-1.5 rounded-full bg-warn" />
              )}
            </button>
          )
        })}

        {/* Mobile Theme Toggle */}
        <button
          type="button"
          onClick={onToggleTheme}
          className="flex flex-col items-center gap-1 py-1 px-2 rounded-lg text-[11px] text-muted hover:text-ink"
        >
          {isDark ? <Sun className="w-5 h-5 text-warn" /> : <Moon className="w-5 h-5 text-primary" />}
          <span>{isDark ? 'Light' : 'Dark'}</span>
        </button>
      </nav>
    </>
  )
}
