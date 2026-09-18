'use client';
import { useState, useEffect, useRef, ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, apiRequest } from '@/lib/auth';
import {
  UploadCloud, ArrowLeft, CheckCircle2, AlertCircle,
  Camera, Image as ImageIcon, Trash2, Sparkles, Scale, Info, Loader2
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

export default function NewInspectionPage() {
  const router = useRouter();
  const { token, user } = useAuth();

  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [productName, setProductName] = useState('');
  const [mode, setMode] = useState<'INSPECTION' | 'PRE_SCREENING'>('INSPECTION');
  const [slots, setSlots] = useState<UploadSlot[]>(INITIAL_SLOTS);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStep, setSubmitStep] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    if (!token) return;
    // Fetch categories from DB rule-packs or list
    apiRequest<Category[]>('/api/v1/rule-packs/categories', { token })
      .then((cats) => {
        setCategories(cats);
        if (cats.length > 0) setSelectedCategory(cats[0].id);
      })
      .catch((e) => {
        // Fallback default categories
        setCategories([
          { id: 'packaged_food', code: 'packaged_food', name_en: 'Packaged Food (PCR 2011)', name_hi: 'खाद्य' },
          { id: 'personal_care', code: 'personal_care', name_en: 'Personal Care & Cosmetics', name_hi: 'व्यक्तिगत' },
          { id: 'household', code: 'household', name_en: 'Household Consumer Goods', name_hi: 'घरेलू' },
          { id: 'imported_consumer', code: 'imported_consumer', name_en: 'Imported Commodities (Rule 6(1)(f))', name_hi: 'आयात' },
        ]);
        setSelectedCategory('packaged_food');
      });
  }, [token]);

  const handleFileChange = (slotId: string, e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Client-side quick check
    const issues: string[] = [];
    if (file.size > 10 * 1024 * 1024) issues.push('File size exceeds 10MB limit');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) issues.push('Only JPEG, PNG, WEBP formats allowed');

    const previewUrl = URL.createObjectURL(file);

    // Fast image dimension check
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

  const handleSubmit = async () => {
    setError(null);
    const requiredFilled = slots.filter(s => s.required && s.file !== null);
    if (requiredFilled.length < 1) {
      setError('Please upload at least the Front Panel image of the commodity package.');
      return;
    }

    setIsSubmitting(true);
    try {
      // Step 1: Create inspection record
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

      // Step 2: Upload images
      const activeSlots = slots.filter(s => s.file !== null);
      for (let i = 0; i < activeSlots.length; i++) {
        const slot = activeSlots[i];
        setSubmitStep(`Uploading ${slot.label} (${i + 1}/${activeSlots.length})…`);

        const formData = new FormData();
        formData.append('file', slot.file as File);
        formData.append('view_type', slot.view_type);

        const uploadRes = await fetch(`http://localhost:8000/api/v1/inspections/${inspectionId}/images`, {
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

      // Step 3: Trigger AI Analysis & Rule Evaluation
      setSubmitStep('Initiating Gemini AI extraction & rule validation pipeline…');
      await apiRequest(`/api/v1/inspections/${inspectionId}/analyze`, {
        token,
        method: 'POST',
      });

      // Redirect to inspection detail page
      router.push(`/dashboard/inspections/${inspectionId}`);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to submit inspection. Please try again.');
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
            <h1 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.2rem' }}>
              Initiate Package Inspection
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.825rem' }}>
              Upload package panel imagery for AI-assisted declaration extraction and Legal Metrology rule validation
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

        {/* Basic Information */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Scale size={18} color="var(--accent)" />
            1. Inspection Classification & Details
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
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.35rem', display: 'block' }}>
                Applies statutory rule pack for Legal Metrology (Packaged Commodities) Rules 2011
              </span>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, marginBottom: '0.4rem', color: 'var(--text-secondary)' }}>
                Inspection Mode *
              </label>
              <select
                className="input"
                value={mode}
                onChange={(e) => setMode(e.target.value as any)}
              >
                <option value="INSPECTION">Statutory Field Enforcement Inspection</option>
                <option value="PRE_SCREENING">Manufacturer Self-Certification / Pre-Screening</option>
              </select>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.35rem', display: 'block' }}>
                Pre-screening provides compliance preview before market distribution
              </span>
            </div>

            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, marginBottom: '0.4rem', color: 'var(--text-secondary)' }}>
                Commodity / Product Name (Optional — Auto-detected by AI if left blank)
              </label>
              <input
                type="text"
                className="input"
                placeholder="e.g., Premium Whole Wheat Atta 5kg, Cold Pressed Mustard Oil 1L"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Multi-angle Image Upload Slots */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Camera size={18} color="var(--accent)" />
              2. Multi-Angle Package Images
            </h2>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Sharp images ensure &gt;95% OCR &amp; declaration detection
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            {slots.map((slot) => {
              const hasFile = slot.file !== null;
              return (
                <div
                  key={slot.id}
                  style={{
                    border: hasFile ? '1px solid var(--accent)' : '2px dashed var(--border)',
                    borderRadius: '12px',
                    padding: '1rem',
                    background: hasFile ? 'rgba(99,102,241,0.04)' : 'var(--bg-secondary)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: '220px',
                    position: 'relative',
                    transition: 'all 0.2s ease',
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

        {/* Submit action */}
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
            onClick={handleSubmit}
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
      </div>
    </>
  );
}
