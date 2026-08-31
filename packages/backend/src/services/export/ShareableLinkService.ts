/**
 * Shareable Link Service — Generate and resolve share tokens with role-appropriate views.
 *
 * Generates shareable links with access control:
 * - Planner/Supervisor → full plan view (all data)
 * - Loader → loading instructions only
 * - Driver → verification checklist only
 * - Customer_Viewer → only items assigned to that customer's delivery stops
 *
 * Requirements: 15.4, 15.5
 */

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * The payload encoded into a share token.
 */
export interface ShareTokenPayload {
  /** The plan being shared */
  planId: string;
  /** The role-level view to grant */
  role: ShareableRole;
  /** For Customer_Viewer: the customer name to filter by */
  customerName?: string;
  /** Token creation timestamp (ISO) */
  createdAt: string;
  /** Who generated the share link */
  createdBy: string;
  /** Optional expiration timestamp (ISO) */
  expiresAt?: string;
}

/**
 * Roles that can receive a shareable link.
 */
export type ShareableRole = 'Planner' | 'Supervisor' | 'Loader' | 'Driver' | 'Customer_Viewer';

/**
 * Input for generating a shareable link.
 */
export interface GenerateShareLinkInput {
  planId: string;
  role: ShareableRole;
  createdBy: string;
  /** Required for Customer_Viewer role */
  customerName?: string;
  /** Optional expiration in hours from now (default: no expiration) */
  expiresInHours?: number;
}

/**
 * The structured view returned when a shared link is accessed.
 */
export interface SharedPlanView {
  planId: string;
  role: ShareableRole;
  customerName?: string;
  /** The data appropriate for the role */
  data: FullPlanView | LoadingInstructionsView | VerificationChecklistView | CustomerItemsView;
}

export interface FullPlanView {
  type: 'full_plan';
  plan: Record<string, unknown>;
  currentVersion: Record<string, unknown>;
  weightMetrics: Record<string, unknown> | null;
  securementPlan: Record<string, unknown> | null;
  loadingSequence: Record<string, unknown>[] | null;
  warnings: Record<string, unknown>[] | null;
  placedFreight: Record<string, unknown>[] | null;
  freightManifest: Record<string, unknown>[] | null;
}

export interface LoadingInstructionsView {
  type: 'loading_instructions';
  planId: string;
  version: number;
  loadingSequence: Record<string, unknown>[] | null;
  securementPlan: Record<string, unknown> | null;
}

export interface VerificationChecklistView {
  type: 'verification_checklist';
  planId: string;
  version: number;
  checklist: VerificationChecklistItem[];
  placedFreight: Record<string, unknown>[] | null;
  securementPlan: Record<string, unknown> | null;
}

export interface VerificationChecklistItem {
  itemId: string;
  description: string;
  checks: string[];
}

export interface CustomerItemsView {
  type: 'customer_items';
  planId: string;
  version: number;
  customerName: string;
  items: Record<string, unknown>[];
  deliveryStops: number[];
}

// ─── Token Errors ─────────────────────────────────────────────────────────────

export class InvalidShareTokenError extends Error {
  public statusCode = 400;
  constructor(reason: string) {
    super(`Invalid share token: ${reason}`);
    this.name = 'InvalidShareTokenError';
  }
}

export class ShareTokenExpiredError extends Error {
  public statusCode = 410;
  constructor() {
    super('Share token has expired');
    this.name = 'ShareTokenExpiredError';
  }
}

// ─── Allowed Role Validation ──────────────────────────────────────────────────

const SHAREABLE_ROLES: ShareableRole[] = ['Planner', 'Supervisor', 'Loader', 'Driver', 'Customer_Viewer'];

export function isShareableRole(role: string): role is ShareableRole {
  return SHAREABLE_ROLES.includes(role as ShareableRole);
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class ShareableLinkService {
  /**
   * Generate a share token encoding planId, role, and optional customer filter.
   * The token is a base64url-encoded JSON payload.
   */
  generateShareToken(input: GenerateShareLinkInput): string {
    const { planId, role, createdBy, customerName, expiresInHours } = input;

    if (!planId || planId.trim().length === 0) {
      throw new InvalidShareTokenError('planId is required');
    }

    if (!isShareableRole(role)) {
      throw new InvalidShareTokenError(`Invalid role: ${role}. Must be one of: ${SHAREABLE_ROLES.join(', ')}`);
    }

    if (role === 'Customer_Viewer' && (!customerName || customerName.trim().length === 0)) {
      throw new InvalidShareTokenError('customerName is required for Customer_Viewer role');
    }

    const payload: ShareTokenPayload = {
      planId,
      role,
      createdAt: new Date().toISOString(),
      createdBy,
    };

    if (customerName) {
      payload.customerName = customerName;
    }

    if (expiresInHours && expiresInHours > 0) {
      const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);
      payload.expiresAt = expiresAt.toISOString();
    }

    // Encode as base64url JSON
    const json = JSON.stringify(payload);
    const token = Buffer.from(json, 'utf-8').toString('base64url');
    return token;
  }

  /**
   * Decode and validate a share token. Returns the payload if valid.
   */
  decodeShareToken(token: string): ShareTokenPayload {
    if (!token || token.trim().length === 0) {
      throw new InvalidShareTokenError('Token is empty');
    }

    let payload: ShareTokenPayload;
    try {
      const json = Buffer.from(token, 'base64url').toString('utf-8');
      payload = JSON.parse(json);
    } catch {
      throw new InvalidShareTokenError('Token is malformed');
    }

    // Validate required fields
    if (!payload.planId || typeof payload.planId !== 'string') {
      throw new InvalidShareTokenError('Token missing planId');
    }

    if (!payload.role || !isShareableRole(payload.role)) {
      throw new InvalidShareTokenError('Token has invalid role');
    }

    if (payload.role === 'Customer_Viewer' && !payload.customerName) {
      throw new InvalidShareTokenError('Customer_Viewer token missing customerName');
    }

    // Check expiration
    if (payload.expiresAt) {
      const expiresAt = new Date(payload.expiresAt);
      if (expiresAt.getTime() < Date.now()) {
        throw new ShareTokenExpiredError();
      }
    }

    return payload;
  }

  /**
   * Build a role-appropriate view of the plan data based on the share token's role.
   */
  buildSharedView(
    payload: ShareTokenPayload,
    planData: {
      plan: Record<string, unknown>;
      currentVersion: Record<string, unknown> | null;
    }
  ): SharedPlanView {
    const { plan, currentVersion } = planData;
    const version = currentVersion ?? {};

    switch (payload.role) {
      case 'Planner':
      case 'Supervisor':
        return {
          planId: payload.planId,
          role: payload.role,
          data: {
            type: 'full_plan',
            plan,
            currentVersion: version,
            weightMetrics: (version as any).weightMetrics ?? null,
            securementPlan: (version as any).securementPlan ?? null,
            loadingSequence: (version as any).loadingSequence ?? null,
            warnings: (version as any).warnings ?? null,
            placedFreight: (version as any).placedFreight ?? null,
            freightManifest: (plan as any).freightManifest ?? null,
          },
        };

      case 'Loader':
        return {
          planId: payload.planId,
          role: payload.role,
          data: {
            type: 'loading_instructions',
            planId: payload.planId,
            version: (version as any).versionNumber ?? 1,
            loadingSequence: (version as any).loadingSequence ?? null,
            securementPlan: (version as any).securementPlan ?? null,
          },
        };

      case 'Driver':
        return {
          planId: payload.planId,
          role: payload.role,
          data: this.buildDriverVerificationChecklist(payload.planId, version),
        };

      case 'Customer_Viewer':
        return {
          planId: payload.planId,
          role: payload.role,
          customerName: payload.customerName,
          data: this.buildCustomerView(payload.planId, payload.customerName!, plan, version),
        };
    }
  }

  /**
   * Build a verification checklist view for Driver role.
   */
  private buildDriverVerificationChecklist(
    planId: string,
    version: Record<string, unknown>
  ): VerificationChecklistView {
    const placedFreight = (version as any).placedFreight as Record<string, unknown>[] | null;
    const securementPlan = (version as any).securementPlan as Record<string, unknown> | null;

    const checklist: VerificationChecklistItem[] = [];

    if (placedFreight && Array.isArray(placedFreight)) {
      for (const item of placedFreight) {
        const itemData = (item as any).item ?? item;
        const orderNumber = itemData.orderNumber ?? itemData.id ?? 'unknown';
        const description = itemData.productType
          ? `${itemData.productType} - Order ${orderNumber}`
          : `Item ${orderNumber}`;

        checklist.push({
          itemId: String(orderNumber),
          description,
          checks: [
            'Item present on trailer and matches plan position',
            'Securement applied and tensioned correctly',
            'Weight within tolerance of planned values',
            'No visible freight damage',
          ],
        });
      }
    }

    return {
      type: 'verification_checklist',
      planId,
      version: (version as any).versionNumber ?? 1,
      checklist,
      placedFreight,
      securementPlan,
    };
  }

  /**
   * Build a customer-filtered view showing only items for that customer's stops.
   * Requirement 15.5: Display only items assigned to that customer's stops.
   */
  private buildCustomerView(
    planId: string,
    customerName: string,
    plan: Record<string, unknown>,
    version: Record<string, unknown>
  ): CustomerItemsView {
    const placedFreight = (version as any).placedFreight as Record<string, unknown>[] | null;
    const freightManifest = (plan as any).freightManifest as Record<string, unknown>[] | null;

    // Filter items by customer name from placed freight
    const customerItems: Record<string, unknown>[] = [];
    const deliveryStops = new Set<number>();

    // First try placed freight (has position data)
    if (placedFreight && Array.isArray(placedFreight)) {
      for (const placed of placedFreight) {
        const itemData = (placed as any).item ?? placed;
        const itemCustomer = itemData.customerName ?? itemData.customer ?? '';
        if (String(itemCustomer).toLowerCase() === customerName.toLowerCase()) {
          customerItems.push(placed);
          const stop = itemData.deliveryStop ?? itemData.stop;
          if (typeof stop === 'number') {
            deliveryStops.add(stop);
          }
        }
      }
    }

    // If no placed freight, fall back to manifest
    if (customerItems.length === 0 && freightManifest && Array.isArray(freightManifest)) {
      for (const item of freightManifest) {
        const itemCustomer = (item as any).customerName ?? (item as any).customer ?? '';
        if (String(itemCustomer).toLowerCase() === customerName.toLowerCase()) {
          customerItems.push(item);
          const stop = (item as any).deliveryStop ?? (item as any).stop;
          if (typeof stop === 'number') {
            deliveryStops.add(stop);
          }
        }
      }
    }

    return {
      type: 'customer_items',
      planId,
      version: (version as any).versionNumber ?? 1,
      customerName,
      items: customerItems,
      deliveryStops: Array.from(deliveryStops).sort((a, b) => a - b),
    };
  }
}
