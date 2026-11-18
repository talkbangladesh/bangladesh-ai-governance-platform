import { describe, expect, it } from "vitest";
import { isAssessmentEditable, isOwnedEvidenceReference, mayAccessReviewScope, mayManageAISystems, mayReadReviewerScope, mayUseAssessmentRole, mayUseParentContext, resolveAssessmentReviewStatus, scopeAllows, isValidEvidenceContent, buildResponseUpdate, parentOrganizationsMatch, mayGrantOrganizationAdmin, mayChangeOrganizationAdminRole } from "./agarasDb";
import { PROFILE_CONTROL_LIMITS, PROFILE_DOMAIN_COUNTS } from "./agarasCatalog";

describe("server authorization policy regressions (pure; no database/network)", () => {
  it("allows only owner/admin/contributor writes, not ordinary members or reviewers", () => {
    expect(mayManageAISystems({ owner: true })).toBe(true);
    for (const role of ["admin", "contributor"]) expect(mayManageAISystems({ owner: false, activeRole: role })).toBe(true);
    for (const role of ["member", "reviewer", "domain_reviewer", "evidence_reviewer", "auditor", "lead_reviewer"]) expect(mayManageAISystems({ owner: false, activeRole: role })).toBe(false);
  });
  it("denies invited, revoked, and declined reviewer access; full completed assignment is read-only", () => {
    for (const status of ["invited", "revoked", "declined"]) {
      expect(mayReadReviewerScope(status, "full")).toBe(false);
      expect(mayAccessReviewScope(status, "full", "controls")).toBe(false);
    }
    expect(mayReadReviewerScope("active", "full")).toBe(true);
    expect(mayReadReviewerScope("completed", "full")).toBe(true);
    expect(mayAccessReviewScope("completed", "full", "controls")).toBe(false);
  });
  it("isolates active assignment scopes to their authorized records/actions", () => {
    expect(mayAccessReviewScope("active", "full", "dashboard")).toBe(true);
    expect(mayAccessReviewScope("active", "domain", "controls", true)).toBe(true);
    expect(mayAccessReviewScope("active", "domain", "controls", false)).toBe(false);
    expect(mayAccessReviewScope("active", "findings", "findings")).toBe(true);
    expect(mayAccessReviewScope("active", "findings", "evidence")).toBe(false);
    expect(mayAccessReviewScope("active", "findings", "dashboard")).toBe(false);
    expect(mayAccessReviewScope("active", "evidence", "evidence")).toBe(true);
    expect(mayAccessReviewScope("active", "evidence", "findings")).toBe(false);
  });
  it("denies cross-organization assessment parents even when a caller is otherwise authorized", () => {
    expect(parentOrganizationsMatch(4, 4)).toBe(true);
    expect(parentOrganizationsMatch(4, 9)).toBe(false);
    expect(parentOrganizationsMatch(null, 9)).toBe(false);
    expect(parentOrganizationsMatch(4, undefined)).toBe(true);
    expect(mayUseParentContext({ assessmentOwner: false, organizationOwner: false, activeMember: true, parentsMatch: false })).toBe(false);
    expect(mayUseParentContext({ assessmentOwner: true, organizationOwner: false, activeMember: false, parentsMatch: true })).toBe(true);
    expect(mayUseParentContext({ assessmentOwner: false, organizationOwner: false, activeMember: true, parentsMatch: true })).toBe(true);
  });
  it("reserves organization admin grants for the organization owner", () => {
    expect(mayGrantOrganizationAdmin(true)).toBe(true);
    expect(mayGrantOrganizationAdmin(false)).toBe(false);
  });
  it("reserves organization admin grants and admin role changes for the organization owner", () => {
    expect(mayGrantOrganizationAdmin(false)).toBe(false);
    expect(mayChangeOrganizationAdminRole(false, "reviewer", "lead_reviewer")).toBe(true);
    expect(mayChangeOrganizationAdminRole(false, "reviewer", "admin")).toBe(false);
    expect(mayChangeOrganizationAdminRole(false, "admin", "reviewer")).toBe(false);
    expect(mayChangeOrganizationAdminRole(true, "reviewer", "admin")).toBe(true);
    expect(mayChangeOrganizationAdminRole(true, "admin", "reviewer")).toBe(true);
  });
  it("keeps organization review roles from gaining generic assessment reads", () => {
    for (const role of ["lead_reviewer", "reviewer", "domain_reviewer", "evidence_reviewer", "auditor"]) {
      expect(mayUseAssessmentRole(role)).toBe(false);
      expect(mayUseAssessmentRole(role, true)).toBe(false);
    }
    for (const role of ["owner", "admin", "contributor", "member"]) expect(mayUseAssessmentRole(role)).toBe(true);
    expect(mayUseAssessmentRole("member", true)).toBe(false);
  });
  it("enforces read-only completed assignments and exact evidence/findings/dashboard limits", () => {
    expect(scopeAllows("completed", "full", "events")).toBe(true);
    expect(scopeAllows("completed", "full", "controls")).toBe(false);
    expect(scopeAllows("active", "evidence", "evidence")).toBe(true);
    expect(scopeAllows("active", "evidence", "dashboard")).toBe(false);
    expect(scopeAllows("active", "findings", "findings")).toBe(true);
    expect(scopeAllows("active", "findings", "evidence")).toBe(false);
    expect(scopeAllows("active", "domain", "controls", false)).toBe(false);
    expect(scopeAllows("active", "domain", "findings", true)).toBe(true);
  });
  it("allows evidence-only reviewers to receive control summaries but not answer/report data", () => {
    expect(scopeAllows("active", "evidence", "controls")).toBe(true);
    expect(scopeAllows("active", "evidence", "evidence")).toBe(true);
    expect(scopeAllows("active", "evidence", "dashboard")).toBe(false);
    expect(scopeAllows("active", "evidence", "report")).toBe(false);
    expect(scopeAllows("completed", "evidence", "evidence")).toBe(false);
  });
  it("keeps profile control counts attainable and consistent with configured domains", () => {
    expect(PROFILE_CONTROL_LIMITS.individual * PROFILE_DOMAIN_COUNTS.individual).toBe(45);
    expect(PROFILE_CONTROL_LIMITS.organization * PROFILE_DOMAIN_COUNTS.organization).toBe(112);
    expect(PROFILE_CONTROL_LIMITS.enterprise * PROFILE_DOMAIN_COUNTS.enterprise).toBe(270);
    expect(PROFILE_CONTROL_LIMITS.government * PROFILE_DOMAIN_COUNTS.government).toBe(400);
    expect(PROFILE_CONTROL_LIMITS.national * PROFILE_DOMAIN_COUNTS.national).toBe(400);
  });
  it("does not let an answer save erase evidence-review status", () => {
    expect(buildResponseUpdate({ responseScore: 3, responseNotes: "updated" })).toEqual({ responseScore: 3, responseNotes: "updated" });
    expect(buildResponseUpdate({ responseScore: 3, evidenceStatus: "submitted" })).toEqual({ responseScore: 3, evidenceStatus: "submitted", responseNotes: undefined });
  });
  it("checks evidence bytes against their declared supported file type", () => {
    expect(isValidEvidenceContent("application/pdf", Buffer.from("%PDF-1.7\nbody"))).toBe(true);
    expect(isValidEvidenceContent("image/png", Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe(true);
    expect(isValidEvidenceContent("application/pdf", Buffer.from("not a PDF"))).toBe(false);
    expect(isValidEvidenceContent("text/plain", Buffer.from([0x41, 0x00, 0x42]))).toBe(false);
  });
  it("does not mark partial-scope review verified until all controls are approved", () => {
    expect(resolveAssessmentReviewStatus({ hasOpenAssignments: true, hasChanges: false, allControlsApproved: false })).toBe("review");
    expect(resolveAssessmentReviewStatus({ hasOpenAssignments: false, hasChanges: true, allControlsApproved: false })).toBe("changes_requested");
    expect(resolveAssessmentReviewStatus({ hasOpenAssignments: false, hasChanges: false, allControlsApproved: false })).toBe("submitted");
    expect(resolveAssessmentReviewStatus({ hasOpenAssignments: false, hasChanges: false, allControlsApproved: true })).toBe("verified");
  });
  it("permits editing only before submission or after requested changes", () => {
    for (const status of ["draft", "in_progress", "changes_requested"]) expect(isAssessmentEditable(status)).toBe(true);
    for (const status of ["submitted", "review", "verified", "complete", "closed", "unknown"]) expect(isAssessmentEditable(status)).toBe(false);
  });
  it("binds evidence metadata references to the authenticated user's assessment namespace", () => {
    const own = { userId: 7, assessmentId: 12, storageKey: "agaras/7/12/report-a1b2.pdf", storageUrl: "/manus-storage/agaras/7/12/report-a1b2.pdf" };
    expect(isOwnedEvidenceReference(own)).toBe(true);
    expect(isOwnedEvidenceReference({ ...own, storageKey: "agaras/8/12/report-a1b2.pdf", storageUrl: "/manus-storage/agaras/8/12/report-a1b2.pdf" })).toBe(false);
    expect(isOwnedEvidenceReference({ ...own, storageKey: "agaras/7/99/report-a1b2.pdf", storageUrl: "/manus-storage/agaras/7/99/report-a1b2.pdf" })).toBe(false);
    expect(isOwnedEvidenceReference({ ...own, storageKey: "agaras/7/12/nested/report.pdf", storageUrl: "/manus-storage/agaras/7/12/nested/report.pdf" })).toBe(false);
    expect(isOwnedEvidenceReference({ ...own, storageUrl: "https://attacker.example/report.pdf" })).toBe(false);
  });
});
