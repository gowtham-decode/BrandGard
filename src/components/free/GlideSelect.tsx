import React, { useState, useRef, useEffect, useId } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Platform } from '@/data/types'
import { BRAND_EASE, SPRING_PILL, useReducedMotion } from '@/lib/motion'
import { Check, ChevronDown } from 'lucide-react'

export interface PlatformOption {
  value: Platform
  label: string
  tag: 'Social' | 'Messenger' | 'Professional' | 'Web' | 'Apps'
  iconText?: string
}

const PLATFORMS: PlatformOption[] = [
  { value: 'Instagram', label: 'Instagram', tag: 'Social' },
  { value: 'Twitter', label: 'Twitter / X', tag: 'Social' },
  { value: 'Telegram', label: 'Telegram', tag: 'Messenger' },
  { value: 'Facebook', label: 'Facebook', tag: 'Social' },
  { value: 'LinkedIn', label: 'LinkedIn', tag: 'Professional' },
  { value: 'Website', label: 'Website (Domain)', tag: 'Web' },
  { value: 'App store', label: 'App store listing', tag: 'Apps' },
]

interface GlideSelectProps {
  value: Platform
  onChange: (value: Platform) => void
  disabled?: boolean
  error?: string
}

export const GlideSelect: React.FC<GlideSelectProps> = ({
  value,
  onChange,
  disabled = false,
  error,
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(() =>
    PLATFORMS.findIndex((p) => p.value === value)
  )
  const containerRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const listId = useId()
  const reducedMotion = useReducedMotion()

  const selectedOption = PLATFORMS.find((p) => p.value === value) || PLATFORMS[0]

  useEffect(() => {
    const idx = PLATFORMS.findIndex((p) => p.value === value)
    if (idx !== -1) setHighlightedIndex(idx)
  }, [value])

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return

    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        setIsOpen(true)
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlightedIndex((prev) => (prev + 1) % PLATFORMS.length)
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightedIndex((prev) => (prev - 1 + PLATFORMS.length) % PLATFORMS.length)
        break
      case 'Enter':
      case ' ':
        e.preventDefault()
        if (PLATFORMS[highlightedIndex]) {
          onChange(PLATFORMS[highlightedIndex].value)
          setIsOpen(false)
          triggerRef.current?.focus()
        }
        break
      case 'Escape':
        e.preventDefault()
        setIsOpen(false)
        triggerRef.current?.focus()
        break
      case 'Tab':
        setIsOpen(false)
        break
    }
  }

  return (
    <div ref={containerRef} className="relative w-full" onKeyDown={handleKeyDown}>
      {/* Trigger Chip */}
      <button
        ref={triggerRef}
        type="button"
        id="platform-select-trigger"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listId}
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-input bg-panel border transition-colors text-left text-sm font-medium ${
          error
            ? 'border-bad ring-1 ring-bad/20'
            : isOpen
            ? 'border-primary ring-2 ring-primary/20'
            : 'border-line hover:border-muted/50'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <div className="flex items-center gap-2.5 truncate">
          <span className="font-semibold text-ink">{selectedOption.label}</span>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
            {selectedOption.tag}
          </span>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-muted transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
          aria-hidden="true"
        />
      </button>

      {/* Menu with gliding highlight pill */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={menuRef}
            id={listId}
            role="listbox"
            aria-activedescendant={`platform-opt-${highlightedIndex}`}
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.98 }}
            animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.2, ease: BRAND_EASE }}
            className="absolute z-50 left-0 right-0 mt-1.5 p-1.5 rounded-panel bg-panel border border-line shadow-xl max-h-72 overflow-y-auto focus:outline-none"
          >
            <div className="relative space-y-0.5">
              {PLATFORMS.map((platform, idx) => {
                const isSelected = platform.value === value
                const isHighlighted = idx === highlightedIndex

                return (
                  <div
                    key={platform.value}
                    id={`platform-opt-${idx}`}
                    role="option"
                    aria-selected={isSelected}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    onClick={() => {
                      onChange(platform.value)
                      setIsOpen(false)
                      triggerRef.current?.focus()
                    }}
                    className="relative flex items-center justify-between px-3 py-2 rounded-lg text-sm cursor-pointer select-none z-10 transition-colors"
                  >
                    {/* Gliding Pill Highlight */}
                    {isHighlighted && (
                      <motion.div
                        layoutId="glide-select-pill"
                        transition={reducedMotion ? { duration: 0 } : SPRING_PILL}
                        className="absolute inset-0 bg-primary/10 rounded-lg -z-10 border border-primary/15"
                      />
                    )}

                    <div className="flex items-center gap-2.5">
                      <span
                        className={`font-medium ${
                          isSelected ? 'text-primary font-semibold' : 'text-ink'
                        }`}
                      >
                        {platform.label}
                      </span>
                      <span className="text-[11px] px-1.5 py-0.5 rounded text-muted bg-bg border border-line">
                        {platform.tag}
                      </span>
                    </div>

                    {isSelected && (
                      <Check className="w-4 h-4 text-primary shrink-0 stroke-[2.5]" aria-hidden="true" />
                    )}
                  </div>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
