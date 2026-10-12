import { BrandRecord, DetectionResult, MatchArea, Platform, RiskLevel, FiredSignal, SubChecks } from './types'

/**
 * Normalise handles:
 * - lowercase
 * - remove punctuation
 * - swap lookalike characters (rn -> m, 0 -> o, 1 -> l)
 * - strip words such as official, support, help, care, team
 */
export function normalizeHandle(handle: string): string {
  let cleaned = handle.toLowerCase().trim()
  // Strip url parts if passed as full url
  cleaned = cleaned.replace(/^https?:\/\//, '').replace(/^www\./, '')
  // Extract pathname if still has domain
  const slashIdx = cleaned.indexOf('/')
  if (slashIdx !== -1) {
    const segments = cleaned.slice(slashIdx + 1).split('/').filter(Boolean)
    if (segments.length > 0) {
      cleaned = segments[0]
    }
  }
  // Strip query params
  cleaned = cleaned.split('?')[0].split('#')[0]

  // Remove leading @
  cleaned = cleaned.replace(/^@+/, '')

  // Swap look-alike characters
  cleaned = cleaned.replace(/rn/g, 'm')
  cleaned = cleaned.replace(/0/g, 'o')
  cleaned = cleaned.replace(/1/g, 'l')

  // Remove punctuation (underscores, dots, dashes)
  cleaned = cleaned.replace(/[._\-+]/g, '')

  // Strip scam/impersonation suffix/prefixes
  const stripWords = ['official', 'support', 'help', 'care', 'team', 'service', 'desk', 'secure', 'verify']
  for (const word of stripWords) {
    cleaned = cleaned.replaceAll(word, '')
  }

  return cleaned.trim()
}

/**
 * Levenshtein distance
 */
export function levenshteinDistance(a: string, b: string): number {
  const m = a.length
  const n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))

  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1]
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
      }
    }
  }

  return dp[m][n]
}

/**
 * Similarity ratio: 1 - distance / maxLen
 */
export function stringSimilarity(a: string, b: string): number {
  if (!a || !b) return 0
  if (a === b) return 1
  const maxLen = Math.max(a.length, b.length)
  if (maxLen === 0) return 1
  const dist = levenshteinDistance(a, b)
  return Math.max(0, 1 - dist / maxLen)
}

/**
 * Extract handle or domain from a profile URL
 */
export function extractHandleFromUrl(url: string, platform: Platform): string {
  try {
    let clean = url.trim()
    if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
      clean = 'https://' + clean
    }
    const parsed = new URL(clean)
    if (platform === 'Website') {
      return parsed.hostname.replace(/^www\./, '')
    }
    const pathParts = parsed.pathname.split('/').filter(Boolean)
    if (pathParts.length > 0) {
      return pathParts[pathParts.length - 1].replace(/^@/, '')
    }
    return parsed.hostname
  } catch {
    // If not a valid URL, treat raw input as handle/domain
    return url.replace(/^@/, '').trim()
  }
}

/**
 * Extract clean 10-digit phone
 */
export function cleanPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  return digits.length >= 10 ? digits.slice(-10) : digits
}

/**
 * Token set overlap for bio / display name
 */
export function tokenOverlapScore(text: string, referenceText: string): number {
  if (!text || !referenceText) return 0
  const stopWords = new Set(['the', 'and', 'for', 'with', 'our', 'this', 'that', 'from', 'you', 'are'])
  const toTokens = (str: string) =>
    str
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !stopWords.has(w))

  const tokensA = new Set(toTokens(text))
  const tokensB = new Set(toTokens(referenceText))

  if (tokensA.size === 0 || tokensB.size === 0) return 0

  let matches = 0
  for (const t of tokensA) {
    if (tokensB.has(t)) matches++
  }

  return matches / Math.max(tokensA.size, 1)
}

export interface AnalyseInput {
  url: string
  platform: Platform
  displayName?: string
  bio?: string
  phone?: string
  email?: string
}

/**
 * Core BrandGuard Detection Engine
 */
export function analyseAgainstDatabase(
  input: AnalyseInput,
  brands: BrandRecord[]
): DetectionResult {
  const extractedHandle = extractHandleFromUrl(input.url, input.platform)
  const normExtracted = normalizeHandle(extractedHandle)
  const rawHandleLower = extractedHandle.toLowerCase().replace(/[@/]/g, '').trim()
  const inputEmailLower = input.email?.trim().toLowerCase() || ''
  const inputPhone10 = input.phone ? cleanPhone(input.phone) : ''

  // 1. Check exact official record match
  for (const brand of brands) {
    const isOfficialHandle = brand.officialIds.some(
      (id) => id.toLowerCase() === rawHandleLower
    )
    const isOfficialEmail = Boolean(
      inputEmailLower && brand.email.toLowerCase() === inputEmailLower
    )
    const isOfficialPhone = Boolean(
      inputPhone10 && cleanPhone(brand.phone) === inputPhone10
    )
    const isOfficialDomain = Boolean(
      input.platform === 'Website' &&
        extractedHandle.toLowerCase() === brand.domain.toLowerCase()
    )

    if (isOfficialHandle || isOfficialDomain || (isOfficialEmail && isOfficialPhone)) {
      return {
        verdict: 'Official',
        matchedBrand: brand,
        matchPercentage: 100,
        matchArea: {
          handle: isOfficialHandle || isOfficialDomain,
          displayName: true,
          domain: isOfficialDomain,
          phone: isOfficialPhone,
          email: isOfficialEmail,
        },
        anomalyRange: 'None',
        subChecks: {
          contentMatch: {
            score: 100,
            summary: 'Verified Authority',
            details: 'Exact match with certified brand registry records.',
          },
          contactMatch: {
            status: isOfficialEmail || isOfficialPhone ? 'matched' : 'not provided',
            details: 'Primary credentials belong to authorized brand entity.',
          },
        },
        firedSignals: [
          {
            id: 'sig-official',
            label: 'Certified Official Entity Record',
            evidence: `Handle and credentials match official ${brand.name} registration database exactly.`,
            weight: 1.0,
          },
        ],
        brandsCheckedCount: brands.length,
        submittedUrl: input.url,
        platform: input.platform,
        handleExtracted: extractedHandle,
        timestamp: new Date().toISOString(),
        isOfficialRecord: true,
      }
    }
  }

  // 2. Evaluate risk across brands
  let bestBrand: BrandRecord | null = null
  let highestScore = 0
  let bestDetails: {
    matchArea: MatchArea
    firedSignals: FiredSignal[]
    subChecks: SubChecks
    isNameOnly: boolean
  } | null = null

  for (const brand of brands) {
    const brandNameNorm = normalizeHandle(brand.name)
    let bestIdSim = 0

    // Compare with brand official IDs
    for (const offId of brand.officialIds) {
      const normOff = normalizeHandle(offId)
      // Check contained or edit distance
      if (normExtracted.includes(normOff) || normOff.includes(normExtracted)) {
        bestIdSim = Math.max(bestIdSim, 0.92)
      } else {
        const sim = stringSimilarity(normExtracted, normOff)
        bestIdSim = Math.max(bestIdSim, sim)
      }
    }

    // Compare with brand name
    let nameSim = 0
    if (normExtracted.includes(brandNameNorm) || brandNameNorm.includes(normExtracted)) {
      nameSim = 0.94
    } else {
      nameSim = stringSimilarity(normExtracted, brandNameNorm)
    }

    // Display name similarity
    let dispSim = 0
    if (input.displayName) {
      const normDisp = normalizeHandle(input.displayName)
      if (normDisp.includes(brandNameNorm)) {
        dispSim = 0.95
      } else {
        dispSim = stringSimilarity(normDisp, brandNameNorm)
      }
    }

    // Lookalike link / domain
    let domainSim = 0
    if (input.platform === 'Website') {
      const normDomain = extractedHandle.toLowerCase().replace(/^www\./, '')
      if (normDomain === brand.domain.toLowerCase()) {
        domainSim = 1.0
      } else if (normDomain.includes(brand.domain.split('.')[0])) {
        domainSim = 0.85
      } else {
        domainSim = stringSimilarity(normDomain, brand.domain.toLowerCase())
      }
    } else {
      // Lookalike handle link similarity
      domainSim = Math.max(bestIdSim, nameSim)
    }

    // Bio / Content overlap
    let bioOverlap = 0
    if (input.bio || input.displayName) {
      const combined = `${input.displayName || ''} ${input.bio || ''}`
      bioOverlap = tokenOverlapScore(combined, `${brand.name} ${brand.description}`)
    }

    // Contact match check
    let phoneMatched = false
    let emailMatched = false
    if (inputPhone10) {
      phoneMatched = cleanPhone(brand.phone) === inputPhone10
    }
    if (inputEmailLower) {
      emailMatched = brand.email.toLowerCase() === inputEmailLower
    }

    // Weighted scoring according to specifications:
    // name 0.30, logo 0.25 (omitted in frontend scope), lookalike link 0.20, bio 0.10, account metadata 0.10, scam-report overlap 0.05
    // Normalized to 100%:
    // Name/handle: 0.40, DisplayName: 0.25, Link: 0.20, Bio: 0.15
    const handleScore = Math.max(bestIdSim, nameSim)
    let score = handleScore * 0.45 + dispSim * 0.25 + domainSim * 0.15 + bioOverlap * 0.15

    // Add bonus if scam words like "support", "help", "care" were stripped from handle
    const hasScamKeywords = /support|help|official|care|team|service|desk|verify/i.test(extractedHandle)
    if (hasScamKeywords && handleScore > 0.6) {
      score = Math.min(1.0, score + 0.15)
    }

    const percentage = Math.round(score * 100)

    if (percentage > highestScore) {
      highestScore = percentage
      bestBrand = brand

      const matchArea: MatchArea = {
        handle: handleScore >= 0.65,
        displayName: dispSim >= 0.65,
        domain: domainSim >= 0.7 && input.platform === 'Website',
        phone: phoneMatched,
        email: emailMatched,
      }

      const firedSignals: FiredSignal[] = []
      if (matchArea.handle) {
        firedSignals.push({
          id: 'sig-handle',
          label: 'Lookalike Handle Pattern',
          evidence: `Extracted handle "@${extractedHandle}" normalized to match brand anchor "${brand.name}".`,
          weight: 0.4,
        })
      }
      if (hasScamKeywords) {
        firedSignals.push({
          id: 'sig-keywords',
          label: 'High-Risk Keyword Insertion',
          evidence: `Contains urgent/support keywords common in fake customer-care impersonation.`,
          weight: 0.2,
        })
      }
      if (matchArea.displayName) {
        firedSignals.push({
          id: 'sig-disp',
          label: 'Display Name Replication',
          evidence: `Display name mimics registered trademark of "${brand.name}".`,
          weight: 0.25,
        })
      }
      if (bioOverlap > 0.3) {
        firedSignals.push({
          id: 'sig-bio',
          label: 'Brand Description Semantic Overlap',
          evidence: `Bio text contains semantic overlap (${Math.round(bioOverlap * 100)}%) with official corporate profile.`,
          weight: 0.15,
        })
      }
      if (inputPhone10 && !phoneMatched) {
        firedSignals.push({
          id: 'sig-phone-mismatch',
          label: 'Unregistered Contact Channel',
          evidence: `Contact number does not match registered brand authorization telephone records.`,
          weight: 0.1,
        })
      }

      // Check sub-checks
      const contentScore = Math.round(Math.max(dispSim, bioOverlap) * 100)
      const subChecks: SubChecks = {
        contentMatch: {
          score: contentScore,
          summary: contentScore > 60 ? 'High text similarity' : contentScore > 30 ? 'Moderate resemblance' : 'Low similarity',
          details: `Bio and display name overlap scored ${contentScore}%.`,
        },
        contactMatch: {
          status:
            phoneMatched || emailMatched
              ? 'matched'
              : input.phone || input.email
              ? 'no match'
              : 'not provided',
          details:
            phoneMatched || emailMatched
              ? 'Matched official contact data.'
              : input.phone || input.email
              ? 'Provided contact points differ from brand records.'
              : 'No profile email or telephone provided for verification.',
        },
      }

      const isNameOnly = (matchArea.handle || matchArea.displayName) && !hasScamKeywords && bioOverlap < 0.2 && !input.phone && !input.email

      bestDetails = {
        matchArea,
        firedSignals,
        subChecks,
        isNameOnly,
      }
    }
  }

  // Bands: under 35% Low, 35 to 60% Medium, above 60% High.
  // Rule: "A name-only match caps at Medium."
  // If highestScore < 30% -> Unique (No match found)
  if (!bestBrand || highestScore < 30 || !bestDetails) {
    return {
      verdict: 'Unique',
      matchPercentage: 0,
      matchArea: { handle: false, displayName: false, domain: false, phone: false, email: false },
      anomalyRange: 'None',
      subChecks: {
        contentMatch: {
          score: 0,
          summary: 'No brand overlap detected',
          details: 'Neither name nor content match registered brand assets.',
        },
        contactMatch: {
          status: 'not provided',
          details: 'No conflicting brand credentials identified.',
        },
      },
      firedSignals: [],
      brandsCheckedCount: brands.length,
      submittedUrl: input.url,
      platform: input.platform,
      handleExtracted: extractedHandle,
      timestamp: new Date().toISOString(),
      isOfficialRecord: false,
    }
  }

  let anomalyRange: 'Low' | 'Medium' | 'High' = 'Low'
  if (highestScore >= 60) {
    anomalyRange = 'High'
  } else if (highestScore >= 35) {
    anomalyRange = 'Medium'
  } else {
    anomalyRange = 'Low'
  }

  // Enforce rule: A name-only match caps at Medium
  if (bestDetails.isNameOnly && anomalyRange === 'High') {
    anomalyRange = 'Medium'
    highestScore = Math.min(58, highestScore)
    bestDetails.firedSignals.push({
      id: 'sig-capped',
      label: 'Score Capped at Medium',
      evidence: 'Name match alone cannot prove impersonation without secondary signals.',
      weight: 0,
    })
  }

  return {
    verdict: anomalyRange,
    matchedBrand: bestBrand,
    matchPercentage: highestScore,
    matchArea: bestDetails.matchArea,
    anomalyRange,
    subChecks: bestDetails.subChecks,
    firedSignals: bestDetails.firedSignals,
    brandsCheckedCount: brands.length,
    submittedUrl: input.url,
    platform: input.platform,
    handleExtracted: extractedHandle,
    timestamp: new Date().toISOString(),
    isOfficialRecord: false,
  }
}
