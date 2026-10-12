import React, { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { BrandRecord } from '@/data/types'
import { BRAND_EASE, getEntranceVariants, useReducedMotion } from '@/lib/motion'
import {
  Building,
  Plus,
  Trash2,
  Globe,
  AtSign,
  Phone,
  Mail,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react'

interface BrandDatabaseViewProps {
  brands: BrandRecord[]
  onAddBrand: (brand: BrandRecord) => void
  onRemoveBrand: (id: string) => void
}

export const BrandDatabaseView: React.FC<BrandDatabaseViewProps> = ({
  brands,
  onAddBrand,
  onRemoveBrand,
}) => {
  const [isRegistering, setIsRegistering] = useState(false)
  const [name, setName] = useState('')
  const [officialIdsText, setOfficialIdsText] = useState('')
  const [domain, setDomain] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [description, setDescription] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [successNotice, setSuccessNotice] = useState('')

  const reducedMotion = useReducedMotion()

  const handleSaveBrand = (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')

    if (!name.trim()) {
      setErrorMsg('Brand name is required.')
      return
    }
    if (!officialIdsText.trim()) {
      setErrorMsg('Please specify at least one official handle / ID (comma separated).')
      return
    }
    if (!domain.trim()) {
      setErrorMsg('Official domain is required (e.g. example.com).')
      return
    }

    const officialIds = officialIdsText
      .split(',')
      .map((id) => id.trim().replace(/^@/, ''))
      .filter(Boolean)

    const newBrand: BrandRecord = {
      id: `brand-${Date.now()}`,
      name: name.trim(),
      officialIds,
      domain: domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, ''),
      phone: phone.trim(),
      email: email.trim().toLowerCase(),
      description: description.trim(),
      createdAt: new Date().toISOString(),
    }

    onAddBrand(newBrand)
    setName('')
    setOfficialIdsText('')
    setDomain('')
    setPhone('')
    setEmail('')
    setDescription('')
    setIsRegistering(false)
    setSuccessNotice(`Successfully registered ${newBrand.name} into BrandGuard registry.`)
    setTimeout(() => setSuccessNotice(''), 4000)
  }

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="pb-2 border-b border-line flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-ink">
            Registered brand database
          </h1>
          <p className="text-sm text-muted mt-1">
            Authoritative registry used to detect lookalike handles, counterfeit domains, and impersonators.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsRegistering((prev) => !prev)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-button bg-primary hover:bg-primary-hover text-white text-xs font-semibold shadow-sm transition-colors self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>{isRegistering ? 'Cancel' : 'Register a brand'}</span>
        </button>
      </div>

      {successNotice && (
        <div className="p-3.5 rounded-button bg-ok/10 border border-ok/30 text-ok text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successNotice}</span>
        </div>
      )}

      {/* "Register a brand" Form */}
      <AnimatePresence>
        {isRegistering && (
          <motion.div
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
            animate={reducedMotion ? { opacity: 1 } : { opacity: 1, height: 'auto' }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: BRAND_EASE }}
            className="p-5 sm:p-6 rounded-panel bg-panel border border-line shadow-sm overflow-hidden"
          >
            <div className="flex items-center justify-between pb-3 border-b border-line mb-4">
              <h2 className="text-base font-bold text-ink">
                Register a new brand identity
              </h2>
              <span className="text-xs text-muted">
                Seeds protection baseline
              </span>
            </div>

            {errorMsg && (
              <div className="mb-4 p-3 rounded-button bg-bad/10 border border-bad/30 text-bad text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSaveBrand} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">
                    Brand name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Acme Bank"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-input bg-bg border border-line text-xs text-ink placeholder:text-muted focus:border-primary transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">
                    Official IDs / handles (comma-separated) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. acmebank, acmebank_official, acme_care"
                    value={officialIdsText}
                    onChange={(e) => setOfficialIdsText(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-input bg-bg border border-line text-xs text-ink placeholder:text-muted focus:border-primary transition-colors font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">
                    Official domain *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. acmebank.com"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-input bg-bg border border-line text-xs text-ink placeholder:text-muted focus:border-primary transition-colors font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">
                    Authorized phone (optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. +1 800 555 0199"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-input bg-bg border border-line text-xs text-ink placeholder:text-muted focus:border-primary transition-colors font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">
                    Authorized email (optional)
                  </label>
                  <input
                    type="email"
                    placeholder="e.g. support@acmebank.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-input bg-bg border border-line text-xs text-ink placeholder:text-muted focus:border-primary transition-colors font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink mb-1">
                  Brand description & core services
                </label>
                <textarea
                  rows={2}
                  placeholder="Summarize business scope to power content & bio text semantic matching..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-input bg-bg border border-line text-xs text-ink placeholder:text-muted focus:border-primary transition-colors"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsRegistering(false)}
                  className="px-4 py-2 rounded-button bg-bg hover:bg-line/40 text-ink text-xs font-semibold border border-line transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-button bg-primary hover:bg-primary-hover text-white text-xs font-semibold shadow-sm transition-colors"
                >
                  Save brand
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Brands List */}
      <div className="space-y-4">
        {brands.map((brand) => (
          <motion.div
            key={brand.id}
            variants={getEntranceVariants(reducedMotion)}
            initial="hidden"
            animate="visible"
            className="p-5 sm:p-6 rounded-panel bg-panel border border-line shadow-sm hover:border-muted/50 transition-colors flex flex-col md:flex-row md:items-start justify-between gap-5"
          >
            <div className="space-y-3 flex-1">
              {/* Brand Header */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold shrink-0">
                  <Building className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-ink flex items-center gap-2">
                    <span>{brand.name}</span>
                    <span className="text-[10px] font-bold text-ok bg-ok/10 px-2 py-0.5 rounded-full border border-ok/20">
                      Active
                    </span>
                  </h3>
                  <a
                    href={`https://${brand.domain}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-muted hover:text-primary flex items-center gap-1 font-mono transition-colors"
                  >
                    <Globe className="w-3.5 h-3.5" />
                    <span>{brand.domain}</span>
                  </a>
                </div>
              </div>

              <p className="text-xs text-muted leading-relaxed max-w-2xl">
                {brand.description}
              </p>

              {/* Official IDs Badges */}
              <div className="space-y-1 pt-1">
                <span className="text-[11px] font-semibold text-muted uppercase tracking-wider block">
                  Official IDs / Handles
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {brand.officialIds.map((id) => (
                    <span
                      key={id}
                      className="inline-flex items-center gap-1 text-xs font-mono font-medium px-2.5 py-1 rounded-md bg-bg border border-line text-ink"
                    >
                      <AtSign className="w-3 h-3 text-muted" />
                      {id}
                    </span>
                  ))}
                </div>
              </div>

              {/* Contact Credentials */}
              <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-muted pt-2 border-t border-line/60">
                {brand.phone && (
                  <span className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-muted" />
                    {brand.phone}
                  </span>
                )}
                {brand.email && (
                  <span className="flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-muted" />
                    {brand.email}
                  </span>
                )}
              </div>
            </div>

            {/* Remove Action */}
            <div className="self-end md:self-start">
              <button
                type="button"
                onClick={() => onRemoveBrand(brand.id)}
                title={`Remove ${brand.name}`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-button bg-bg hover:bg-bad/10 text-muted hover:text-bad border border-line hover:border-bad/30 text-xs font-semibold transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Remove</span>
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
