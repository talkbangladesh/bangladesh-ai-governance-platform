import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { reportSnapshot } from "./agarasDb";
import { ATLAS_DISCLAIMER, SELF_REPORTED_NOTICE } from "@shared/bangladesh";

function asText(value: unknown) {
  if (value === null || value === undefined) return "";
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

export async function buildPdfReport(assessmentId: number, userId: number) {
  const report = await reportSnapshot(assessmentId, userId);
  if (!report) return undefined;
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 48, info: { Title: `Bangladesh AI Readiness Assessment Report — ${report.assessment.title}` } });
    const chunks: Buffer[] = [];
    doc.on("data", chunk => chunks.push(Buffer.from(chunk)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.fontSize(22).fillColor("#123B36").text("Bangladesh AI Readiness Assessment Report");
    doc.moveDown(0.3).fontSize(10).fillColor("#667085").text("Bangladesh AI Readiness Assessment System");
    doc.moveDown(1).fontSize(15).fillColor("#123B36").text(asText(report.assessment.title));
    doc.fontSize(10).fillColor("#667085").text(`Methodology: ${asText(report.methodology)} · Verification: ${asText(report.verification)}`);
    doc.moveDown(1).fontSize(12).fillColor("#123B36").text(`Readiness score: ${asText(report.assessment.score)} / 100`);
    doc.text(`Evidence coverage: ${asText(report.assessment.evidenceCoverage)}%`);
    doc.moveDown(1).fontSize(14).text("Controls");
    for (const row of report.controls as Array<{ control?: { code?: string; title?: string; objective?: string }; assignment?: { responseScore?: number | null; evidenceStatus?: string } }>) {
      doc.moveDown(0.35).fontSize(9).fillColor("#123B36").text(`${asText(row.control?.code)} — ${asText(row.control?.title)}`);
      doc.fontSize(8).fillColor("#667085").text(`Score: ${asText(row.assignment?.responseScore ?? "Not answered")} · Evidence: ${asText(row.assignment?.evidenceStatus)}`);
    }
    doc.moveDown(1).fontSize(14).fillColor("#123B36").text("Findings");
    if (!report.findings.length) doc.fontSize(9).fillColor("#667085").text("No findings recorded.");
    for (const finding of report.findings) doc.moveDown(0.35).fontSize(9).fillColor("#123B36").text(`${asText(finding.title)} · ${asText(finding.severity)} · ${asText(finding.status)}`);
    doc.moveDown(1).fontSize(8).fillColor("#667085").text(`${SELF_REPORTED_NOTICE} ${ATLAS_DISCLAIMER}`);
    doc.end();
  });
}

export async function buildExcelReport(assessmentId: number, userId: number) {
  const report = await reportSnapshot(assessmentId, userId);
  if (!report) return undefined;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Bangladesh AI Readiness Assessment";
  const summary = workbook.addWorksheet("Summary");
  summary.addRows([
    ["Bangladesh AI Readiness Assessment Report"],
    ["Assessment", report.assessment.title],
    ["Methodology", report.methodology],
    ["Verification", report.verification],
    ["Readiness score", Number(report.assessment.score)],
    ["Evidence coverage", Number(report.assessment.evidenceCoverage)],
    ["Notice", SELF_REPORTED_NOTICE],
    ["Disclaimer", ATLAS_DISCLAIMER],
  ]);
  summary.getColumn(1).width = 24;
  summary.getColumn(2).width = 60;
  const controls = workbook.addWorksheet("Controls");
  controls.columns = [
    { header: "Code", key: "code", width: 16 }, { header: "Title", key: "title", width: 44 },
    { header: "Score", key: "score", width: 12 }, { header: "Evidence status", key: "evidence", width: 20 },
  ];
  for (const row of report.controls as Array<{ control?: { code?: string; title?: string }; assignment?: { responseScore?: number | null; evidenceStatus?: string } }>) controls.addRow({ code: row.control?.code, title: row.control?.title, score: row.assignment?.responseScore ?? "", evidence: row.assignment?.evidenceStatus });
  const findings = workbook.addWorksheet("Findings");
  findings.columns = [{ header: "Title", key: "title", width: 44 }, { header: "Severity", key: "severity", width: 16 }, { header: "Status", key: "status", width: 18 }, { header: "Recommendation", key: "recommendation", width: 70 }];
  for (const finding of report.findings) findings.addRow(finding);
  for (const sheet of [summary, controls, findings]) sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } }, sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF172337" } };
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
