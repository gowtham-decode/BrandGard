import { useState, useEffect } from 'react'

/**
 * BrandGuard Motion Constants
 * Consistent with React Bits Pro conventions:
 * - One primary easing curve: [0.22, 1, 0.36, 1]
 * - Entrances: fade + 12px slide up over ~0.8s
 * - Stagger: 0.06 - 0.08s, capped at <= 0.3s
 * - Sliding indicators: spring(stiffness 380, damping 32)
 */

export const BRAND_EASE = [0.22, 1, 0.36, 1] as const

export const SPRING_PILL = {
  type: 'spring',
  stiffness: 380,
  damping: 32,
} as const

export const DURATION = {
  entrance: 0.8,
  stagger: 0.06,
  staggerMax: 0.3,
  quick: 0.25,
  transition: 0.4,
} as const

export function useReducedMotion(): boolean {
  const [prefersReduced, setPrefersReduced] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  })

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReduced(e.matches)
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  return prefersReduced
}

export function getEntranceVariants(reduced: boolean) {
  if (reduced) {
    return {
      hidden: { opacity: 0 },
      visible: { opacity: 1, transition: { duration: 0.15 } },
    }
  }
  return {
    hidden: { opacity: 0, y: 12 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: DURATION.entrance,
        ease: BRAND_EASE,
      },
    },
  }
}

export function getStaggerContainerVariants(count: number, reduced: boolean) {
  if (reduced) {
    return {
      hidden: { opacity: 0 },
      visible: {
        opacity: 1,
        transition: { staggerChildren: 0.02 },
      },
    }
  }
  const stagger = Math.min(DURATION.stagger, DURATION.staggerMax / Math.max(count, 1))
  return {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: stagger,
        delayChildren: 0.04,
      },
    },
  }
}
