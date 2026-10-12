import { useEffect } from 'react'
import Lenis from 'lenis'
import { useReducedMotion } from '@/lib/motion'

export function useLenisScroll() {
  const reducedMotion = useReducedMotion()

  useEffect(() => {
    if (reducedMotion || typeof window === 'undefined') {
      return
    }

    const lenis = new Lenis({
      duration: 1.1,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    })

    function raf(time: number) {
      lenis.raf(time)
      requestAnimationFrame(raf)
    }

    const animId = requestAnimationFrame(raf)

    return () => {
      cancelAnimationFrame(animId)
      lenis.destroy()
    }
  }, [reducedMotion])
}
