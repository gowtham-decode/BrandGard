import { useEffect, useMemo, useState } from "react";
import ArrowUpRight from "lucide-react/dist/esm/icons/arrow-up-right.js";
import Building2 from "lucide-react/dist/esm/icons/building-2.js";
import Check from "lucide-react/dist/esm/icons/check.js";
import CircleAlert from "lucide-react/dist/esm/icons/circle-alert.js";
import Globe2 from "lucide-react/dist/esm/icons/globe-2.js";
import History from "lucide-react/dist/esm/icons/history.js";
import LoaderCircle from "lucide-react/dist/esm/icons/loader-circle.js";
import LogOut from "lucide-react/dist/esm/icons/log-out.js";
import Plus from "lucide-react/dist/esm/icons/plus.js";
import Radio from "lucide-react/dist/esm/icons/radio.js";
import Search from "lucide-react/dist/esm/icons/search.js";
import Shield from "lucide-react/dist/esm/icons/shield.js";
import ShieldCheck from "lucide-react/dist/esm/icons/shield-check.js";
import {
  ApiError,
  api,
  platformLabels,
  type AuthResponse,
  type AppStoreListing,
  type Brand,
  type Scan,
  type User,
} from "@/lib/brandguard-api";
import "./brandguard.css";

type Section = "overview" | "brands" | "social" | "apps" | "results";
type AuthMode = "login" | "register";

const navigation: Array<{ id: Section; label: string; icon: typeof Search }> = [
  { id: "overview", label: "Overview", icon: Building2 },
  { id: "brands", label: "Brand profile", icon: ShieldCheck },
  { id: "social", label: "Social monitoring", icon: Radio },
  { id: "apps", label: "App monitoring", icon: Globe2 },
  { id: "results", label: "Analysis & history", icon: History },
];

function savedToken() {
  return typeof window === "undefined" ? "" : window.localStorage.getItem("brandguard.access_token") ?? "";
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown date" : date.toLocaleString();
}

function riskClass(category: string) {
  return category.toLowerCase().replace(/[^a-z]/g, "");
}

export function BrandGuardApp() {
  const [token, setToken] = useState("");
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [scans, setScans] = useState<Scan[]>([]);
  const [scanTotal, setScanTotal] = useState(0);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [section, setSection] = useState<Section>("overview");
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [pageError, setPageError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setToken(savedToken());
    setAuthReady(true);
  }, []);

  useEffect(() => {
    if (!authReady) return;
    if (!token) {
      setLoading(false);
      setHistoryLoading(false);
      setUser(null);
      setBrands([]);
      setScans([]);
      setScanTotal(0);
      setHistoryLoaded(false);
      return;
    }

    let active = true;
    setLoading(true);
    setHistoryLoading(true);
    setPageError("");
    const handleLoadError = (error: unknown) => {
      if (!active) return;
      if (error instanceof ApiError && error.status === 401) {
        window.localStorage.removeItem("brandguard.access_token");
        setToken("");
        setPageError("Your session expired. Sign in again.");
      } else {
        setPageError(error instanceof Error ? error.message : "Unable to load your workspace.");
      }
    };

    api<{ total: number; items: Scan[] }>("/scans?limit=10", { token })
      .then((scanHistory) => {
        if (!active) return;
        setScans(scanHistory.items);
        setScanTotal(scanHistory.total);
        setHistoryLoaded(scanHistory.total <= scanHistory.items.length);
      })
      .catch(handleLoadError)
      .finally(() => {
        if (!active) return;
        setHistoryLoading(false);
      });

    Promise.all([api<User>("/auth/me", { token }), api<Brand[]>("/brands", { token })])
      .then(([currentUser, ownedBrands]) => {
        if (!active) return;
        setUser(currentUser);
        setBrands(ownedBrands);
      })
      .catch(handleLoadError)
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [authReady, token]);

  async function authenticate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthError("");
    setAuthBusy(true);
    const form = new FormData(event.currentTarget);
    const body = {
      email: String(form.get("email") ?? "").trim(),
      password: String(form.get("password") ?? ""),
      ...(authMode === "register"
        ? {
            full_name: String(form.get("full_name") ?? "").trim() || undefined,
            organization_name: String(form.get("organization_name") ?? "").trim() || undefined,
          }
        : {}),
    };
    try {
      const session = await api<AuthResponse>(
        authMode === "register" ? "/auth/register" : "/auth/login",
        { body },
      );
      window.localStorage.setItem("brandguard.access_token", session.access_token);
      setToken(session.access_token);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Unable to sign in.");
    } finally {
      setAuthBusy(false);
    }
  }

  function signOut() {
    window.localStorage.removeItem("brandguard.access_token");
    setToken("");
    setUser(null);
    setSection("overview");
  }

  async function reloadWorkspace() {
    if (!token) return;
    const [ownedBrands, scanHistory] = await Promise.all([
      api<Brand[]>("/brands", { token }),
      api<{ total: number; items: Scan[] }>("/scans?limit=100", { token }),
    ]);
    setBrands(ownedBrands);
    setScans(scanHistory.items);
    setScanTotal(scanHistory.total);
    setHistoryLoaded(true);
  }

  async function openSection(nextSection: Section) {
    setSection(nextSection);
    setPageError("");
    if (nextSection !== "results" || historyLoaded || historyLoading || !token) return;

    setHistoryLoading(true);
    try {
      const scanHistory = await api<{ total: number; items: Scan[] }>("/scans?limit=100", { token });
      setScans(scanHistory.items);
      setScanTotal(scanHistory.total);
      setHistoryLoaded(true);
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Unable to load scan history.");
    } finally {
      setHistoryLoading(false);
    }
  }

  if (!authReady) {
    return <div className="bg-loading"><LoaderCircle className="bg-spinner" /> Loading your workspace…</div>;
  }

  if (!token) {
    return (
      <AuthScreen
        mode={authMode}
        busy={authBusy}
        error={authError}
        onModeChange={(mode) => {
          setAuthMode(mode);
          setAuthError("");
        }}
        onSubmit={authenticate}
      />
    );
  }

  if (loading && !user) {
    return <div className="bg-loading"><LoaderCircle className="bg-spinner" /> Loading your workspace…</div>;
  }

  const activeBrand = brands[0] ?? null;
  const verifiedCount = brands.reduce(
    (count, brand) => count + brand.official_assets.filter((asset) => asset.is_verified).length,
    0,
  );
  const highRiskCount = scans.filter((scan) =>
    ["high", "critical"].includes(scan.risk_assessment?.risk_category.toLowerCase() ?? ""),
  ).length;

  return (
    <div className="bg-shell">
      <aside className="bg-sidebar">
        <a className="bg-brand" href="/" aria-label="BrandGuard home">
          <span className="bg-brand-mark"><Shield size={21} /></span>
          <span>BrandGuard<span className="bg-brand-dot">.</span></span>
        </a>
        <div className="bg-side-label">WORKSPACE</div>
        <nav className="bg-nav" aria-label="Workspace navigation">
          {navigation.map(({ id, label, icon: Icon }) => (
            <button
              className={section === id ? "bg-nav-item active" : "bg-nav-item"}
              key={id}
              onClick={() => void openSection(id)}
            >
              <Icon size={17} />{label}
              {id === "results" && scanTotal > 0 && <span className="bg-nav-count">{scanTotal}</span>}
            </button>
          ))}
        </nav>
        <div className="bg-sidebar-bottom">
          <span className="bg-status-dot" /> Analyst workspace
          <span className="bg-user-email">{user?.email}</span>
        </div>
      </aside>

      <main className="bg-main">
        <header className="bg-topbar">
          <div><span className="bg-topbar-kicker">DIGITAL RISK PROTECTION</span><strong>{navigation.find((item) => item.id === section)?.label}</strong></div>
          <div className="bg-topbar-user">
            <span className="bg-avatar">{(user?.full_name || user?.email || "A").slice(0, 1).toUpperCase()}</span>
            {user?.full_name || user?.email}
            <button className="bg-topbar-signout" type="button" onClick={signOut}>
              <LogOut size={15} /> Sign out
            </button>
          </div>
        </header>

        <div className="bg-content">
          {pageError && <div className="bg-alert" role="alert"><CircleAlert size={17} />{pageError}<button onClick={() => setPageError("")}>Dismiss</button></div>}
          {section === "overview" && (
            <Overview
              brand={activeBrand}
              brandCount={brands.length}
              verifiedCount={verifiedCount}
              scans={scans.slice(0, 10)}
              scanTotal={scanTotal}
              highRiskCount={highRiskCount}
              historyLoading={historyLoading}
              onNavigate={(nextSection) => void openSection(nextSection)}
            />
          )}
          {section === "brands" && (
            <BrandsSection
              brands={brands}
              token={token}
              onChanged={reloadWorkspace}
              onError={(message) => setPageError(message)}
            />
          )}
          {(section === "social" || section === "apps") && (
            <MonitoringSection
              mode={section}
              brands={brands}
              token={token}
              onScanned={async (scan) => {
                setScans((items) => [scan, ...items].slice(0, historyLoaded ? 100 : 10));
                setScanTotal((total) => total + 1);
                await openSection("results");
              }}
            />
          )}
          {section === "results" && (
            <ResultsSection
              scans={scans}
              token={token}
              loading={historyLoading}
              onReviewed={async () => {
                await reloadWorkspace();
              }}
            />
          )}
        </div>
      </main>
    </div>
  );
}

function AuthScreen({
  mode,
  busy,
  error,
  onModeChange,
  onSubmit,
}: {
  mode: AuthMode;
  busy: boolean;
  error: string;
  onModeChange: (mode: AuthMode) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <main className="bg-auth">
      <section className="bg-auth-card">
        <a className="bg-brand bg-auth-brand" href="/"><span className="bg-brand-mark"><Shield size={21} /></span><span>BrandGuard<span className="bg-brand-dot">.</span></span></a>
        <p className="bg-auth-eyebrow">BRAND IMPERSONATION DEFENSE</p>
        <h1>{mode === "login" ? "Welcome back." : "Protect your brand."}</h1>
        <p className="bg-auth-copy">{mode === "login" ? "Sign in to inspect submitted social and app listings, with evidence-backed risk analysis." : "Create a workspace to register trusted assets and review suspicious listings."}</p>
        <form className="bg-form" onSubmit={onSubmit}>
          {mode === "register" && <>
            <label htmlFor="full_name">Your name</label>
            <input id="full_name" name="full_name" autoComplete="name" maxLength={255} placeholder="Security analyst" />
            <label htmlFor="organization_name">Organization</label>
            <input id="organization_name" name="organization_name" autoComplete="organization" maxLength={255} placeholder="Company name" />
          </>}
          <label htmlFor="bg-email">Email address</label>
          <input id="bg-email" type="email" name="email" autoComplete="email" required maxLength={255} placeholder="you@company.com" />
          <label htmlFor="bg-password">Password</label>
          <input id="bg-password" type="password" name="password" autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={mode === "register" ? 8 : 1} maxLength={128} placeholder={mode === "register" ? "At least 8 characters" : "Your password"} />
          {error && <p className="bg-form-error" role="alert">{error}</p>}
          <button className="bg-primary-button" type="submit" disabled={busy}>{busy && <LoaderCircle className="bg-spinner" />}{mode === "login" ? "Sign in" : "Create account"}<ArrowUpRight size={16} /></button>
        </form>
        <p className="bg-auth-switch">{mode === "login" ? "New to BrandGuard?" : "Already registered?"}{" "}
          <button onClick={() => onModeChange(mode === "login" ? "register" : "login")}>{mode === "login" ? "Create an account" : "Sign in"}</button>
        </p>
        <div className="bg-auth-foot"><ShieldCheck size={15} /> Your data is stored in your BrandGuard workspace.</div>
      </section>
      <aside className="bg-auth-aside">
        <div className="bg-aside-orb">BG</div>
        <span className="bg-aside-label">BRANDGUARD ANALYST WORKSPACE</span>
        <h2>Know what is real.<br /><em>Protect what you built.</em></h2>
        <p>Register official brand assets, inspect submitted look-alikes, and preserve every assessment with its supporting evidence.</p>
        <div className="bg-aside-points"><span><Check size={15} /> Verified assets are excluded from false flags</span><span><Check size={15} /> Explainable rule-based analysis</span><span><Check size={15} /> Persistent scan history and analyst reviews</span></div>
      </aside>
    </main>
  );
}

function Overview({
  brand,
  brandCount,
  verifiedCount,
  scans,
  scanTotal,
  highRiskCount,
  historyLoading,
  onNavigate,
}: {
  brand: Brand | null;
  brandCount: number;
  verifiedCount: number;
  scans: Scan[];
  scanTotal: number;
  highRiskCount: number;
  historyLoading: boolean;
  onNavigate: (section: Section) => void;
}) {
  const recentScans = scans.slice(0, 5);
  return (
    <section className="bg-page">
      <div className="bg-page-heading"><div><p className="bg-eyebrow">YOUR SECURITY OVERVIEW</p><h1>{brand ? `Protecting ${brand.name}.` : "Start with your brand."}</h1><p className="bg-muted">Run evidence-based checks on suspicious social profiles and app listings.</p></div>
        <button className="bg-primary-button compact" onClick={() => onNavigate(brand ? "social" : "brands")}><Plus size={16} />{brand ? "New analysis" : "Register a brand"}</button>
      </div>
      <div className="bg-stat-grid">
        <Stat label="Registered brands" value={brandCount} icon={<Building2 />} />
        <Stat label="Verified assets" value={verifiedCount} icon={<ShieldCheck />} />
        <Stat label="Analyses saved" value={historyLoading ? "…" : scanTotal} icon={<History />} />
        <Stat label="High / critical (latest 10)" value={historyLoading ? "…" : highRiskCount} icon={<CircleAlert />} />
      </div>
      <div className="bg-grid-two">
        <section className="bg-panel">
          <div className="bg-panel-heading"><div><p className="bg-eyebrow">REGISTERED PROFILE</p><h2>{brand?.name ?? "No brand yet"}</h2></div>
            <button className="bg-text-button" onClick={() => onNavigate("brands")}>{brand ? "Manage profile" : "Get started"} <ArrowUpRight size={15} /></button>
          </div>
          {brand ? <div className="bg-brand-summary">
            <BrandLogo brand={brand} />
            <div><strong>{brand.name}</strong><span>{brand.description || "Add a description to your brand profile."}</span><small>{brand.official_assets.length} official assets · {brand.official_assets.filter((asset) => asset.is_verified).length} verified</small></div>
          </div> : <p className="bg-empty">Create a brand profile and add only the official accounts and app listings you have checked.</p>}
          <div className="bg-quick-actions"><button onClick={() => onNavigate("social")}><Radio /> Check a social profile <ArrowUpRight /></button><button onClick={() => onNavigate("apps")}><Globe2 /> Check an app listing <ArrowUpRight /></button></div>
        </section>
        <section className="bg-panel">
          <div className="bg-panel-heading"><div><p className="bg-eyebrow">LATEST ACTIVITY</p><h2>Recent analyses</h2></div><button className="bg-text-button" onClick={() => onNavigate("results")}>View history <ArrowUpRight size={15} /></button></div>
          {historyLoading ? <p className="bg-empty"><LoaderCircle className="bg-spinner" /> Loading recent analyses…</p> : recentScans.length ? <ScanTable scans={recentScans} compact /> : <p className="bg-empty">No analyses yet. Results will appear here after you submit a profile or app listing.</p>}
        </section>
      </div>
      <p className="bg-disclaimer"><CircleAlert size={15} /> Results analyze information submitted by your team. This prototype does not crawl social networks or app stores.</p>
    </section>
  );
}

function Stat({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return <article className="bg-stat"><span className="bg-stat-icon">{icon}</span><span className="bg-stat-value">{value}</span><span className="bg-stat-label">{label}</span></article>;
}

function BrandLogo({ brand }: { brand: Brand }) {
  const [failed, setFailed] = useState(false);
  if (!brand.logo_url || failed) {
    return <span className="bg-company-placeholder" aria-label={`${brand.name} logo unavailable`}><Building2 /></span>;
  }
  return <img className="bg-company-logo" src={brand.logo_url} alt={`${brand.name} logo`} onError={() => setFailed(true)} />;
}

function BrandsSection({
  brands,
  token,
  onChanged,
  onError,
}: {
  brands: Brand[];
  token: string;
  onChanged: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [selectedId, setSelectedId] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [verificationAssetId, setVerificationAssetId] = useState("");
  const [verificationNotes, setVerificationNotes] = useState("");
  const selected = brands.find((brand) => brand.id === selectedId) ?? brands[0] ?? null;
  useEffect(() => {
    if (selected && !brands.some((brand) => brand.id === selectedId)) setSelectedId(selected.id);
  }, [brands, selected, selectedId]);

  async function createBrand(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const read = (name: string) => String(form.get(name) ?? "").trim();
    const initial_assets = [
      ["website", "website"],
      ["instagram", "instagram"],
      ["facebook", "facebook"],
      ["x", "x"],
      ["telegram", "telegram"],
      ["app_store", "app_store"],
    ].flatMap(([field, platform]) => {
      const value = read(field);
      if (!value) return [];
      return [{
        platform,
        raw_identifier: value,
        display_name: platform === "app_store" ? read("app_publisher") || null : null,
      }];
    });
    setSaving(true);
    setNotice("");
    try {
      const brand = await api<Brand>("/brands", {
        token,
        body: {
          name: read("brand_name"),
          description: read("description") || null,
          logo_url: read("logo_url") || null,
          category: read("category") || "other",
          initial_assets,
        },
      });
      await onChanged();
      setSelectedId(brand.id);
      setNotice("Brand profile saved. Newly added assets start unverified until reviewed.");
      formElement.reset();
    } catch (error) {
      onError(error instanceof Error ? error.message : "Could not save the brand profile.");
    } finally {
      setSaving(false);
    }
  }

  async function addAsset(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setSaving(true);
    try {
      await api(`/brands/${selected.id}/assets`, {
        token,
        body: {
          platform: String(form.get("platform") ?? ""),
          raw_identifier: String(form.get("identifier") ?? "").trim(),
          display_name: String(form.get("publisher") ?? "").trim() || null,
        },
      });
      await onChanged();
      formElement.reset();
      setNotice("Official asset added as unverified. Review ownership before marking it trusted.");
    } catch (error) {
      onError(error instanceof Error ? error.message : "Could not add the asset.");
    } finally {
      setSaving(false);
    }
  }

  async function manuallyVerify(event: React.FormEvent<HTMLFormElement>, assetId: string) {
    event.preventDefault();
    if (!selected) return;
    setSaving(true);
    try {
      await api(`/brands/${selected.id}/assets/${assetId}/verify/manual`, {
        token,
        body: { notes: verificationNotes.trim() },
      });
      await onChanged();
      setVerificationAssetId("");
      setVerificationNotes("");
      setNotice("Verification recorded with your manual review note.");
    } catch (error) {
      onError(error instanceof Error ? error.message : "Could not verify the asset.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="bg-page">
      <div className="bg-page-heading"><div><p className="bg-eyebrow">OFFICIAL ASSET REGISTER</p><h1>Brand profile</h1><p className="bg-muted">Save official accounts and apps first; only verified assets suppress impersonation alerts.</p></div></div>
      {notice && <p className="bg-notice" role="status"><Check size={16} />{notice}</p>}
      <div className="bg-grid-two bg-profile-layout">
        <section className="bg-panel">
          <div className="bg-panel-heading"><div><p className="bg-eyebrow">BRANDS</p><h2>{brands.length ? "Your brands" : "Register your first brand"}</h2></div></div>
          {brands.length > 0 && <div className="bg-brand-list">{brands.map((brand) => <button key={brand.id} onClick={() => setSelectedId(brand.id)} className={selected?.id === brand.id ? "bg-brand-option selected" : "bg-brand-option"}><Building2 size={16} /><span>{brand.name}</span><small>{brand.official_assets.length} assets</small></button>)}</div>}
          <form className="bg-form bg-brand-form" onSubmit={createBrand}>
            <h3>{brands.length ? "Add another brand" : "Create a brand profile"}</h3>
            <label htmlFor="brand_name">Brand name</label><input id="brand_name" name="brand_name" required minLength={2} maxLength={255} placeholder="e.g. Northstar" />
            <label htmlFor="description">Description <span>(optional)</span></label><textarea id="description" name="description" rows={2} maxLength={1000} placeholder="What does your company do?" />
            <label htmlFor="logo_url">Logo image URL <span>(upload storage is not configured)</span></label><input id="logo_url" name="logo_url" type="url" maxLength={1024} placeholder="https://example.com/logo.png" />
            <label htmlFor="category">Category</label><input id="category" name="category" maxLength={100} placeholder="Technology, finance…" />
            <details><summary>Add official assets now</summary>
              <label htmlFor="official_website">Official website URL or domain</label><input id="official_website" name="website" placeholder="https://example.com" />
              <label htmlFor="official_instagram">Instagram handle or profile URL</label><input id="official_instagram" name="instagram" placeholder="@yourbrand" />
              <label htmlFor="official_facebook">Facebook handle or profile URL</label><input id="official_facebook" name="facebook" placeholder="https://facebook.com/yourbrand" />
              <label htmlFor="official_x">X handle or profile URL</label><input id="official_x" name="x" placeholder="@yourbrand" />
              <label htmlFor="official_telegram">Telegram handle or profile URL</label><input id="official_telegram" name="telegram" placeholder="@yourbrand" />
              <label htmlFor="official_app">Official app listing URL or package ID</label><input id="official_app" name="app_store" placeholder="Store listing URL or package ID" />
              <label htmlFor="official_publisher">Official app publisher</label><input id="official_publisher" name="app_publisher" placeholder="Publisher name as listed in the store" />
            </details>
            <button className="bg-primary-button" type="submit" disabled={saving}>{saving && <LoaderCircle className="bg-spinner" />}<Plus size={16} /> Save brand profile</button>
          </form>
        </section>
        <section className="bg-panel">
          <div className="bg-panel-heading"><div><p className="bg-eyebrow">TRUSTED ASSETS</p><h2>{selected?.name ?? "Select a brand"}</h2></div></div>
          {selected ? <>
            <div className="bg-asset-list">{selected.official_assets.length ? selected.official_assets.map((asset) => (
              <article className="bg-asset" key={asset.id}>
                <span className="bg-asset-icon">{asset.platform.includes("app") || asset.platform === "google_play" ? <Globe2 /> : <Radio />}</span>
                <div className="bg-asset-info"><strong>{platformLabels[asset.platform] ?? asset.platform}</strong><span>{asset.raw_identifier}</span>{asset.display_name && <small>Publisher: {asset.display_name}</small>}</div>
                <span className={asset.is_verified ? "bg-verified" : "bg-unverified"}>{asset.is_verified ? "Verified" : "Unverified"}</span>
                {!asset.is_verified && <button className="bg-small-button" onClick={() => { setVerificationAssetId(asset.id); setVerificationNotes(""); }}>Review & verify</button>}
                {!asset.is_verified && verificationAssetId === asset.id && <form className="bg-verification-form" onSubmit={(event) => void manuallyVerify(event, asset.id)}>
                  <label htmlFor={`verification-notes-${asset.id}`}>Ownership evidence reviewed (at least 10 characters)</label>
                  <textarea id={`verification-notes-${asset.id}`} required minLength={10} maxLength={2000} rows={2} value={verificationNotes} onChange={(event) => setVerificationNotes(event.target.value)} placeholder="Describe how you confirmed the account or listing is official." />
                  <div><button className="bg-small-button" type="submit" disabled={saving}>{saving ? "Saving…" : "Confirm review"}</button><button className="bg-small-button" type="button" onClick={() => setVerificationAssetId("")}>Cancel</button></div>
                </form>}
              </article>
            )) : <p className="bg-empty">No official assets yet. Add a website, social profile or app listing below.</p>}</div>
            <form className="bg-form bg-add-asset" onSubmit={addAsset}>
              <h3>Add an official asset</h3>
              <label htmlFor="asset_platform">Asset type</label>
              <select id="asset_platform" name="platform" required defaultValue="website">{Object.entries(platformLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
              <label htmlFor="asset_identifier">Official URL, handle or app ID</label><input id="asset_identifier" name="identifier" required maxLength={1024} placeholder="https://… or @handle" />
              <label htmlFor="asset_publisher">Official publisher <span>(app listings only)</span></label><input id="asset_publisher" name="publisher" maxLength={255} placeholder="Publisher shown in the official store" />
              <button className="bg-secondary-button" type="submit" disabled={saving}><Plus size={15} /> Add unverified asset</button>
            </form>
            <p className="bg-disclaimer"><ShieldCheck size={15} /> Verification is an analyst-recorded review, not an automated DNS or platform check.</p>
          </> : <p className="bg-empty">Your registered brands and official assets appear here.</p>}
        </section>
      </div>
    </section>
  );
}

function MonitoringSection({
  mode,
  brands,
  token,
  onScanned,
}: {
  mode: "social" | "apps";
  brands: Brand[];
  token: string;
  onScanned: (scan: Scan) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [searchBusy, setSearchBusy] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [searchTerm, setSearchTerm] = useState(brands[0]?.name ?? "");
  const [storeResults, setStoreResults] = useState<AppStoreListing[]>([]);
  const [platform, setPlatform] = useState(mode === "apps" ? "app_store" : "instagram");
  const [candidate, setCandidate] = useState({ target: "", displayName: "", publisher: "", description: "" });
  const [selectedListing, setSelectedListing] = useState<AppStoreListing | null>(null);
  const isApp = mode === "apps";
  const title = isApp ? "App listing analysis" : "Social profile analysis";
  const platforms = isApp
    ? [["app_store", "Other app store"], ["apple_app_store", "Apple App Store"], ["google_play", "Google Play"]]
    : [["instagram", "Instagram"], ["x", "X"], ["facebook", "Facebook"], ["telegram", "Telegram"], ["website", "Website"]];

  async function searchAppleStore() {
    setSearchBusy(true);
    setSearchError("");
    setStoreResults([]);
    try {
      const result = await api<{ items: AppStoreListing[] }>(
        `/scans/app-store/search?term=${encodeURIComponent(searchTerm.trim())}&country=us`,
        { token },
      );
      setStoreResults(result.items);
      if (result.items.length === 0) setSearchError("No Apple App Store listings matched. Try another search.");
    } catch (caught) {
      setSearchError(caught instanceof Error ? caught.message : "Apple App Store search failed.");
    } finally {
      setSearchBusy(false);
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const target = String(form.get("target") ?? "").trim();
    const submittedUrl = /^https?:\/\//i.test(target);
    let accountHandle = target;
    if (submittedUrl) {
      try {
        accountHandle = new URL(target).pathname.split("/").filter(Boolean).at(-1) || target;
      } catch {
        accountHandle = target;
      }
    }
    const displayName = String(form.get("display_name") ?? "").trim();
    const description = String(form.get("description") ?? "").trim();
    const publisher = String(form.get("publisher") ?? "").trim();
    try {
      const scan = await api<Scan>("/scans", {
        token,
        body: {
          brand_id: String(form.get("brand_id") ?? "") || null,
          platform,
          target_url: submittedUrl ? target : null,
          account_handle: accountHandle,
          display_name: displayName || target,
          profile_description: description || null,
          additional_evidence: {
            ...(publisher ? { publisher } : {}),
            ...(selectedListing?.listing_url === target ? { app_identifier: selectedListing.listing_url } : {}),
          },
          ...(selectedListing?.listing_url === target ? {
            source_observation: {
              source: "apple_app_store_catalog",
              source_url: selectedListing.listing_url,
              record_id: selectedListing.listing_id,
              observed_at: selectedListing.observed_at,
              country: selectedListing.country,
            },
          } : {}),
          submission_source: "analyst_dashboard",
        },
      });
      formElement.reset();
      setCandidate({ target: "", displayName: "", publisher: "", description: "" });
      setSelectedListing(null);
      await onScanned(scan);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Analysis could not be completed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="bg-page">
      <div className="bg-page-heading"><div><p className="bg-eyebrow">{isApp ? "APP STORE DEFENSE" : "SOCIAL CHANNEL DEFENSE"}</p><h1>{title}</h1><p className="bg-muted">{isApp ? "Search Apple's live public catalog or submit a listing your team has found. Google Play searches are not configured." : "Submit a profile your team has found. Live social-network searches require provider access and are not configured."}</p></div></div>
      {brands.length === 0 && <p className="bg-alert"><CircleAlert size={17} /> Register a brand first so the detector can compare submissions against it.</p>}
      <div className="bg-grid-two bg-monitor-layout">
        <form className="bg-panel bg-form bg-scan-form" onSubmit={submit}>
          <p className="bg-eyebrow">SUBMITTED CANDIDATE</p>
          <h2>Analyze a listing</h2>
          <label htmlFor="scan_brand">Brand to compare</label><select id="scan_brand" name="brand_id" required disabled={!brands.length} defaultValue={brands[0]?.id ?? ""}>{brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</select>
          <label htmlFor="scan_platform">Source platform</label><select id="scan_platform" name="platform" value={platform} onChange={(event) => setPlatform(event.target.value)}>{platforms.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select>
          {isApp && platform === "apple_app_store" && <section className="bg-store-search">
            <label htmlFor="apple_store_search">Search live Apple App Store listings</label>
            <div><input id="apple_store_search" value={searchTerm} maxLength={100} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Enter an app or brand name" /><button type="button" className="bg-secondary-button" onClick={() => void searchAppleStore()} disabled={searchBusy || searchTerm.trim().length < 2}>{searchBusy ? "Searching…" : "Search Apple"}</button></div>
            {searchError && <p role="status">{searchError}</p>}
            {storeResults.map((listing) => <article key={listing.listing_id} className="bg-store-result"><div><strong>{listing.name}</strong><span>{listing.publisher}</span><a href={listing.listing_url} target="_blank" rel="noreferrer">View listing</a></div><button type="button" className="bg-small-button" onClick={() => { setCandidate({ target: listing.listing_url, displayName: listing.name, publisher: listing.publisher, description: listing.description ?? "" }); setSelectedListing(listing); }}>Use listing</button></article>)}
            <small>Catalog metadata is returned by Apple; selecting a listing does not mark it as a verified official asset.</small>
          </section>}
          <label htmlFor="scan_target">{isApp ? "App name, package ID or store URL" : "Handle or profile URL"}</label><input id="scan_target" name="target" value={candidate.target} onChange={(event) => { setCandidate({ ...candidate, target: event.target.value }); if (selectedListing?.listing_url !== event.target.value) setSelectedListing(null); }} required maxLength={1024} placeholder={isApp ? "e.g. Northstar Wallet or store URL" : "@northstar_support or profile URL"} />
          <label htmlFor="scan_display">{isApp ? "Listing title" : "Display name"} <span>(optional)</span></label><input id="scan_display" name="display_name" value={candidate.displayName} onChange={(event) => setCandidate({ ...candidate, displayName: event.target.value })} maxLength={255} placeholder={isApp ? "Name shown in the store" : "Name shown on the profile"} />
          {isApp && <><label htmlFor="scan_publisher">Reported app publisher <span>(catalog data or analyst-provided)</span></label><input id="scan_publisher" name="publisher" value={candidate.publisher} onChange={(event) => setCandidate({ ...candidate, publisher: event.target.value })} maxLength={255} placeholder="Publisher shown in the listing" /></>}
          <label htmlFor="scan_description">{isApp ? "Listing description" : "Profile bio or description"} <span>(optional)</span></label><textarea id="scan_description" name="description" value={candidate.description} onChange={(event) => setCandidate({ ...candidate, description: event.target.value })} rows={4} maxLength={4000} placeholder="Paste observed public listing text for analysis." />
          {error && <p className="bg-form-error" role="alert">{error}</p>}
          <button className="bg-primary-button" type="submit" disabled={busy || brands.length === 0}>{busy ? <LoaderCircle className="bg-spinner" /> : <Search size={16} />}{busy ? "Analyzing submitted data…" : "Analyze submission"}<ArrowUpRight size={16} /></button>
          <p className="bg-disclaimer"><CircleAlert size={15} /> Do not submit private messages, credentials or personal data.</p>
        </form>
        <section className="bg-panel bg-how-panel"><span className="bg-step-icon">{isApp ? <Globe2 /> : <Radio />}</span><p className="bg-eyebrow">HOW THIS CHECK WORKS</p><h2>Evidence, not assumptions.</h2><p>BrandGuard compares the submitted name and URL against the selected brand's verified assets, then reports matching signals and missing information.</p><ul><li>Exact verified matches are marked trusted.</li><li>Similar names or different publishers are review signals, not proof.</li><li>Inaccessible profiles and store pages are not fetched or invented.</li><li>Every submitted assessment is saved in analysis history.</li></ul>
        </section>
      </div>
    </section>
  );
}

function ResultsSection({
  scans,
  token,
  loading,
  onReviewed,
}: {
  scans: Scan[];
  token: string;
  loading: boolean;
  onReviewed: () => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const filtered = useMemo(() => scans.filter((scan) => {
    const matchesQuery = `${scan.account_handle ?? ""} ${scan.target_url ?? ""} ${scan.display_name ?? ""} ${scan.brand_name ?? ""}`.toLowerCase().includes(query.toLowerCase());
    const category = scan.risk_assessment?.risk_category.toLowerCase() ?? "low";
    return matchesQuery && (filter === "all" || category === filter);
  }), [filter, query, scans]);

  async function review(scan: Scan, verdict: string, notes: string) {
    setBusyId(scan.id);
    setError("");
    try {
      await api(`/scans/${scan.id}/review`, { token, body: { verdict, notes: notes || null } });
      await onReviewed();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save the review.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <section className="bg-page">
      <div className="bg-page-heading"><div><p className="bg-eyebrow">PERSISTENT SCAN HISTORY</p><h1>Analysis & reports</h1><p className="bg-muted">Review risk scores, supporting signals, and human dispositions.</p></div></div>
      {error && <p className="bg-alert" role="alert"><CircleAlert size={17} />{error}</p>}
      <section className="bg-panel">
        <div className="bg-result-toolbar"><input aria-label="Search results" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search target, display name or brand…" /><select aria-label="Filter by risk" value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">All risk levels</option>{["critical", "high", "medium", "low"].map((level) => <option key={level} value={level}>{level[0]?.toUpperCase()}{level.slice(1)}</option>)}</select><span>{filtered.length} result{filtered.length === 1 ? "" : "s"}</span></div>
        {loading ? <p className="bg-empty"><LoaderCircle className="bg-spinner" /> Loading scan history…</p> : filtered.length ? <div className="bg-results">{filtered.map((scan) => <ScanCard key={scan.id} scan={scan} token={token} busy={busyId === scan.id} onReview={(verdict, notes) => void review(scan, verdict, notes)} />)}</div> : <p className="bg-empty">{scans.length ? "No analysis results match this search." : "No submissions yet. Run a social or app analysis to create your first report."}</p>}
      </section>
    </section>
  );
}

function ScanTable({ scans, compact = false }: { scans: Scan[]; compact?: boolean }) {
  return <div className="bg-table-wrap"><table className="bg-table"><thead><tr><th>Target</th><th>Source</th><th>Risk</th><th>Score</th>{!compact && <th>Submitted</th>}</tr></thead><tbody>{scans.map((scan) => {
    const assessment = scan.risk_assessment;
    return <tr key={scan.id}><td><strong>{scan.display_name || scan.account_handle || scan.target_url || "Unknown target"}</strong><small>{scan.brand_name || "Unassigned brand"}</small></td><td>{platformLabels[scan.platform] ?? scan.platform}</td><td><span className={`bg-risk ${riskClass(assessment?.risk_category ?? "low")}`}>{assessment?.risk_category ?? "Unavailable"}</span></td><td>{assessment ? `${Math.round(assessment.risk_score)}/100` : "—"}</td>{!compact && <td>{formatDate(scan.created_at)}</td>}</tr>;
  })}</tbody></table></div>;
}

function ScanCard({
  scan,
  token,
  busy,
  onReview,
}: {
  scan: Scan;
  token: string;
  busy: boolean;
  onReview: (verdict: string, notes: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const assessment = scan.risk_assessment;
  const [feedback, setFeedback] = useState("");
  const [feedbackBusy, setFeedbackBusy] = useState(false);
  const [reviewNotes, setReviewNotes] = useState("");

  async function falsePositive() {
    setFeedbackBusy(true);
    setFeedback("");
    try {
      await api(`/scans/${scan.id}/feedback`, {
        token,
        body: { is_false_positive: true, comment: "Analyst marked this assessment as a false positive." },
      });
      setFeedback("False-positive feedback saved.");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Could not save feedback.");
    } finally {
      setFeedbackBusy(false);
    }
  }

  return <article className="bg-scan-card">
    <button className="bg-scan-summary" onClick={() => setExpanded(!expanded)} aria-expanded={expanded}>
      <span className="bg-scan-platform">{platformLabels[scan.platform] ?? scan.platform}</span>
      <span className="bg-scan-target"><strong>{scan.display_name || scan.account_handle || scan.target_url || "Unknown target"}</strong><small>{scan.brand_name} · {formatDate(scan.created_at)}</small></span>
      <span className={`bg-risk ${riskClass(assessment?.risk_category ?? "low")}`}>{assessment?.risk_category ?? "Unavailable"}</span>
      <strong className="bg-scan-score">{assessment ? `${Math.round(assessment.risk_score)}` : "—"}<small>/100</small></strong>
      <span className="bg-expand">{expanded ? "Hide report" : "View report"}</span>
    </button>
    {expanded && <div className="bg-scan-detail">
      {assessment ? <>
        <p className="bg-summary-reason">{assessment.summary_reason}</p>
        {assessment.is_insufficient_evidence && <p className="bg-evidence-warning"><CircleAlert size={15} /> Insufficient evidence: treat this score as inconclusive, not as a clean bill of health.</p>}
        <div className="bg-assessment-meta"><span>Rule score: {Math.round(assessment.rule_score)}</span><span>Model score: {assessment.ml_score === null ? "Not available" : `${Math.round(assessment.ml_score)}/100`}</span><span>Uncertainty: {assessment.uncertainty_level}</span><span>Engine: {assessment.model_version}</span></div>
        <h3>Supporting evidence</h3>
        {scan.evidence_items.length ? <div className="bg-evidence-list">{scan.evidence_items.map((evidence) => <article key={evidence.id ?? evidence.signal_name} className="bg-evidence"><span className={`bg-evidence-dot ${riskClass(evidence.severity)}`} /><div><strong>{evidence.title}</strong><p>{evidence.description}</p><small>{evidence.signal_type} · {evidence.severity} · +{evidence.score_contribution}</small></div></article>)}</div> : <p className="bg-empty">No positive signals found in the submitted data.</p>}
        {assessment.missing_evidence_notes.length > 0 && <p className="bg-missing">Missing information: {assessment.missing_evidence_notes.join(" ")}</p>}
        {assessment.recommended_actions.length > 0 && <><h3>Recommended next steps</h3><ul className="bg-actions">{assessment.recommended_actions.map((action) => <li key={action}>{action}</li>)}</ul></>}
        <div className="bg-review-actions"><strong>Analyst disposition</strong><input aria-label="Analyst review note" maxLength={2000} value={reviewNotes} onChange={(event) => setReviewNotes(event.target.value)} placeholder="Review note (optional)" /><button disabled={busy} onClick={() => onReview("legitimate_account", reviewNotes)}>Mark legitimate</button><button disabled={busy} onClick={() => onReview("false_positive", reviewNotes)}>False positive</button><button disabled={busy} onClick={() => onReview("confirmed_impersonation", reviewNotes)}>Confirm impersonation</button><button disabled={feedbackBusy} onClick={() => void falsePositive()}>{feedbackBusy ? "Saving…" : "Send false-positive feedback"}</button></div>
        {feedback && <p className="bg-feedback" role="status">{feedback}</p>}
      </> : <p className="bg-empty">This submission has no risk assessment.</p>}
    </div>}
  </article>;
}
