/**
 * TMS service — Paperclip ERP.
 *
 * Freight orders with pickup scheduling, tracking events (append-only) and a
 * linked fiscal document (CT-e). A `delivered` tracking event or explicit
 * deliver action closes the order.
 */

import { and, asc, desc, eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { erpFreightOrders, erpFreightTrackingEvents, fiscalDocuments } from "@paperclipai/db";
import type {
  AddTrackingEvent,
  CreateFreightOrder,
  TrackingStatus,
} from "@paperclipai/shared";
import { conflict, notFound, unprocessable } from "../errors.js";

export interface TmsActor {
  actorType: "user" | "agent" | "system";
  actorId: string;
}

export function tmsService(db: Db) {
  async function loadOrder(companyId: string, orderId: string) {
    const row = await db
      .select()
      .from(erpFreightOrders)
      .where(and(eq(erpFreightOrders.id, orderId), eq(erpFreightOrders.companyId, companyId)))
      .limit(1)
      .then((rows) => rows[0] ?? null);
    if (!row) throw notFound("Freight order not found");
    return row;
  }

  async function loadEvents(companyId: string, orderId: string) {
    return db
      .select()
      .from(erpFreightTrackingEvents)
      .where(
        and(
          eq(erpFreightTrackingEvents.companyId, companyId),
          eq(erpFreightTrackingEvents.freightOrderId, orderId),
        ),
      )
      .orderBy(asc(erpFreightTrackingEvents.occurredAt));
  }

  return {
    createOrder: async (companyId: string, input: CreateFreightOrder, userId: string | null) => {
      const code = input.code ?? `FR-${Date.now().toString(36).toUpperCase()}`;
      const [order] = await db
        .insert(erpFreightOrders)
        .values({
          companyId,
          code,
          carrierName: input.carrierName,
          carrierTaxId: input.carrierTaxId ?? null,
          originCity: input.originCity ?? null,
          originState: input.originState ?? null,
          destinationCity: input.destinationCity ?? null,
          destinationState: input.destinationState ?? null,
          pickupAt: input.pickupAt ? new Date(input.pickupAt) : null,
          freightCostCents: input.freightCostCents ?? null,
          notes: input.notes ?? null,
          createdByUserId: userId,
        })
        .returning();
      return { order, events: await loadEvents(companyId, order!.id) };
    },

    listOrders: async (companyId: string) =>
      db
        .select()
        .from(erpFreightOrders)
        .where(eq(erpFreightOrders.companyId, companyId))
        .orderBy(desc(erpFreightOrders.createdAt)),

    getOrder: async (companyId: string, orderId: string) => {
      const order = await loadOrder(companyId, orderId);
      return { order, events: await loadEvents(companyId, orderId) };
    },

    scheduleOrder: async (companyId: string, orderId: string, pickupAt: string) => {
      const order = await loadOrder(companyId, orderId);
      if (!["planned", "scheduled"].includes(order.status)) {
        throw conflict(`Freight order cannot be scheduled from status "${order.status}"`);
      }
      const [updated] = await db
        .update(erpFreightOrders)
        .set({ status: "scheduled", pickupAt: new Date(pickupAt), updatedAt: new Date() })
        .where(and(eq(erpFreightOrders.id, orderId), eq(erpFreightOrders.companyId, companyId)))
        .returning();
      return updated;
    },

    startShipment: async (companyId: string, orderId: string) => {
      const order = await loadOrder(companyId, orderId);
      if (!["scheduled", "planned"].includes(order.status)) {
        throw conflict(`Freight order cannot start from status "${order.status}"`);
      }
      const [updated] = await db
        .update(erpFreightOrders)
        .set({ status: "in_transit", updatedAt: new Date() })
        .where(and(eq(erpFreightOrders.id, orderId), eq(erpFreightOrders.companyId, companyId)))
        .returning();
      return updated;
    },

    addTrackingEvent: async (
      companyId: string,
      orderId: string,
      input: AddTrackingEvent,
      userId: string | null,
    ) => {
      const order = await loadOrder(companyId, orderId);
      if (order.status === "cancelled") throw conflict("Freight order is cancelled");

      const [event] = await db
        .insert(erpFreightTrackingEvents)
        .values({
          companyId,
          freightOrderId: orderId,
          status: input.status,
          location: input.location ?? null,
          note: input.note ?? null,
          occurredAt: input.occurredAt ? new Date(input.occurredAt) : new Date(),
        })
        .returning();

      let updated = order;
      if (input.status === "delivered" && order.status !== "delivered") {
        [updated] = await db
          .update(erpFreightOrders)
          .set({ status: "delivered", deliveredAt: new Date(), updatedAt: new Date() })
          .where(and(eq(erpFreightOrders.id, orderId), eq(erpFreightOrders.companyId, companyId)))
          .returning();
      }

      return { order: updated, event };
    },

    deliverOrder: async (companyId: string, orderId: string) => {
      const order = await loadOrder(companyId, orderId);
      if (order.status === "cancelled" || order.status === "delivered") {
        throw conflict(`Freight order cannot be delivered from status "${order.status}"`);
      }
      const [updated] = await db
        .update(erpFreightOrders)
        .set({ status: "delivered", deliveredAt: new Date(), updatedAt: new Date() })
        .where(and(eq(erpFreightOrders.id, orderId), eq(erpFreightOrders.companyId, companyId)))
        .returning();
      await db.insert(erpFreightTrackingEvents).values({
        companyId,
        freightOrderId: orderId,
        status: "delivered" as TrackingStatus,
        note: "Entrega confirmada",
      });
      return updated;
    },

    cancelOrder: async (companyId: string, orderId: string) => {
      const order = await loadOrder(companyId, orderId);
      if (["delivered", "cancelled"].includes(order.status)) {
        throw conflict(`Freight order cannot cancel from status "${order.status}"`);
      }
      const [updated] = await db
        .update(erpFreightOrders)
        .set({ status: "cancelled", updatedAt: new Date() })
        .where(and(eq(erpFreightOrders.id, orderId), eq(erpFreightOrders.companyId, companyId)))
        .returning();
      return updated;
    },

    linkFiscalDocument: async (companyId: string, orderId: string, fiscalDocumentId: string) => {
      const order = await loadOrder(companyId, orderId);
      const fiscal = await db
        .select()
        .from(fiscalDocuments)
        .where(and(eq(fiscalDocuments.id, fiscalDocumentId), eq(fiscalDocuments.companyId, companyId)))
        .limit(1)
        .then((rows) => rows[0] ?? null);
      if (!fiscal) throw notFound("Fiscal document not found");
      if (fiscal.model !== "cte") {
        throw unprocessable("Freight order link requires a CT-e fiscal document");
      }
      const [updated] = await db
        .update(erpFreightOrders)
        .set({ fiscalDocumentId: fiscal.id, updatedAt: new Date() })
        .where(and(eq(erpFreightOrders.id, orderId), eq(erpFreightOrders.companyId, companyId)))
        .returning();
      return updated;
    },
  };
}
