'use client';
import { useState, useEffect, useRef, ChangeEvent, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth, apiRequest } from '@/lib/auth';
import {
  UploadCloud, ArrowLeft, CheckCircle2, AlertCircle,
  Camera, Image as ImageIcon, Trash2, Sparkles, Scale, Info, Loader2,
  ShoppingBag, Package, ExternalLink, ShieldAlert, Zap
} from 'lucide-react';
import Link from 'next/link';

interface Category {
  id: string;
  code: string;
  name_en: string;
  name_hi: string;
}

interface UploadSlot {
  id: string;
  view_type: 'FRONT' | 'BACK' | 'MRP_STICKER' | 'SIDE';
  label: string;
  required: boolean;
  file: File | null;
  previewUrl: string | null;
  quality: { status: 'PASS' | 'WARNING' | 'RETAKE' | 'PENDING'; issues: string[] } | null;
}

const INITIAL_SLOTS: UploadSlot[] = [
  { id: '1', view_type: 'FRONT', label: 'Front Panel (Brand & Commodity)', required: true, file: null, previewUrl: null, quality: null },
  { id: '2', view_type: 'BACK', label: 'Back / Declaration Panel (Full Specs)', required: true, file: null, previewUrl: null, quality: null },
  { id: '3', view_type: 'MRP_STICKER', label: 'MRP & Batch Details (Close-up)', required: false, file: null, previewUrl: null, quality: null },
  { id: '4', view_type: 'SIDE', label: 'Side / Additional Declarations', required: false, file: null, previewUrl: null, quality: null },
];

const ECOM_PRESETS = [
  {
    title: 'Zepto Dark-Store Cashews (Missing USP & Best Before Date)',
    platform: 'ZEPTO',
    product_name: 'Premium California Whole Cashews (250g)',
    product_url: 'https://zeptonow.com/pn/premium-whole-cashews/pvid/48912',
    declared_mrp: '₹349 (Inclusive of all taxes)',
    declared_usp: '',  // Missing USP
    declared_net_qty: '250 g',
    declared_origin: 'India',
    declared_expiry: '',  // Missing Expiry
    declared_manufacturer: 'DryFruits India Direct Ltd, Navi Mumbai MH',
    declared_consumer_care: 'care@zepto.in',
    notes: 'Sampled from Zepto dark store Koramangala Hub, Bengaluru.',
  },
  {
    title: 'Blinkit Gourmet Extra Virgin Olive Oil (Missing Origin & USP)',
    platform: 'BLINKIT',
    product_name: 'Mediterranean Cold Pressed Extra Virgin Olive Oil (500ml)',
    product_url: 'https://blinkit.com/prn/olive-oil-extra-virgin/prid/88124',
    declared_mrp: '₹799 (Inclusive of all taxes)',
    declared_usp: '',  // Missing USP
    declared_net_qty: '500 ml',
    declared_origin: '',  // Missing Origin
    declared_expiry: '10/2026',
    declared_manufacturer: 'Imported by MedFoods Pvt Ltd, Gurugram HR',
    declared_consumer_care: 'support@blinkit.com',
    notes: 'Audited from Blinkit Hub DLF Phase 3, Gurugram.',
  },
  {
    title: 'Fully Compliant Quick-Commerce SKU (All Rule 6(10) Declarations Present)',
    platform: 'INSTAMART',
    product_name: 'Tata Sampann Organic Turmeric Powder (200g)',
    product_url: 'https://www.swiggy.com/instamart/item/tata-turmeric-organic/8912',
    declared_mrp: '₹85 (Inclusive of all taxes)',
    declared_usp: '₹0.43 per g',
    declared_net_qty: '200 g',
    declared_origin: 'India',
    declared_expiry: '08/2027',
    declared_manufacturer: 'Tata Consumer Products Ltd, Mumbai MH',
    declared_consumer_care: 'customercare@tataconsumer.com / 1800-108-4488',
    notes: 'Audited Swiggy Instamart dark store Sector 18, Noida.',
  }
];

function NewInspectionForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { token, user } = useAuth();

  // Active Tab: 'physical' or 'ecommerce'
  const initialTab = searchParams.get('tab') === 'ecommerce' ? 'ecommerce' : 'physical';
  const [activeTab, setActiveTab] = useState<'physical' | 'ecommerce'>(initialTab);

  // Common State
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStep, setSubmitStep] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // Physical Package State
  const [productName, setProductName] = useState('');
  const [mode, setMode] = useState<'INSPECTION' | 'PRE_SCREENING'>('INSPECTION');
  const [slots, setSlots] = useState<UploadSlot[]>(INITIAL_SLOTS);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // E-Commerce Audit State
  const [ecomPlatform, setEcomPlatform] = useState('BLINKIT');
  const [ecomUrl, setEcomUrl] = useState('');
  const [ecomProductName, setEcomProductName] = useState('');
  const [ecomMrp, setEcomMrp] = useState('');
  const [ecomUsp, setEcomUsp] = useState('');
  const [ecomNetQty, setEcomNetQty] = useState('');
  const [ecomOrigin, setEcomOrigin] = useState('');
  const [ecomExpiry, setEcomExpiry] = useState('');
  const [ecomMfr, setEcomMfr] = useState('');
  const [ecomCare, setEcomCare] = useState('');
  const [ecomNotes, setEcomNotes] = useState('');
  const [isFetchingUrl, setIsFetchingUrl] = useState(false);
  const [fetchNotice, setFetchNotice] = useState<string | null>(null);

  const handleAutoFetchListing = async () => {
    if (!ecomUrl.trim()) {
      setError('Please paste an e-commerce or dark-store product URL first.');
      return;
    }
    setError(null);
    setIsFetchingUrl(true);
    setFetchNotice(null);
    try {
      const data = await apiRequest<any>('/api/v1/inspections/ecommerce-fetch', {
        token,
        method: 'POST',
        body: JSON.stringify({ url: ecomUrl.trim() }),
      });
      if (data) {
        if (data.platform && data.platform !== 'OTHER') {
          setEcomPlatform(data.platform);
        }
        if (data.product_name) setEcomProductName(data.product_name);
        if (data.declared_net_qty) setEcomNetQty(data.declared_net_qty);
        if (data.declared_mrp) setEcomMrp(data.declared_mrp);
        if (data.declared_origin) setEcomOrigin(data.declared_origin);
        if (data.declared_manufacturer) setEcomMfr(data.declared_manufacturer);
        if (data.declared_consumer_care) setEcomCare(data.declared_consumer_care);
        setFetchNotice(data.notice || `Declarations extracted from ${data.platform} (${data.tier_used}).`);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to auto-fetch product declarations.');
    } finally {
      setIsFetchingUrl(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    apiRequest<Category[]>('/api/v1/rule-packs/categories', { token })
      .then((cats) => {
        setCategories(cats);
        if (cats.length > 0) setSelectedCategory(cats[0].id);
      })
      .catch(() => {
        setCategories([
          { id: 'packaged_food', code: 'packaged_food', name_en: 'Packaged Food (PCR 2011)', name_hi: 'खाद्य' },
          { id: 'personal_care', code: 'personal_care', name_en: 'Personal Care & Cosmetics', name_hi: 'व्यक्तिगत' },
          { id: 'household', code: 'household', name_en: 'Household Consumer Goods', name_hi: 'घरेलू' },
          { id: 'imported_consumer', code: 'imported_consumer', name_en: 'Imported Commodities (Rule 6(1)(f))', name_hi: 'आयात' },
        ]);
        setSelectedCategory('packaged_food');
      });
  }, [token]);

  const loadPreset = (preset: typeof ECOM_PRESETS[0]) => {
    setEcomPlatform(preset.platform);
    setEcomProductName(preset.product_name);
    setEcomUrl(preset.product_url);
    setEcomMrp(preset.declared_mrp);
    setEcomUsp(preset.declared_usp);
    setEcomNetQty(preset.declared_net_qty);
    setEcomOrigin(preset.declared_origin);
    setEcomExpiry(preset.declared_expiry);
    setEcomMfr(preset.declared_manufacturer);
    setEcomCare(preset.declared_consumer_care);
    setEcomNotes(preset.notes);
  };

  const handleFileChange = (slotId: string, e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const issues: string[] = [];
    if (file.size > 10 * 1024 * 1024) issues.push('File size exceeds 10MB limit');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) issues.push('Only JPEG, PNG, WEBP formats allowed');

    const previewUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      if (img.width < 400 || img.height < 400) {
        issues.push('Low resolution — minimum 400×400px recommended for OCR precision');
      }
      setSlots(prev => prev.map(s => {
        if (s.id !== slotId) return s;
        return {
          ...s,
          file,
          previewUrl,
          quality: {
            status: issues.length > 0 ? (issues.some(i => i.includes('limit') || i.includes('format')) ? 'RETAKE' : 'WARNING') : 'PASS',
            issues
          }
        };
      }));
    };
    img.src = previewUrl;
  };

  const removeSlotFile = (slotId: string) => {
    setSlots(prev => prev.map(s => {
      if (s.id !== slotId) return s;
      if (s.previewUrl) URL.revokeObjectURL(s.previewUrl);
      return { ...s, file: null, previewUrl: null, quality: null };
    }));
  };

  // Submit Physical Package
  const handlePhysicalSubmit = async () => {
    setError(null);
    const requiredFilled = slots.filter(s => s.required && s.file !== null);
    if (requiredFilled.length < 1) {
      setError('Please upload at least the Front Panel image of the commodity package.');
      return;
    }

    setIsSubmitting(true);
    try {
      setSubmitStep('Registering statutory inspection case…');
      const inspection = await apiRequest<{ id: string }>('/api/v1/inspections', {
        token,
        method: 'POST',
        body: JSON.stringify({
          category_id: selectedCategory,
          mode: mode,
          product_name: productName.trim() || undefined,
        }),
      });

      const inspectionId = inspection.id;
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

      const activeSlots = slots.filter(s => s.file !== null);
      for (let i = 0; i < activeSlots.length; i++) {
        const slot = activeSlots[i];
        setSubmitStep(`Uploading ${slot.label} (${i + 1}/${activeSlots.length})…`);

        const formData = new FormData();
        formData.append('file', slot.file as File);
        formData.append('view_type', slot.view_type);

        const uploadRes = await fetch(`${apiUrl}/api/v1/inspections/${inspectionId}/images`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        });

        if (!uploadRes.ok) {
          const errData = await uploadRes.json().catch(() => ({}));
          throw new Error(errData?.detail?.message || `Failed to upload ${slot.label}`);
        }
      }

      setSubmitStep('Initiating Gemini AI extraction & rule validation pipeline…');
      await apiRequest(`/api/v1/inspections/${inspectionId}/analyze`, {
        token,
        method: 'POST',
      });

      router.push(`/dashboard/inspections/${inspectionId}`);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to submit inspection. Please try again.');
      setIsSubmitting(false);
    }
  };

  // Submit E-Commerce Audit
  const handleEcomSubmit = async () => {
    setError(null);
    if (!ecomProductName.trim()) {
      setError('Please enter the Product Name / Listing Title.');
      return;
    }
    if (!ecomUrl.trim()) {
      setError('Please enter the Product Listing URL.');
      return;
    }

    setIsSubmitting(true);
    setSubmitStep('Evaluating Rule 6(10) digital network declarations…');

    try {
      const payload = {
        platform: ecomPlatform,
        product_url: ecomUrl.trim(),
        product_name: ecomProductName.trim(),
        category_id: selectedCategory || undefined,
        declared_mrp: ecomMrp.trim() || null,
        declared_usp: ecomUsp.trim() || null,
        declared_net_qty: ecomNetQty.trim() || null,
        declared_origin: ecomOrigin.trim() || null,
        declared_expiry: ecomExpiry.trim() || null,
        declared_manufacturer: ecomMfr.trim() || null,
        declared_consumer_care: ecomCare.trim() || null,
        notes: ecomNotes.trim() || null,
      };

      const res = await apiRequest<{ inspection_id: string; notice_ref: string }>(
        '/api/v1/inspections/ecommerce-audit',
        {
          token,
          method: 'POST',
          body: JSON.stringify(payload),
        }
      );

      router.push(`/dashboard/inspections/${res.inspection_id}`);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to conduct e-commerce compliance audit.');
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link href="/dashboard/inspections">
            <button className="btn btn-ghost" style={{ padding: '0.4rem 0.6rem' }}>
              <ArrowLeft size={16} />
            </button>
          </Link>
          <div>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '0.2rem' }}>
              Initiate Legal Metrology Inspection
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.825rem' }}>
              Statutory verification under Legal Metrology Act, 2009 & Packaged Commodities Rules, 2011
            </p>
          </div>
        </div>
      </div>

      <div className="page-body animate-fade" style={{ maxWidth: '900px' }}>
        {error && (
          <div className="alert alert-danger" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <AlertCircle size={18} />
            <span style={{ fontSize: '0.85rem' }}>{error}</span>
          </div>
        )}

        {/* Tab Selection */}
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <button
            onClick={() => setActiveTab('physical')}
            className={`btn ${activeTab === 'physical' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ flex: 1, padding: '0.75rem', justifyContent: 'center', fontSize: '0.875rem' }}
          >
            <Package size={17} /> Physical Package Inspection (OCR & AI)
          </button>
          <button
            onClick={() => setActiveTab('ecommerce')}
            className={`btn ${activeTab === 'ecommerce' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ flex: 1, padding: '0.75rem', justifyContent: 'center', fontSize: '0.875rem', borderColor: activeTab === 'ecommerce' ? 'var(--accent)' : 'rgba(245, 158, 11, 0.4)', color: activeTab === 'ecommerce' ? '#fff' : '#fbbf24' }}
          >
            <ShoppingBag size={17} /> Quick-Commerce & E-Commerce Audit (Rule 6(10))
          </button>
        </div>

        {/* TAB 1: PHYSICAL COMMODITY INSPECTION */}
        {activeTab === 'physical' && (
          <>
            <div className="card" style={{ marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Scale size={18} color="var(--accent)" />
                1. Commodity Classification & Context
              </h2>

              <div className="grid-2" style={{ gap: '1.25rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, marginBottom: '0.4rem', color: 'var(--text-secondary)' }}>
                    Target Commodity Category *
                  </label>
                  <select
                    className="input"
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name_en}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, marginBottom: '0.4rem', color: 'var(--text-secondary)' }}>
                    Inspection Mode
                  </label>
                  <select
                    className="input"
                    value={mode}
                    onChange={(e) => setMode(e.target.value as any)}
                  >
                    <option value="INSPECTION">Regulatory Officer Field Inspection</option>
                    <option value="PRE_SCREENING">Manufacturer Pre-Market Self-Check</option>
                  </select>
                </div>

                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, marginBottom: '0.4rem', color: 'var(--text-secondary)' }}>
                    Product Name / Batch Identifier (Optional)
                  </label>
                  <input
                    type="text"
                    className="input"
                    placeholder="Enter product name or batch identifier"
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Packaging Panel Uploads */}
            <div className="card" style={{ marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Camera size={18} color="var(--accent)" />
                2. Packaging Panel Imagery
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginBottom: '1.25rem' }}>
                Upload high-clarity photos of the packaging panels. METRA extracts text, dates, prices, and bounding regions automatically.
              </p>

              <div className="grid-2" style={{ gap: '1rem' }}>
                {slots.map((slot) => {
                  const hasFile = slot.file !== null;
                  return (
                    <div
                      key={slot.id}
                      style={{
                        border: `1px dashed ${hasFile ? 'var(--accent)' : 'var(--border)'}`,
                        borderRadius: '10px',
                        padding: '1rem',
                        background: hasFile ? 'rgba(99, 102, 241, 0.03)' : 'rgba(255, 255, 255, 0.01)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minHeight: '180px',
                        position: 'relative',
                        transition: 'all 0.2s',
                      }}
                    >
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        style={{ display: 'none' }}
                        ref={(el) => { fileInputRefs.current[slot.id] = el; }}
                        onChange={(e) => handleFileChange(slot.id, e)}
                      />

                      {hasFile && slot.previewUrl ? (
                        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                          <div style={{ width: '100%', height: '120px', borderRadius: '8px', overflow: 'hidden', position: 'relative', background: '#000' }}>
                            <img
                              src={slot.previewUrl}
                              alt={slot.label}
                              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                            />
                            <button
                              onClick={() => removeSlotFile(slot.id)}
                              style={{
                                position: 'absolute', top: '6px', right: '6px',
                                background: 'rgba(239, 68, 68, 0.85)', border: 'none',
                                color: 'white', borderRadius: '6px', padding: '4px', cursor: 'pointer'
                              }}
                              title="Remove image"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>

                          <div style={{ textAlign: 'center', width: '100%' }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {slot.file?.name}
                            </div>
                            {slot.quality && (
                              <div style={{ marginTop: '0.25rem' }}>
                                <span className={`badge ${slot.quality.status === 'PASS' ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '0.65rem' }}>
                                  {slot.quality.status === 'PASS' ? '✓ Quality Checked' : '⚠ Quality Notice'}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div
                          onClick={() => fileInputRefs.current[slot.id]?.click()}
                          style={{ cursor: 'pointer', textAlign: 'center', width: '100%', padding: '0.5rem' }}
                        >
                          <div style={{
                            width: '42px', height: '42px', borderRadius: '10px',
                            background: 'rgba(99,102,241,0.1)', color: 'var(--accent)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            margin: '0 auto 0.75rem'
                          }}>
                            <UploadCloud size={20} />
                          </div>
                          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.2rem' }}>
                            {slot.label}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            {slot.required ? '(Mandatory)' : '(Optional)'}
                          </div>
                          <div style={{ marginTop: '0.5rem', fontSize: '0.68rem', color: 'var(--accent)' }}>
                            Click to select image
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 0' }}>
              <Link href="/dashboard/inspections">
                <button className="btn btn-ghost" disabled={isSubmitting}>
                  Cancel
                </button>
              </Link>

              <button
                className="btn btn-primary"
                style={{ minWidth: '240px', padding: '0.75rem 1.5rem', fontSize: '0.9rem' }}
                disabled={isSubmitting}
                onClick={handlePhysicalSubmit}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>{submitStep || 'Processing…'}</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    <span>Run Statutory AI Compliance Check</span>
                  </>
                )}
              </button>
            </div>
          </>
        )}

        {/* TAB 2: E-COMMERCE & QUICK-COMMERCE AUDIT (RULE 6(10)) */}
        {activeTab === 'ecommerce' && (
          <>
            {/* Quick Presets Box */}
            <div className="card" style={{ marginBottom: '1.5rem', borderColor: 'rgba(245, 158, 11, 0.3)', background: 'rgba(245, 158, 11, 0.03)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <ShieldAlert size={18} color="#fbbf24" />
                <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#fbbf24' }}>
                  Load Statutory Case Studies (Dark Stores & Marketplaces)
                </h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {ECOM_PRESETS.map((p, idx) => (
                  <div
                    key={idx}
                    onClick={() => loadPreset(p)}
                    style={{
                      padding: '0.6rem 0.85rem',
                      borderRadius: '6px',
                      background: 'rgba(0,0,0,0.3)',
                      border: '1px solid var(--border)',
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
                  >
                    <div>
                      <span style={{ fontWeight: 600, color: '#e2e8f0' }}>{p.title}</span>
                      <span style={{ color: 'var(--text-muted)', marginLeft: '0.5rem', fontSize: '0.72rem' }}>({p.platform})</span>
                    </div>
                    <span style={{ color: 'var(--accent-light)', fontSize: '0.75rem', fontWeight: 600 }}>Load Data →</span>
                  </div>
                ))}
              </div>
            </div>

            {/* E-Commerce Audit Form */}
            <div className="card" style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                <h2 style={{ fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <ShoppingBag size={18} color="var(--accent)" />
                  Rule 6(10) Digital Declarations Audit
                </h2>
                <span className="badge badge-info" style={{ fontSize: '0.72rem' }}>
                  Live Scraper &amp; Meta-Extractor Ready
                </span>
              </div>

              {/* 1-Click Live Scraper Bar */}
              <div style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                padding: '1rem',
                marginBottom: '1.5rem',
              }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--text-primary)' }}>
                  Marketplace / Dark-Store Product URL *
                </label>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <input
                    type="text"
                    className="input"
                    placeholder="https://..."
                    value={ecomUrl}
                    onChange={(e) => setEcomUrl(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAutoFetchListing();
                      }
                    }}
                    style={{ flex: 1, minWidth: '260px' }}
                  />
                  <button
                    type="button"
                    onClick={handleAutoFetchListing}
                    disabled={isFetchingUrl}
                    className="btn btn-primary"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      fontSize: '0.8rem',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <Zap size={14} className={isFetchingUrl ? 'animate-spin' : ''} />
                    {isFetchingUrl ? 'Extracting Metadata…' : '⚡ Auto-Fetch & Extract'}
                  </button>
                </div>
                {fetchNotice && (
                  <div style={{
                    marginTop: '0.6rem',
                    padding: '0.45rem 0.75rem',
                    borderRadius: '6px',
                    background: 'rgba(34, 197, 94, 0.1)',
                    border: '1px solid rgba(34, 197, 94, 0.3)',
                    color: 'var(--success)',
                    fontSize: '0.78rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                  }}>
                    <CheckCircle2 size={14} />
                    <span>{fetchNotice}</span>
                  </div>
                )}
              </div>

              <div className="grid-2" style={{ gap: '1.25rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, marginBottom: '0.4rem', color: 'var(--text-secondary)' }}>
                    E-Commerce / Dark-Store Entity *
                  </label>
                  <select
                    className="input"
                    value={ecomPlatform}
                    onChange={(e) => setEcomPlatform(e.target.value)}
                  >
                    <option value="BLINKIT">Blinkit (Quick-Commerce Dark Store)</option>
                    <option value="ZEPTO">Zepto (Quick-Commerce Dark Store)</option>
                    <option value="INSTAMART">Swiggy Instamart (Dark Store)</option>
                    <option value="AMAZON">Amazon India (Marketplace)</option>
                    <option value="FLIPKART">Flipkart (Marketplace)</option>
                    <option value="BIGBASKET">BigBasket (E-Grocery)</option>
                    <option value="JIOMART">JioMart (E-Commerce)</option>
                    <option value="OTHER">Other E-Commerce Platform</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, marginBottom: '0.4rem', color: 'var(--text-secondary)' }}>
                    Commodity Category
                  </label>
                  <select
                    className="input"
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name_en}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, marginBottom: '0.4rem', color: 'var(--text-secondary)' }}>
                    Product Listing Title / Description *
                  </label>
                  <input
                    type="text"
                    className="input"
                    placeholder="Enter product or commodity title"
                    value={ecomProductName}
                    onChange={(e) => setEcomProductName(e.target.value)}
                  />
                </div>


                {/* Statutory Check inputs */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, marginBottom: '0.4rem', color: 'var(--text-secondary)' }}>
                    Maximum Retail Price (MRP)
                  </label>
                  <input
                    type="text"
                    className="input"
                    placeholder="Enter declared MRP (e.g. ₹ per unit)"
                    value={ecomMrp}
                    onChange={(e) => setEcomMrp(e.target.value)}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, marginBottom: '0.4rem', color: 'var(--text-secondary)' }}>
                    Unit Sale Price (USP per g/ml) [Rule 6(11)]
                  </label>
                  <input
                    type="text"
                    className="input"
                    placeholder="Enter unit sale price (or leave empty if omitted)"
                    value={ecomUsp}
                    onChange={(e) => setEcomUsp(e.target.value)}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, marginBottom: '0.4rem', color: 'var(--text-secondary)' }}>
                    Net Quantity [Rule 6(1)(e)]
                  </label>
                  <input
                    type="text"
                    className="input"
                    placeholder="Enter declared net quantity with units"
                    value={ecomNetQty}
                    onChange={(e) => setEcomNetQty(e.target.value)}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, marginBottom: '0.4rem', color: 'var(--text-secondary)' }}>
                    Country of Origin [Rule 6(10)]
                  </label>
                  <input
                    type="text"
                    className="input"
                    placeholder="Enter country of origin"
                    value={ecomOrigin}
                    onChange={(e) => setEcomOrigin(e.target.value)}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, marginBottom: '0.4rem', color: 'var(--text-secondary)' }}>
                    Best Before / Expiry Date [Rule 6(10)]
                  </label>
                  <input
                    type="text"
                    className="input"
                    placeholder="MM/YYYY or best before declaration"
                    value={ecomExpiry}
                    onChange={(e) => setEcomExpiry(e.target.value)}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, marginBottom: '0.4rem', color: 'var(--text-secondary)' }}>
                    Manufacturer / Importer Info
                  </label>
                  <input
                    type="text"
                    className="input"
                    placeholder="Enter name and complete address"
                    value={ecomMfr}
                    onChange={(e) => setEcomMfr(e.target.value)}
                  />
                </div>

                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, marginBottom: '0.4rem', color: 'var(--text-secondary)' }}>
                    Dark-Store Hub / Inspector Field Notes
                  </label>
                  <textarea
                    className="input"
                    rows={2}
                    placeholder="Enter inspection location, batch details, or field remarks"
                    value={ecomNotes}
                    onChange={(e) => setEcomNotes(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 0' }}>
              <Link href="/dashboard/inspections">
                <button className="btn btn-ghost" disabled={isSubmitting}>
                  Cancel
                </button>
              </Link>

              <button
                className="btn btn-primary"
                style={{ minWidth: '260px', padding: '0.75rem 1.5rem', fontSize: '0.9rem', background: '#f59e0b', color: '#000' }}
                disabled={isSubmitting}
                onClick={handleEcomSubmit}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>{submitStep || 'Auditing…'}</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    <span>Execute Rule 6(10) Statutory Audit</span>
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

export default function NewInspectionPageWrapper() {
  return (
    <Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>}>
      <NewInspectionForm />
    </Suspense>
  );
}
