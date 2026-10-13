const API_BASE_URL = "http://localhost:8000/api/v1";

document.addEventListener("DOMContentLoaded", () => {
  const targetUrlInput = document.getElementById("targetUrl");
  const platformSelect = document.getElementById("platformSelect");
  const brandNameInput = document.getElementById("brandName");
  const evidenceNotesInput = document.getElementById("evidenceNotes");
  const btnUseCurrentTab = document.getElementById("btnUseCurrentTab");
  const btnSubmitScan = document.getElementById("btnSubmitScan");
  const btnText = document.getElementById("btnText");
  const spinner = document.getElementById("spinner");
  const apiStatus = document.getElementById("apiStatus");

  const formSection = document.getElementById("formSection");
  const resultSection = document.getElementById("resultSection");
  const riskPill = document.getElementById("riskPill");
  const riskScoreEl = document.getElementById("riskScore");
  const resultSummaryEl = document.getElementById("resultSummary");
  const evidenceListEl = document.getElementById("evidenceList");
  const viewReportLink = document.getElementById("viewReportLink");
  const btnReset = document.getElementById("btnReset");

  // Check Backend Health
  fetch(`${API_BASE_URL}/health`)
    .then(res => res.json())
    .then(data => {
      if (data.status === "healthy") {
        apiStatus.textContent = "Online";
        apiStatus.style.borderColor = "rgba(16, 185, 129, 0.4)";
      }
    })
    .catch(() => {
      apiStatus.textContent = "Offline (Local)";
      apiStatus.style.color = "#f87171";
      apiStatus.style.background = "rgba(239, 68, 68, 0.15)";
      apiStatus.style.borderColor = "rgba(239, 68, 68, 0.4)";
    });

  // Auto-detect active tab URL if running in Chrome Extension environment
  if (typeof chrome !== "undefined" && chrome.tabs && chrome.tabs.query) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs[0] && tabs[0].url) {
        populateTabUrl(tabs[0].url);
      }
    });

    btnUseCurrentTab.addEventListener("click", () => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs && tabs[0] && tabs[0].url) {
          populateTabUrl(tabs[0].url);
        }
      });
    });
  } else {
    btnUseCurrentTab.addEventListener("click", () => {
      targetUrlInput.value = window.location.href;
      detectPlatform(window.location.href);
    });
  }

  function populateTabUrl(url) {
    if (!url || url.startsWith("chrome://")) return;
    targetUrlInput.value = url;
    detectPlatform(url);
  }

  function detectPlatform(url) {
    const low = url.toLowerCase();
    if (low.includes("instagram.com")) {
      platformSelect.value = "instagram";
    } else if (low.includes("twitter.com") || low.includes("x.com")) {
      platformSelect.value = "x";
    } else if (low.includes("facebook.com")) {
      platformSelect.value = "facebook";
    } else if (low.includes("t.me")) {
      platformSelect.value = "telegram";
    } else {
      platformSelect.value = "website";
    }
  }

  // Submit scan
  btnSubmitScan.addEventListener("click", async () => {
    const targetUrl = targetUrlInput.value.trim();
    const platform = platformSelect.value;
    const brandName = brandNameInput.value.trim() || "BrandGuard";
    const notes = evidenceNotesInput.value.trim();

    if (!targetUrl) {
      alert("Please enter a target account or website URL.");
      return;
    }

    btnText.textContent = "Analyzing Signals...";
    spinner.classList.remove("hidden");
    btnSubmitScan.disabled = true;

    try {
      const response = await fetch(`${API_BASE_URL}/scans`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand_name: brandName,
          platform: platform,
          target_url: targetUrl,
          additional_evidence: { analyst_notes: notes },
          submission_source: "extension"
        })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || "Scan request failed");
      }

      const scanResult = await response.json();
      displayResult(scanResult);
    } catch (err) {
      alert(`Scan failed: ${err.message}. Is backend running on localhost:8000?`);
    } finally {
      btnText.textContent = "Analyze Target with AI";
      spinner.classList.add("hidden");
      btnSubmitScan.disabled = false;
    }
  });

  function displayResult(scan) {
    formSection.classList.add("hidden");
    resultSection.classList.remove("hidden");

    const ra = scan.risk_assessment || { risk_score: 0, risk_category: "Low", summary_reason: "Safe" };
    riskScoreEl.textContent = Math.round(ra.risk_score);

    riskPill.textContent = ra.risk_category;
    riskPill.className = `risk-pill ${ra.risk_category.toLowerCase()}`;

    resultSummaryEl.textContent = ra.summary_reason;

    evidenceListEl.innerHTML = "";
    if (ra.triggered_rules && ra.triggered_rules.length > 0) {
      ra.triggered_rules.forEach(rule => {
        const li = document.createElement("li");
        li.innerHTML = `<span>&bull;</span> <div><strong>${rule.name}</strong>: ${rule.description}</div>`;
        evidenceListEl.appendChild(li);
      });
    } else {
      const li = document.createElement("li");
      li.textContent = "No suspicious impersonation signals or homoglyphs triggered.";
      evidenceListEl.appendChild(li);
    }

    viewReportLink.href = `http://localhost:5173/dashboard?scan=${scan.id}`;
  }

  btnReset.addEventListener("click", () => {
    resultSection.classList.add("hidden");
    formSection.classList.remove("hidden");
    targetUrlInput.value = "";
    evidenceNotesInput.value = "";
  });
});
