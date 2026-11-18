import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, boolean, decimal, index, unique } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const organizations = mysqlTable("organizations", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 120 }).notNull().unique(),
  sector: varchar("sector", { length: 120 }),
  jurisdiction: varchar("jurisdiction", { length: 120 }),
  ownerId: int("ownerId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => ({ ownerIdx: index("organizations_owner_idx").on(table.ownerId) }));

export const organizationMembers = mysqlTable("organization_members", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  userId: int("userId").notNull(),
  role: mysqlEnum("role", ["owner", "admin", "lead_reviewer", "reviewer", "domain_reviewer", "evidence_reviewer", "auditor", "contributor", "member"]).default("member").notNull(),
  status: mysqlEnum("status", ["invited", "active", "revoked"]).default("active").notNull(),
  invitedBy: int("invitedBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => ({ memberUnique: unique("organization_member_unique").on(table.organizationId, table.userId) }));

export const reviewerAssignments = mysqlTable("reviewer_assignments", {
  id: int("id").autoincrement().primaryKey(),
  assessmentId: int("assessmentId").notNull(),
  reviewerId: int("reviewerId").notNull(),
  assignedBy: int("assignedBy").notNull(),
  scope: mysqlEnum("scope", ["full", "evidence", "findings", "domain"]).default("full").notNull(),
  domainId: int("domainId"),
  status: mysqlEnum("status", ["invited", "active", "completed", "declined", "revoked"]).default("invited").notNull(),
  notes: text("notes"),
  assignedAt: timestamp("assignedAt").defaultNow().notNull(),
  acceptedAt: timestamp("acceptedAt"),
  declinedAt: timestamp("declinedAt"),
  completedAt: timestamp("completedAt"),
}, table => ({ assessmentIdx: index("reviewer_assignments_assessment_idx").on(table.assessmentId), reviewerIdx: index("reviewer_assignments_reviewer_idx").on(table.reviewerId), assignmentUnique: unique("reviewer_assignment_unique").on(table.assessmentId, table.reviewerId) }));

export const externalReviewerInvites = mysqlTable("external_reviewer_invites", {
  id: int("id").autoincrement().primaryKey(),
  assessmentId: int("assessmentId").notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  tokenHash: varchar("tokenHash", { length: 64 }).notNull().unique(),
  scope: mysqlEnum("scope", ["full", "evidence", "findings", "domain"]).default("full").notNull(),
  domainId: int("domainId"),
  notes: text("notes"),
  invitedBy: int("invitedBy").notNull(),
  status: mysqlEnum("status", ["pending", "accepted", "declined", "expired", "revoked"]).default("pending").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  acceptedBy: int("acceptedBy"),
  acceptedAt: timestamp("acceptedAt"),
  declinedAt: timestamp("declinedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => ({ assessmentIdx: index("external_invites_assessment_idx").on(table.assessmentId), emailIdx: index("external_invites_email_idx").on(table.email), statusIdx: index("external_invites_status_idx").on(table.status) }));

export const reviewEvents = mysqlTable("review_events", {
  id: int("id").autoincrement().primaryKey(),
  assessmentId: int("assessmentId").notNull(),
  reviewerAssignmentId: int("reviewerAssignmentId"),
  actorId: int("actorId").notNull(),
  entityType: mysqlEnum("entityType", ["assessment", "control", "evidence", "finding"]).notNull(),
  entityId: int("entityId"),
  eventType: mysqlEnum("eventType", ["comment", "approve", "reject", "request_changes", "status_change"]).notNull(),
  message: text("message"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => ({ assessmentIdx: index("review_events_assessment_idx").on(table.assessmentId), actorIdx: index("review_events_actor_idx").on(table.actorId) }));

export const domains = mysqlTable("domains", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 16 }).notNull().unique(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  sortOrder: int("sortOrder").notNull(),
  active: boolean("active").default(true).notNull(),
});

export const controls = mysqlTable("controls", {
  id: int("id").autoincrement().primaryKey(),
  domainId: int("domainId").notNull(),
  code: varchar("code", { length: 32 }).notNull().unique(),
  title: varchar("title", { length: 255 }).notNull(),
  objective: text("objective"),
  evidenceRequirement: text("evidenceRequirement"),
  applicability: text("applicability"),
  weight: decimal("weight", { precision: 8, scale: 2 }).default("1.00").notNull(),
  version: varchar("version", { length: 32 }).default("GAAF-1.0").notNull(),
  active: boolean("active").default(true).notNull(),
  sourceRefs: varchar("sourceRefs", { length: 500 }),
  lifecycleStage: varchar("lifecycleStage", { length: 64 }).default("all").notNull(),
  controlType: varchar("controlType", { length: 64 }).default("governance").notNull(),
  criticality: mysqlEnum("criticality", ["low", "moderate", "high", "critical"]).default("moderate").notNull(),
}, table => ({ domainIdx: index("controls_domain_idx").on(table.domainId) }));

export const assessments = mysqlTable("assessments", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  organizationId: int("organizationId"),
  profileType: mysqlEnum("profileType", ["individual", "organization", "enterprise", "government", "national"]).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  jurisdiction: varchar("jurisdiction", { length: 120 }),
  sector: varchar("sector", { length: 120 }),
  posture: mysqlEnum("posture", ["self_assessment", "evidence_audit", "expert_review"]).default("self_assessment").notNull(),
  status: mysqlEnum("status", ["draft", "in_progress", "submitted", "review", "changes_requested", "verified", "complete", "closed"]).default("draft").notNull(),
  score: decimal("score", { precision: 6, scale: 2 }).default("0.00").notNull(),
  evidenceCoverage: decimal("evidenceCoverage", { precision: 6, scale: 2 }).default("0.00").notNull(),
  methodologyVersion: varchar("methodologyVersion", { length: 32 }).default("GAAF-1.0").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => ({ userIdx: index("assessments_user_idx").on(table.userId), orgIdx: index("assessments_org_idx").on(table.organizationId) }));

export const assessmentControls = mysqlTable("assessment_controls", {
  id: int("id").autoincrement().primaryKey(),
  assessmentId: int("assessmentId").notNull(),
  controlId: int("controlId").notNull(),
  responseScore: int("responseScore"),
  evidenceStatus: mysqlEnum("evidenceStatus", ["not_requested", "missing", "submitted", "verified", "rejected"]).default("not_requested").notNull(),
  responseNotes: text("responseNotes"),
  reviewedBy: int("reviewedBy"),
  reviewedAt: timestamp("reviewedAt"),
  reviewDecision: mysqlEnum("reviewDecision", ["pending", "approved", "rejected", "changes_requested"]).default("pending").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => ({ assessmentControlUnique: unique("assessment_control_unique").on(table.assessmentId, table.controlId), assessmentIdx: index("assessment_controls_assessment_idx").on(table.assessmentId) }));

export const evidence = mysqlTable("evidence", {
  id: int("id").autoincrement().primaryKey(),
  assessmentId: int("assessmentId").notNull(),
  controlId: int("controlId"),
  uploadedBy: int("uploadedBy").notNull(),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  storageKey: varchar("storageKey", { length: 500 }).notNull(),
  storageUrl: varchar("storageUrl", { length: 700 }).notNull(),
  mimeType: varchar("mimeType", { length: 120 }),
  fileSize: int("fileSize"),
  verificationStatus: mysqlEnum("verificationStatus", ["pending", "verified", "rejected"]).default("pending").notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => ({ assessmentIdx: index("evidence_assessment_idx").on(table.assessmentId) }));

export const findings = mysqlTable("findings", {
  id: int("id").autoincrement().primaryKey(),
  assessmentId: int("assessmentId").notNull(),
  controlId: int("controlId"),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  recommendation: text("recommendation"),
  severity: mysqlEnum("severity", ["low", "moderate", "high", "critical"]).default("moderate").notNull(),
  status: mysqlEnum("status", ["open", "accepted", "in_progress", "resolved", "waived"]).default("open").notNull(),
  ownerId: int("ownerId"),
  dueDate: timestamp("dueDate"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => ({ assessmentIdx: index("findings_assessment_idx").on(table.assessmentId) }));

export const aiSystems = mysqlTable("ai_systems", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId"),
  assessmentId: int("assessmentId"),
  name: varchar("name", { length: 255 }).notNull(),
  provider: varchar("provider", { length: 255 }),
  purpose: text("purpose"),
  decisionImpact: varchar("decisionImpact", { length: 80 }),
  humanOversight: varchar("humanOversight", { length: 80 }),
  lifecycleStatus: varchar("lifecycleStatus", { length: 80 }).default("discovery").notNull(),
  riskLevel: mysqlEnum("riskLevel", ["low", "moderate", "high", "critical"]).default("moderate").notNull(),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const actionItems = mysqlTable("action_items", {
  id: int("id").autoincrement().primaryKey(),
  assessmentId: int("assessmentId").notNull(),
  findingId: int("findingId"),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  ownerId: int("ownerId"),
  dueDate: timestamp("dueDate"),
  status: mysqlEnum("status", ["planned", "in_progress", "blocked", "done"]).default("planned").notNull(),
  priority: mysqlEnum("priority", ["low", "medium", "high"]).default("medium").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const reports = mysqlTable("reports", {
  id: int("id").autoincrement().primaryKey(),
  assessmentId: int("assessmentId").notNull(),
  type: mysqlEnum("type", ["individual", "organizational", "government", "national"]).notNull(),
  format: mysqlEnum("format", ["pdf", "excel", "json"]).notNull(),
  status: mysqlEnum("status", ["queued", "generating", "ready", "failed"]).default("queued").notNull(),
  storageUrl: varchar("storageUrl", { length: 700 }),
  generatedBy: int("generatedBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Assessment = typeof assessments.$inferSelect;
export type Domain = typeof domains.$inferSelect;
export type Control = typeof controls.$inferSelect;

export const observatorySources = mysqlTable("observatory_sources", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  publisher: varchar("publisher", { length: 255 }).notNull(),
  url: varchar("url", { length: 700 }).notNull(),
  description: text("description"),
  active: boolean("active").default(true).notNull(),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => ({ nameIdx: index("observatory_sources_name_idx").on(table.name) }));

export const observatoryIndicators = mysqlTable("observatory_indicators", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 48 }).notNull().unique(),
  title: varchar("title", { length: 255 }).notNull(),
  domain: varchar("domain", { length: 120 }).notNull(),
  definition: text("definition").notNull(),
  unit: varchar("unit", { length: 80 }),
  methodologyVersion: varchar("methodologyVersion", { length: 48 }).notNull(),
  active: boolean("active").default(true).notNull(),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => ({ domainIdx: index("observatory_indicators_domain_idx").on(table.domain) }));

export const observatoryObservations = mysqlTable("observatory_observations", {
  id: int("id").autoincrement().primaryKey(),
  indicatorId: int("indicatorId").notNull(),
  sourceId: int("sourceId").notNull(),
  value: decimal("value", { precision: 18, scale: 6 }),
  valueLabel: varchar("valueLabel", { length: 255 }),
  observationDate: timestamp("observationDate").notNull(),
  periodLabel: varchar("periodLabel", { length: 120 }),
  notes: text("notes"),
  methodologyVersion: varchar("methodologyVersion", { length: 48 }).notNull(),
  status: mysqlEnum("status", ["draft", "published", "archived"]).default("draft").notNull(),
  createdBy: int("createdBy").notNull(),
  publishedBy: int("publishedBy"),
  publishedAt: timestamp("publishedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => ({ indicatorIdx: index("observatory_observations_indicator_idx").on(table.indicatorId), sourceIdx: index("observatory_observations_source_idx").on(table.sourceId), publicIdx: index("observatory_observations_status_date_idx").on(table.status, table.observationDate) }));
