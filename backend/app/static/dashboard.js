const API_BASE = '/api/v1';

let currentScanResult = null;
let allThreats = [];

document.addEventListener('DOMContentLoaded', () => {
  setupTabs();
  checkHealth();
  loadDashboardSummary();
  loadBrandsList();
  loadThreatHistory();

  // Periodic telemetry refresh every 30 seconds
  setInterval(loadDashboardSummary, 30000);
});

// Tab Navigation
function setupTabs() {
  const btns = document.querySelectorAll('.nav-btn');
  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.getAttribute('data-tab');
      switchTab(tabId);
    });
  });
}

function switchTab(tabId) {
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));

  const activeBtn = document.querySelector(`.nav-btn[data-tab="${tabId}"]`);
  const activePane = document.getElementById(tabId);

  if (activeBtn) activeBtn.classList.add('active');
  if (activePane) activePane.classList.add('active');

  if (tabId === 'tab-threats') loadThreatHistory();
  if (tabId === 'tab-brands') loadBrandsList();
  if (tabId === 'tab-overview') loadDashboardSummary();
}

// Toast notification helper
function showToast(message) {
  const toast = document.getElementById('toastNotification');
  toast.textContent = message;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 4000);
}

// Health check
async function checkHealth() {
  try {
    const res = await fetch(`${API_BASE}/health`);
    const data = await res.json();
    const statusEl = document.getElementById('liveApiStatus');
    if (data.status === 'healthy') {
      statusEl.innerHTML = '<span class="status-dot"></span> API Connected';
      document.getElementById('healthDbStatus').textContent = data.database;
      document.getElementById('healthModelVersion').textContent = data.model_version;
    }
  } catch (err) {
    const statusEl = document.getElementById('liveApiStatus');
    statusEl.innerHTML = '<span class="status-dot" style="background: #ef4444; box-shadow: 0 0 8px #ef4444;"></span> API Disconnected';
  }
}

// Load Dashboard Overview & KPI Metrics
async function loadDashboardSummary() {
  try {
    const res = await fetch(`${API_BASE}/dashboard/summary`);
    const data = await res.json();

    document.getElementById('kpiTotalScans').textContent = data.total_submissions || 0;
    document.getElementById('kpiHighThreats').textContent = (data.high_risk_cases || 0) + (data.critical_risk_cases || 0);
    document.getElementById('kpiPendingReviews').textContent = data.pending_human_reviews || 0;
    document.getElementById('kpiMonitoredBrands').textContent = data.monitored_brands || 1;

    // Risk bars
    const dist = data.risk_distribution || {};
    const total = Math.max(1, data.total_submissions || 1);
    
    updateBar('Critical', dist.Critical || 0, total);
    updateBar('High', dist.High || 0, total);
    updateBar('Medium', dist.Medium || 0, total);
    updateBar('Low', dist.Low || 0, total);

    // Platform counts
    const pDist = data.platform_distribution || {};
    document.getElementById('plat-instagram').textContent = pDist.instagram || 0;
    document.getElementById('plat-x').textContent = (pDist.x || 0) + (pDist.twitter || 0);
    document.getElementById('plat-telegram').textContent = pDist.telegram || 0;
    document.getElementById('plat-website').textContent = pDist.website || 0;
    document.getElementById('plat-facebook').textContent = pDist.facebook || 0;

    // Recent detections table
    renderRecentDetections(data.recent_detections || []);
  } catch (err) {
    console.error('Failed to load dashboard summary:', err);
  }
}

function updateBar(tier, count, total) {
  const countEl = document.getElementById(`count${tier}`);
  const barEl = document.getElementById(`bar${tier}`);
  if (countEl) countEl.textContent = count;
  if (barEl) {
    const pct = Math.round((count / total) * 100);
    barEl.style.width = `${pct}%`;
  }
}

function renderRecentDetections(items) {
  const tbody = document.getElementById('recentDetectionsTable');
  if (!items || items.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">No detections recorded yet. Run a scan to initiate telemetry.</td></tr>';
    return;
  }

  tbody.innerHTML = items.map(item => `
    <tr>
      <td><strong>${escapeHtml(item.target)}</strong></td>
      <td><span class="badge">${escapeHtml(item.platform)}</span></td>
      <td>${escapeHtml(item.brand_name)}</td>
      <td><strong>${Math.round(item.risk_score)}</strong></td>
      <td><span class="risk-pill ${item.risk_category.toLowerCase()}">${item.risk_category}</span></td>
      <td class="text-muted text-sm">${new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
      <td>
        <button class="btn btn-secondary btn-sm" onclick="inspectScan('${item.id}')">View Report</button>
      </td>
    </tr>
  `).join('');
}

// Handle Scan Submission
async function handleScanSubmit(e) {
  e.preventDefault();

  const targetInput = document.getElementById('scanTarget').value.trim();
  const platform = document.getElementById('scanPlatform').value;
  const brandName = document.getElementById('scanBrand').value.trim();
  const displayName = document.getElementById('scanDisplayName').value.trim();
  const bio = document.getElementById('scanBio').value.trim();
  const notes = document.getElementById('scanNotes').value.trim();

  if (!targetInput) return;

  const btnText = document.getElementById('scanBtnText');
  const spinner = document.getElementById('scanSpinner');
  const submitBtn = document.getElementById('btnSubmitScan');

  btnText.textContent = 'Processing Multi-Signal Telemetry...';
  spinner.classList.remove('hidden');
  submitBtn.disabled = true;

  try {
    const isUrl = targetInput.startsWith('http://') || targetInput.startsWith('https://');
    const payload = {
      brand_name: brandName,
      platform: platform,
      target_url: isUrl ? targetInput : null,
      account_handle: !isUrl ? targetInput : null,
      display_name: displayName || null,
      profile_description: bio || null,
      additional_evidence: notes ? { analyst_notes: notes } : {},
      submission_source: 'dashboard'
    };

    const res = await fetch(`${API_BASE}/scans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Scan failed');
    }

    const data = await res.json();
    currentScanResult = data;
    renderScanResults(data);
    showToast('Investigation analysis complete.');
    loadDashboardSummary();
  } catch (err) {
    alert(`Scan error: ${err.message}`);
  } finally {
    btnText.textContent = 'Analyze Target with BrandGuard Engine';
    spinner.classList.add('hidden');
    submitBtn.disabled = false;
  }
}

// Render Results Panel
function renderScanResults(scan) {
  document.getElementById('resultsEmptyState').classList.add('hidden');
  document.getElementById('resultsContentState').classList.remove('hidden');

  const ra = scan.risk_assessment || { risk_score: 0, risk_category: 'Low', summary_reason: 'Safe' };
  
  document.getElementById('resScoreValue').textContent = Math.round(ra.risk_score);
  
  const pill = document.getElementById('resCategoryPill');
  pill.textContent = `${ra.risk_category.toUpperCase()} RISK`;
  pill.className = `risk-pill ${ra.risk_category.toLowerCase()}`;

  document.getElementById('resultStatusTag').textContent = `Assessed (${ra.model_version})`;
  document.getElementById('resSummaryTitle').textContent = `${ra.risk_category} Risk Threat Assessment`;
  document.getElementById('resSummaryDesc').textContent = ra.summary_reason;
  document.getElementById('resRuleScore').textContent = `${Math.round(ra.rule_score)}/100`;
  document.getElementById('resMlProb').textContent = ra.ml_score !== null ? `${ra.ml_score}%` : 'Rule Engine Deterministic';

  // Triggered Rules
  const rulesList = document.getElementById('resTriggeredRulesList');
  if (ra.triggered_rules && ra.triggered_rules.length > 0) {
    rulesList.innerHTML = ra.triggered_rules.map(r => `
      <div class="rule-item">
        <span class="risk-pill ${r.severity.toLowerCase()}">${r.severity}</span>
        <div>
          <strong>${escapeHtml(r.name)}</strong>
          <p class="text-muted text-sm">${escapeHtml(r.description)}</p>
        </div>
      </div>
    `).join('');
  } else {
    rulesList.innerHTML = '<div class="text-muted text-sm">No deterministic threat rules triggered. Target matches legitimate profile patterns.</div>';
  }

  // Evidence Items
  const evList = document.getElementById('resEvidenceItemsList');
  if (scan.evidence_items && scan.evidence_items.length > 0) {
    evList.innerHTML = scan.evidence_items.map(ei => `
      <div class="evidence-card">
        <strong>${escapeHtml(ei.title)}</strong> &bull; <span class="badge">${ei.signal_type}</span>
        <p class="text-muted text-sm mt-4">${escapeHtml(ei.description)}</p>
      </div>
    `).join('');
  } else {
    evList.innerHTML = '<div class="text-muted text-sm">No anomalous signal items detected.</div>';
  }

  // Recommended actions
  const actList = document.getElementById('resActionsList');
  if (ra.recommended_actions && ra.recommended_actions.length > 0) {
    actList.innerHTML = ra.recommended_actions.map(act => `<li>${escapeHtml(act)}</li>`).join('');
  } else {
    actList.innerHTML = '<li>Archive scan result. No action required.</li>';
  }
}

// Load Threat History
async function loadThreatHistory() {
  try {
    const res = await fetch(`${API_BASE}/scans?limit=50`);
    const data = await res.json();
    allThreats = data.items || [];
    renderThreatHistoryTable(allThreats);
  } catch (err) {
    console.error('Failed to load threats:', err);
  }
}

function filterThreats() {
  const query = document.getElementById('threatSearchInput').value.toLowerCase().trim();
  const platform = document.getElementById('threatPlatformFilter').value;
  const risk = document.getElementById('threatRiskFilter').value;

  const filtered = allThreats.filter(t => {
    const target = (t.account_handle || t.target_url || '').toLowerCase();
    const matchQuery = !query || target.includes(query);
    const matchPlat = !platform || t.platform === platform;
    const matchRisk = !risk || (t.risk_assessment && t.risk_assessment.risk_category === risk);
    return matchQuery && matchPlat && matchRisk;
  });

  renderThreatHistoryTable(filtered);
}

function renderThreatHistoryTable(items) {
  const tbody = document.getElementById('threatHistoryTable');
  if (!items || items.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted">No threat history matching filters.</td></tr>';
    return;
  }

  tbody.innerHTML = items.map(s => {
    const ra = s.risk_assessment || { risk_score: 0, risk_category: 'Low' };
    const target = s.account_handle || s.target_url || 'Unknown';
    return `
      <tr>
        <td><strong>${escapeHtml(target)}</strong></td>
        <td><span class="badge">${escapeHtml(s.platform)}</span></td>
        <td>${escapeHtml(s.brand_name || 'BrandGuard')}</td>
        <td><strong>${Math.round(ra.risk_score)}</strong></td>
        <td><span class="risk-pill ${ra.risk_category.toLowerCase()}">${ra.risk_category}</span></td>
        <td><span class="badge">${s.status}</span></td>
        <td class="text-muted text-sm">${new Date(s.created_at).toLocaleDateString()}</td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="inspectScan('${s.id}')">Inspect</button>
        </td>
      </tr>
    `;
  }).join('');
}

// Inspect specific scan
async function inspectScan(scanId) {
  try {
    const res = await fetch(`${API_BASE}/scans/${scanId}`);
    const data = await res.json();
    currentScanResult = data;
    switchTab('tab-scanner');
    renderScanResults(data);
  } catch (err) {
    alert(`Could not load scan: ${err.message}`);
  }
}

// Analyst Review & Feedback
async function submitAnalystReview(verdict) {
  if (!currentScanResult) return;
  const scanId = currentScanResult.id;
  try {
    // Demo admin auth token
    const res = await fetch(`${API_BASE}/scans/${scanId}/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        is_false_positive: verdict === 'false_positive',
        comment: `Analyst marked as ${verdict}`
      })
    });
    if (res.ok) {
      showToast(`Verdict '${verdict}' recorded successfully.`);
      loadDashboardSummary();
      loadThreatHistory();
    }
  } catch (err) {
    alert(`Failed to save review: ${err.message}`);
  }
}

function exportScanReport() {
  if (!currentScanResult) return;
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(currentScanResult, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `brandguard_intelligence_${currentScanResult.id}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

// Brand Registration
async function loadBrandsList() {
  try {
    const res = await fetch(`${API_BASE}/brands`);
    const brands = await res.json();
    const container = document.getElementById('brandsListContainer');

    if (!brands || brands.length === 0) {
      container.innerHTML = '<div class="text-muted text-sm">No registered brands found.</div>';
      return;
    }

    container.innerHTML = brands.map(b => `
      <div class="brand-asset-card">
        <div class="card-header" style="margin-bottom: 8px;">
          <h4>${escapeHtml(b.name)}</h4>
          <span class="badge badge-purple">${escapeHtml(b.category || 'general')}</span>
        </div>
        <p class="text-muted text-sm" style="margin-bottom: 12px;">${escapeHtml(b.description || 'Monitored brand identity')}</p>
        <div class="rules-list">
          ${(b.official_assets || []).map(a => `
            <div style="font-size: 12px; display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid rgba(255,255,255,0.03);">
              <span><strong>${escapeHtml(a.platform)}:</strong> ${escapeHtml(a.normalized_identifier)}</span>
              <span class="badge ${a.is_verified ? 'badge-green' : ''}">${a.is_verified ? 'Verified Anchor' : 'Pending Verification'}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error('Failed to load brands:', err);
  }
}

async function handleBrandRegister(e) {
  e.preventDefault();
  const name = document.getElementById('regBrandName').value.trim();
  const category = document.getElementById('regBrandCategory').value;
  const domain = document.getElementById('regOfficialDomain').value.trim();
  const handle = document.getElementById('regSocialHandle').value.trim();
  const desc = document.getElementById('regBrandDesc').value.trim();

  const initialAssets = [];
  if (domain) initialAssets.push({ platform: 'website', raw_identifier: domain });
  if (handle) initialAssets.push({ platform: 'x', raw_identifier: handle });

  try {
    const res = await fetch(`${API_BASE}/brands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name,
        category: category,
        description: desc,
        initial_assets: initialAssets
      })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Brand registration failed');
    }

    showToast(`Brand '${name}' registered successfully.`);
    document.getElementById('brandRegistrationForm').reset();
    loadBrandsList();
    loadDashboardSummary();
  } catch (err) {
    alert(`Registration failed: ${err.message}`);
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
