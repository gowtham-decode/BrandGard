export type Platform =
  | 'Instagram'
  | 'Twitter'
  | 'Telegram'
  | 'Facebook'
  | 'LinkedIn'
  | 'Website'
  | 'App store'

export type RiskLevel = 'Official' | 'Low' | 'Medium' | 'High' | 'Unique'

export interface BrandRecord {
  id: string
  name: string
  officialIds: string[]
  domain: string
  phone: string
  email: string
  description: string
  createdAt: string
}

export interface MatchArea {
  handle: boolean
  displayName: boolean
  domain: boolean
  phone: boolean
  email: boolean
}

export interface SubChecks {
  contentMatch: {
    score: number // 0 to 100%
    summary: string
    details: string
  }
  contactMatch: {
    status: 'matched' | 'no match' | 'not provided'
    details: string
  }
}

export interface FiredSignal {
  id: string
  label: string
  evidence: string
  weight: number
}

export interface DetectionResult {
  verdict: RiskLevel
  matchedBrand?: BrandRecord
  matchPercentage: number // 0 to 100
  matchArea: MatchArea
  anomalyRange: 'Low' | 'Medium' | 'High' | 'None'
  subChecks: SubChecks
  firedSignals: FiredSignal[]
  brandsCheckedCount: number
  submittedUrl: string
  platform: Platform
  handleExtracted: string
  timestamp: string
  isOfficialRecord: boolean
}

export interface FlaggedPage {
  id: string
  platform: Platform
  handle: string
  url: string
  riskLevel: 'Low' | 'Medium' | 'High'
  matchPercentage: number
  brandImitated: string
  foundAt: string // "Just now", "2 hours ago", "Yesterday", etc.
  timestamp: number
  matchAreaSummary: string[]
}
