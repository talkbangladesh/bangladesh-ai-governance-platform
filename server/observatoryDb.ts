import { and, desc, eq } from "drizzle-orm";
import { observatoryIndicators, observatoryObservations, observatorySources } from "../drizzle/schema";
import { getDb } from "./db";

export async function getPublicObservatory() {
  const db = await getDb();
  if (!db) throw new Error("Observatory data service is unavailable");
  const [indicators, observations] = await Promise.all([
    db.select().from(observatoryIndicators).where(eq(observatoryIndicators.active, true)).orderBy(observatoryIndicators.code),
    db.select({ observation: observatoryObservations, indicator: observatoryIndicators, source: observatorySources })
      .from(observatoryObservations)
      .innerJoin(observatoryIndicators, eq(observatoryObservations.indicatorId, observatoryIndicators.id))
      .innerJoin(observatorySources, eq(observatoryObservations.sourceId, observatorySources.id))
      .where(and(eq(observatoryObservations.status, "published"), eq(observatoryIndicators.active, true), eq(observatorySources.active, true)))
      .orderBy(desc(observatoryObservations.observationDate), desc(observatoryObservations.createdAt)),
  ]);
  return { indicators, observations };
}

export async function getObservatoryAdminData() {
  const db = await getDb();
  if (!db) throw new Error("Observatory curation service is unavailable");
  const [sources, indicators, observations] = await Promise.all([
    db.select().from(observatorySources).orderBy(desc(observatorySources.createdAt)),
    db.select().from(observatoryIndicators).orderBy(observatoryIndicators.code),
    db.select({ observation: observatoryObservations, indicator: observatoryIndicators, source: observatorySources })
      .from(observatoryObservations)
      .innerJoin(observatoryIndicators, eq(observatoryObservations.indicatorId, observatoryIndicators.id))
      .innerJoin(observatorySources, eq(observatoryObservations.sourceId, observatorySources.id))
      .orderBy(desc(observatoryObservations.createdAt)),
  ]);
  return { sources, indicators, observations };
}

export async function createObservatorySource(input: { name: string; publisher: string; url: string; description?: string; userId: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const [result] = await db.insert(observatorySources).values({ name: input.name, publisher: input.publisher, url: input.url, description: input.description, createdBy: input.userId });
  const [row] = await db.select().from(observatorySources).where(eq(observatorySources.id, Number(result.insertId))).limit(1);
  return row;
}

export async function createObservatoryIndicator(input: { code: string; title: string; domain: string; definition: string; unit?: string; methodologyVersion: string; userId: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const [result] = await db.insert(observatoryIndicators).values({ code: input.code, title: input.title, domain: input.domain, definition: input.definition, unit: input.unit, methodologyVersion: input.methodologyVersion, createdBy: input.userId });
  const [row] = await db.select().from(observatoryIndicators).where(eq(observatoryIndicators.id, Number(result.insertId))).limit(1);
  return row;
}

export async function createObservatoryObservation(input: { indicatorId: number; sourceId: number; value?: string; valueLabel?: string; observationDate: Date; periodLabel?: string; notes?: string; methodologyVersion: string; publish: boolean; userId: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const [indicator] = await db.select().from(observatoryIndicators).where(and(eq(observatoryIndicators.id, input.indicatorId), eq(observatoryIndicators.active, true))).limit(1);
  const [source] = await db.select().from(observatorySources).where(and(eq(observatorySources.id, input.sourceId), eq(observatorySources.active, true))).limit(1);
  if (!indicator || !source) throw new Error("Select an active indicator and source");
  const numericValue = input.value !== undefined;
  const textValue = Boolean(input.valueLabel?.trim());
  if (numericValue === textValue) throw new Error("Provide exactly one numeric value or a text label");
  if (numericValue && (!Number.isFinite(Number(input.value)) || Math.abs(Number(input.value)) > 999999999999.999999)) throw new Error("Numeric value exceeds the supported decimal precision");
  const status = input.publish ? "published" as const : "draft" as const;
  const [result] = await db.insert(observatoryObservations).values({
    indicatorId: input.indicatorId, sourceId: input.sourceId, value: input.value, valueLabel: input.valueLabel,
    observationDate: input.observationDate, periodLabel: input.periodLabel, notes: input.notes,
    methodologyVersion: input.methodologyVersion, status, createdBy: input.userId,
    publishedBy: input.publish ? input.userId : undefined, publishedAt: input.publish ? new Date() : undefined,
  });
  const [row] = await db.select().from(observatoryObservations).where(eq(observatoryObservations.id, Number(result.insertId))).limit(1);
  return row;
}

export async function setObservatoryObservationStatus(input: { observationId: number; status: "draft" | "published" | "archived"; userId: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(observatoryObservations).set(input.status === "published"
    ? { status: input.status, publishedBy: input.userId, publishedAt: new Date() }
    : { status: input.status }).where(eq(observatoryObservations.id, input.observationId));
  const [row] = await db.select().from(observatoryObservations).where(eq(observatoryObservations.id, input.observationId)).limit(1);
  if (!row) throw new Error("Observation not found");
  return row;
}
