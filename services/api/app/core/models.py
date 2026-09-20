import uuid
import enum
from datetime import datetime, timezone
from sqlalchemy import (
    String, Text, Enum, ForeignKey, DateTime, Boolean,
    Integer, Float, JSON, Index, Uuid as UUID
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


def utcnow():
    return datetime.now(timezone.utc)


def new_uuid():
    return str(uuid.uuid4())


# ─────────────────────────────────────────────
# Enums
# ─────────────────────────────────────────────

class UserStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    SUSPENDED = "SUSPENDED"


class RoleName(str, enum.Enum):
    INSPECTOR = "INSPECTOR"
    SUPERVISOR = "SUPERVISOR"
    MANUFACTURER = "MANUFACTURER"
    ADMIN = "ADMIN"


class InspectionMode(str, enum.Enum):
    INSPECTION = "INSPECTION"
    PRE_SCREENING = "PRE_SCREENING"
    ECOMMERCE_AUDIT = "ECOMMERCE_AUDIT"


class InspectionStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    IMAGES_UPLOADED = "IMAGES_UPLOADED"
    PROCESSING = "PROCESSING"
    REVIEW_REQUIRED = "REVIEW_REQUIRED"
    FINALIZED = "FINALIZED"
    FAILED = "FAILED"


class FinalStatus(str, enum.Enum):
    COMPLIANT = "COMPLIANT"
    NON_COMPLIANT = "NON_COMPLIANT"
    REVIEW_REQUIRED = "REVIEW_REQUIRED"
    PENDING = "PENDING"


class ImageViewType(str, enum.Enum):
    FRONT = "FRONT"
    BACK = "BACK"
    SIDE = "SIDE"
    MRP_STICKER = "MRP_STICKER"
    OTHER = "OTHER"


class QualityStatus(str, enum.Enum):
    PASS = "PASS"
    WARNING = "WARNING"
    RETAKE = "RETAKE"
    PENDING = "PENDING"


class FindingStatus(str, enum.Enum):
    PASS = "PASS"
    WARNING = "WARNING"
    VIOLATION = "VIOLATION"
    REVIEW_REQUIRED = "REVIEW_REQUIRED"
    MANUAL_VERIFICATION_REQUIRED = "MANUAL_VERIFICATION_REQUIRED"
    NOT_APPLICABLE = "NOT_APPLICABLE"


class Severity(str, enum.Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"
    VIOLATION = "VIOLATION"
    WARNING = "WARNING"


class ReviewDecision(str, enum.Enum):
    ACCEPT = "ACCEPT"
    CORRECT = "CORRECT"
    REJECT = "REJECT"


class RulePackStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    PUBLISHED = "PUBLISHED"
    DEPRECATED = "DEPRECATED"


class JobStatus(str, enum.Enum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


# ─────────────────────────────────────────────
# Models
# ─────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=new_uuid)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    full_name: Mapped[str | None] = mapped_column(String(255))
    status: Mapped[UserStatus] = mapped_column(Enum(UserStatus), default=UserStatus.ACTIVE)
    organisation: Mapped[str | None] = mapped_column(String(255))
    supabase_uid: Mapped[str | None] = mapped_column(String(255), unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    user_roles: Mapped[list["UserRole"]] = relationship("UserRole", back_populates="user", cascade="all, delete-orphan")
    inspections: Mapped[list["Inspection"]] = relationship("Inspection", back_populates="user")
    audit_logs: Mapped[list["AuditLog"]] = relationship("AuditLog", back_populates="actor")


class Role(Base):
    __tablename__ = "roles"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=new_uuid)
    name: Mapped[RoleName] = mapped_column(Enum(RoleName), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)

    user_roles: Mapped[list["UserRole"]] = relationship("UserRole", back_populates="role")


class UserRole(Base):
    __tablename__ = "user_roles"

    user_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    role_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True)
    assigned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    user: Mapped["User"] = relationship("User", back_populates="user_roles")
    role: Mapped["Role"] = relationship("Role", back_populates="user_roles")


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=new_uuid)
    code: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    name_en: Mapped[str] = mapped_column(String(255), nullable=False)
    name_hi: Mapped[str | None] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text)
    is_import_category: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    rule_packs: Mapped[list["RulePack"]] = relationship("RulePack", back_populates="category")
    inspections: Mapped[list["Inspection"]] = relationship("Inspection", back_populates="category")


class RulePack(Base):
    __tablename__ = "rule_packs"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=new_uuid)
    category_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("categories.id"), nullable=False)
    version: Mapped[str] = mapped_column(String(50), nullable=False)
    status: Mapped[RulePackStatus] = mapped_column(Enum(RulePackStatus), default=RulePackStatus.DRAFT)
    effective_from: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    legal_source: Mapped[str | None] = mapped_column(Text)
    source_url: Mapped[str | None] = mapped_column(String(500))
    gazette_ref: Mapped[str | None] = mapped_column(String(255))
    pack_json: Mapped[dict | None] = mapped_column(JSON)
    published_by: Mapped[str | None] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id"))
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    category: Mapped["Category"] = relationship("Category", back_populates="rule_packs")
    rules: Mapped[list["Rule"]] = relationship("Rule", back_populates="rule_pack", cascade="all, delete-orphan")
    inspections: Mapped[list["Inspection"]] = relationship("Inspection", back_populates="rule_pack")


class Rule(Base):
    __tablename__ = "rules"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=new_uuid)
    rule_pack_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("rule_packs.id", ondelete="CASCADE"), nullable=False)
    code: Mapped[str] = mapped_column(String(100), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    legal_ref: Mapped[str | None] = mapped_column(String(500))
    severity: Mapped[Severity] = mapped_column(Enum(Severity), default=Severity.HIGH)
    check_type: Mapped[str] = mapped_column(String(100), nullable=False)
    field_code: Mapped[str | None] = mapped_column(String(100))
    config_json: Mapped[dict | None] = mapped_column(JSON)
    applies_when: Mapped[str] = mapped_column(String(100), default="always")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    cannot_check: Mapped[list | None] = mapped_column(JSON)

    rule_pack: Mapped["RulePack"] = relationship("RulePack", back_populates="rules")
    findings: Mapped[list["Finding"]] = relationship("Finding", back_populates="rule")


class Inspection(Base):
    __tablename__ = "inspections"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=new_uuid)
    user_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=False)
    category_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("categories.id"), nullable=False)
    rule_pack_id: Mapped[str | None] = mapped_column(UUID(as_uuid=False), ForeignKey("rule_packs.id"))
    mode: Mapped[InspectionMode] = mapped_column(Enum(InspectionMode), default=InspectionMode.INSPECTION)
    status: Mapped[InspectionStatus] = mapped_column(Enum(InspectionStatus), default=InspectionStatus.DRAFT, index=True)
    final_status: Mapped[FinalStatus] = mapped_column(Enum(FinalStatus), default=FinalStatus.PENDING)
    product_name: Mapped[str | None] = mapped_column(String(500))
    product_notes: Mapped[str | None] = mapped_column(Text)
    source_info: Mapped[str | None] = mapped_column(Text)
    is_imported: Mapped[bool] = mapped_column(Boolean, default=False)
    finalized_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    user: Mapped["User"] = relationship("User", back_populates="inspections")
    category: Mapped["Category"] = relationship("Category", back_populates="inspections")
    rule_pack: Mapped["RulePack"] = relationship("RulePack", back_populates="inspections")
    images: Mapped[list["InspectionImage"]] = relationship("InspectionImage", back_populates="inspection", cascade="all, delete-orphan")
    extracted_fields: Mapped[list["ExtractedField"]] = relationship("ExtractedField", back_populates="inspection", cascade="all, delete-orphan")
    findings: Mapped[list["Finding"]] = relationship("Finding", back_populates="inspection", cascade="all, delete-orphan")
    reports: Mapped[list["Report"]] = relationship("Report", back_populates="inspection")
    analysis_jobs: Mapped[list["AnalysisJob"]] = relationship("AnalysisJob", back_populates="inspection", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_inspections_status_created", "status", "created_at"),
        Index("ix_inspections_category_created", "category_id", "created_at"),
    )


class InspectionImage(Base):
    __tablename__ = "inspection_images"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=new_uuid)
    inspection_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("inspections.id", ondelete="CASCADE"), nullable=False, index=True)
    storage_key: Mapped[str] = mapped_column(String(500), nullable=False)
    file_name: Mapped[str | None] = mapped_column(String(255))
    mime_type: Mapped[str | None] = mapped_column(String(100))
    file_size_bytes: Mapped[int | None] = mapped_column(Integer)
    view_type: Mapped[ImageViewType] = mapped_column(Enum(ImageViewType), default=ImageViewType.FRONT)
    quality_status: Mapped[QualityStatus] = mapped_column(Enum(QualityStatus), default=QualityStatus.PENDING)
    quality_checks: Mapped[dict | None] = mapped_column(JSON)
    width_px: Mapped[int | None] = mapped_column(Integer)
    height_px: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    inspection: Mapped["Inspection"] = relationship("Inspection", back_populates="images")
    extracted_fields: Mapped[list["ExtractedField"]] = relationship("ExtractedField", back_populates="source_image")
    evidence_regions: Mapped[list["EvidenceRegion"]] = relationship("EvidenceRegion", back_populates="image")


class ExtractedField(Base):
    __tablename__ = "extracted_fields"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=new_uuid)
    inspection_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("inspections.id", ondelete="CASCADE"), nullable=False, index=True)
    source_image_id: Mapped[str | None] = mapped_column(UUID(as_uuid=False), ForeignKey("inspection_images.id"))
    field_code: Mapped[str] = mapped_column(String(100), nullable=False)
    raw_value: Mapped[str | None] = mapped_column(Text)
    normalized_value: Mapped[str | None] = mapped_column(Text)
    parsed_data: Mapped[dict | None] = mapped_column(JSON)
    confidence: Mapped[float | None] = mapped_column(Float)
    is_reviewed: Mapped[bool] = mapped_column(Boolean, default=False)
    reviewer_correction: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    inspection: Mapped["Inspection"] = relationship("Inspection", back_populates="extracted_fields")
    source_image: Mapped["InspectionImage"] = relationship("InspectionImage", back_populates="extracted_fields")


class Finding(Base):
    __tablename__ = "findings"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=new_uuid)
    inspection_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("inspections.id", ondelete="CASCADE"), nullable=False, index=True)
    rule_id: Mapped[str | None] = mapped_column(UUID(as_uuid=False), ForeignKey("rules.id"))
    status: Mapped[FindingStatus] = mapped_column(Enum(FindingStatus), nullable=False)
    severity: Mapped[Severity | None] = mapped_column(Enum(Severity))
    confidence: Mapped[float | None] = mapped_column(Float)
    message: Mapped[str | None] = mapped_column(Text)
    field_code: Mapped[str | None] = mapped_column(String(100))
    ai_raw_value: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    inspection: Mapped["Inspection"] = relationship("Inspection", back_populates="findings")
    rule: Mapped["Rule"] = relationship("Rule", back_populates="findings")
    evidence_regions: Mapped[list["EvidenceRegion"]] = relationship("EvidenceRegion", back_populates="finding", cascade="all, delete-orphan")
    review_task: Mapped["ReviewTask | None"] = relationship("ReviewTask", back_populates="finding", uselist=False)

    __table_args__ = (
        Index("ix_findings_inspection_status", "inspection_id", "status"),
    )


class EvidenceRegion(Base):
    __tablename__ = "evidence_regions"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=new_uuid)
    finding_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("findings.id", ondelete="CASCADE"), nullable=False)
    image_id: Mapped[str | None] = mapped_column(UUID(as_uuid=False), ForeignKey("inspection_images.id"))
    x: Mapped[float | None] = mapped_column(Float)
    y: Mapped[float | None] = mapped_column(Float)
    width: Mapped[float | None] = mapped_column(Float)
    height: Mapped[float | None] = mapped_column(Float)
    snippet_key: Mapped[str | None] = mapped_column(String(500))
    source_text: Mapped[str | None] = mapped_column(Text)

    finding: Mapped["Finding"] = relationship("Finding", back_populates="evidence_regions")
    image: Mapped["InspectionImage"] = relationship("InspectionImage", back_populates="evidence_regions")


class ReviewTask(Base):
    __tablename__ = "review_tasks"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=new_uuid)
    finding_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("findings.id", ondelete="CASCADE"), unique=True, nullable=False)
    reviewer_id: Mapped[str | None] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id"))
    decision: Mapped[ReviewDecision | None] = mapped_column(Enum(ReviewDecision))
    corrected_value: Mapped[str | None] = mapped_column(Text)
    note: Mapped[str | None] = mapped_column(Text)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    finding: Mapped["Finding"] = relationship("Finding", back_populates="review_task")


class AnalysisJob(Base):
    __tablename__ = "analysis_jobs"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=new_uuid)
    inspection_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("inspections.id", ondelete="CASCADE"), nullable=False, index=True)
    status: Mapped[JobStatus] = mapped_column(Enum(JobStatus), default=JobStatus.PENDING)
    attempt: Mapped[int] = mapped_column(Integer, default=0)
    error_message: Mapped[str | None] = mapped_column(Text)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    inspection: Mapped["Inspection"] = relationship("Inspection", back_populates="analysis_jobs")


class Report(Base):
    __tablename__ = "reports"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=new_uuid)
    inspection_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("inspections.id", ondelete="CASCADE"), nullable=False, index=True)
    storage_key: Mapped[str] = mapped_column(String(500), nullable=False)
    generated_by: Mapped[str | None] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id"))
    file_size_bytes: Mapped[int | None] = mapped_column(Integer)

    # ── Metadata (populated at generation time for fast listing) ──
    product_name: Mapped[str | None] = mapped_column(String(500))
    category_name: Mapped[str | None] = mapped_column(String(255))
    final_status: Mapped[str | None] = mapped_column(String(50))      # COMPLIANT / NON_COMPLIANT / REVIEW_REQUIRED
    violation_count: Mapped[int] = mapped_column(Integer, default=0)
    warning_count: Mapped[int] = mapped_column(Integer, default=0)
    extracted_field_count: Mapped[int] = mapped_column(Integer, default=0)
    download_count: Mapped[int] = mapped_column(Integer, default=0)   # total times downloaded
    notice_ref: Mapped[str | None] = mapped_column(String(100))       # e.g. METRA/2026/ABC12345
    report_summary: Mapped[dict | None] = mapped_column(JSON)         # structured snapshot for future lookup

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)

    inspection: Mapped["Inspection"] = relationship("Inspection", back_populates="reports")
    downloads: Mapped[list["ReportDownload"]] = relationship("ReportDownload", back_populates="report", cascade="all, delete-orphan")
    generator: Mapped["User | None"] = relationship("User", foreign_keys=[generated_by])

    __table_args__ = (
        Index("ix_reports_generated_by_created", "generated_by", "created_at"),
    )


class ReportDownload(Base):
    """Audit trail — one row per download event, per user."""
    __tablename__ = "report_downloads"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=new_uuid)
    report_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("reports.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[str | None] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id"))
    ip_address: Mapped[str | None] = mapped_column(String(50))
    user_agent: Mapped[str | None] = mapped_column(String(500))
    downloaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)

    report: Mapped["Report"] = relationship("Report", back_populates="downloads")
    user: Mapped["User | None"] = relationship("User")

    __table_args__ = (
        Index("ix_report_downloads_user_report", "user_id", "report_id"),
    )


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=new_uuid)
    actor_id: Mapped[str | None] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id"))
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    entity_type: Mapped[str | None] = mapped_column(String(100))
    entity_id: Mapped[str | None] = mapped_column(String(255))
    metadata_json: Mapped[dict | None] = mapped_column(JSON)
    ip_address: Mapped[str | None] = mapped_column(String(50))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)

    actor: Mapped["User"] = relationship("User", back_populates="audit_logs")

    __table_args__ = (
        Index("ix_audit_entity_created", "entity_type", "entity_id", "created_at"),
    )
