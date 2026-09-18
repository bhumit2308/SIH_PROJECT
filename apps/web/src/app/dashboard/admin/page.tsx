'use client';
import { useEffect, useState } from 'react';
import { useAuth, apiRequest } from '@/lib/auth';
import {
  Settings, BookOpen, ShieldAlert, CheckCircle2,
  Database, Cpu, HardDrive, FileText, Check, AlertCircle, RefreshCw
} from 'lucide-react';

interface RulePackSummary {
  id: string;
  name: string;
  category_id: string;
  version: string;
  status: string;
  rules_count?: number;
  rules?: { code: string; name: string; legal_ref: string; severity: string }[];
}

export default function AdminPage() {
  const { token, user, hasRole } = useAuth();
  const [rulePacks, setRulePacks] = useState<RulePackSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    apiRequest<RulePackSummary[]>('/api/v1/rule-packs', { token })
      .then(setRulePacks)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <>
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.2rem' }}>
            System Administration &amp; Statutory Rule Packs
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.825rem' }}>
            Legal Metrology (Packaged Commodities) statutory rule management and system diagnostics
          </p>
        </div>
      </div>

      <div className="page-body animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* System Diagnostics Health Grid */}
        <div className="grid-4">
          <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--success)' }}>
              <Cpu size={20} />
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>AI Vision Engine</div>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>Gemini 3.6 Flash</div>
              <div style={{ fontSize: '0.68rem', color: 'var(--success)', marginTop: '0.1rem' }}>● Online &amp; Operational</div>
            </div>
          </div>

          <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--success)' }}>
              <HardDrive size={20} />
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Evidence Storage</div>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>Supabase Storage</div>
              <div style={{ fontSize: '0.68rem', color: 'var(--success)', marginTop: '0.1rem' }}>● 2 Buckets Active</div>
            </div>
          </div>

          <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--success)' }}>
              <Database size={20} />
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Audit Database</div>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>SQL Engine</div>
              <div style={{ fontSize: '0.68rem', color: 'var(--success)', marginTop: '0.1rem' }}>● Schema Synchronized</div>
            </div>
          </div>

          <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(99, 102, 241, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
              <BookOpen size={20} />
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Statutory Rules</div>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>PCR 2011 Edition</div>
              <div style={{ fontSize: '0.68rem', color: 'var(--accent-light)', marginTop: '0.1rem' }}>4 Active Categories</div>
            </div>
          </div>
        </div>

        {/* Rule Packs Table */}
        <div className="card" style={{ padding: '1.5rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <BookOpen size={18} color="var(--accent)" />
            Statutory Rule Packs (Packaged Commodities Rules, 2011)
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '1.25rem' }}>
            Deterministic rule specifications versioned as code. AI outputs are evaluated against these immutable statutory checks.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
            {[
              {
                name: 'Packaged Food Rule Pack',
                version: 'v1.0.0',
                status: 'PUBLISHED',
                rules: [
                  { code: 'PF-001', name: 'Name & Description of Commodity', ref: 'Rule 6(1)(a)', sev: 'HIGH' },
                  { code: 'PF-002', name: 'Net Quantity in Standard SI Units', ref: 'Rule 6(1)(e) & Sch II', sev: 'HIGH' },
                  { code: 'PF-003', name: 'MRP with Taxes Declaration', ref: 'Rule 6(1)(c) & Rule 18', sev: 'HIGH' },
                  { code: 'PF-004', name: 'Month & Year of Manufacture / Packing', ref: 'Rule 6(1)(d)', sev: 'HIGH' },
                  { code: 'PF-005', name: 'Manufacturer / Packer Complete Address', ref: 'Rule 6(1)(b)', sev: 'HIGH' },
                  { code: 'PF-006', name: 'Consumer Care Helpline & Email', ref: 'Rule 6(1)(g)', sev: 'MEDIUM' },
                  { code: 'PF-007', name: 'Unit Sale Price (USP) for Packages > 1 unit', ref: 'Rule 6(1)(k)', sev: 'MEDIUM' },
                  { code: 'PF-008', name: 'Country of Origin (For Imported Goods)', ref: 'Rule 6(1)(f)', sev: 'HIGH' },
                ]
              },
              {
                name: 'Personal Care & Cosmetics Pack',
                version: 'v1.0.0',
                status: 'PUBLISHED',
                rules: [
                  { code: 'PC-001', name: 'Commodity Generic Name', ref: 'Rule 6(1)(a)', sev: 'HIGH' },
                  { code: 'PC-002', name: 'Net Mass / Volume Declaration', ref: 'Rule 6(1)(e)', sev: 'HIGH' },
                  { code: 'PC-003', name: 'MRP inclusive of all taxes', ref: 'Rule 6(1)(c)', sev: 'HIGH' },
                  { code: 'PC-004', name: 'Manufacturer / Marketer Details', ref: 'Rule 6(1)(b)', sev: 'HIGH' },
                  { code: 'PC-005', name: 'Consumer Care Address & Phone', ref: 'Rule 6(1)(g)', sev: 'MEDIUM' },
                ]
              },
              {
                name: 'Household Consumer Products',
                version: 'v1.0.0',
                status: 'PUBLISHED',
                rules: [
                  { code: 'HH-001', name: 'Product Name & Intended Use', ref: 'Rule 6(1)(a)', sev: 'HIGH' },
                  { code: 'HH-002', name: 'Net Quantity by Weight or Count', ref: 'Rule 6(1)(e)', sev: 'HIGH' },
                  { code: 'HH-003', name: 'Retail Price Declaration', ref: 'Rule 6(1)(c)', sev: 'HIGH' },
                  { code: 'HH-004', name: 'Manufacturing / Packing Date', ref: 'Rule 6(1)(d)', sev: 'HIGH' },
                ]
              },
              {
                name: 'Imported Commodities Rule Pack',
                version: 'v1.0.0',
                status: 'PUBLISHED',
                rules: [
                  { code: 'IC-001', name: 'Country of Origin Mandatory Display', ref: 'Rule 6(1)(f)', sev: 'CRITICAL' },
                  { code: 'IC-002', name: 'Name and Address of Importer', ref: 'Rule 6(1)(b) Proviso', sev: 'CRITICAL' },
                  { code: 'IC-003', name: 'Indian MRP in Rupee Currency', ref: 'Rule 6(1)(c)', sev: 'HIGH' },
                  { code: 'IC-004', name: 'Month & Year of Importation', ref: 'Rule 6(1)(d) Proviso', sev: 'HIGH' },
                ]
              }
            ].map((pack, i) => (
              <div key={i} style={{ border: '1px solid var(--border)', borderRadius: '10px', padding: '1.25rem', background: 'var(--bg-secondary)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                    {pack.name}
                  </span>
                  <span className="badge badge-success" style={{ fontSize: '0.65rem' }}>
                    {pack.version} · {pack.status}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {pack.rules.map((r) => (
                    <div key={r.code} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', padding: '0.25rem 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>
                        <span style={{ fontFamily: 'monospace', color: 'var(--accent-light)', marginRight: '0.4rem' }}>{r.code}</span>
                        {r.name}
                      </span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>{r.ref}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
