/**
 * Circular Reveal Theme Switcher using View Transitions API
 * Respects prefers-reduced-motion
 */
export function toggleThemeWithReveal(
  currentDark: boolean,
  setDark: (val: boolean) => void,
  event?: React.MouseEvent | MouseEvent
) {
  const isReduced =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const nextDark = !currentDark

  // Fallback for browsers without View Transitions or if reduced motion is requested
  if (
    typeof document === 'undefined' ||
    !('startViewTransition' in document) ||
    isReduced
  ) {
    setDark(nextDark)
    if (nextDark) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    return
  }

  // Get click coordinates for origin of circular reveal
  const x = event?.clientX ?? window.innerWidth / 2
  const y = event?.clientY ?? window.innerHeight / 2

  const endRadius = Math.hypot(
    Math.max(x, window.innerWidth - x),
    Math.max(y, window.innerHeight - y)
  )

  const doc = document as unknown as {
    startViewTransition?: (cb: () => void) => { ready: Promise<void> }
  }
  const transition = doc.startViewTransition?.(() => {
    setDark(nextDark)
    if (nextDark) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  })

  transition?.ready.then(() => {
    const clipPath = [
      `circle(0px at ${x}px ${y}px)`,
      `circle(${endRadius}px at ${x}px ${y}px)`,
    ]

    document.documentElement.animate(
      {
        clipPath: clipPath,
      },
      {
        duration: 700,
        easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
        pseudoElement: '::view-transition-new(root)',
      }
    )
  })
}
