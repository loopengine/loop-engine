// SPDX-License-Identifier: Apache-2.0
// Copyright (c) Better Data, Inc.

/** Loop Engine runtime connection taxonomy — locked Phase 0B (RT-11). */
export type RuntimeConnectionCategory = "provider" | "channel" | "integration" | "protocol";

export type RuntimeConnectionStatus =
  | "available"
  | "planned"
  | "hosted_only"
  | "self_host_supported";

export type AuthType =
  | "none"
  | "api_key"
  | "oauth_tenant"
  | "oauth_publisher"
  | "webhook_signature"
  | "mcp_bearer"
  | "platform_jwt";

export type ImplementationRef =
  | { kind: "npm"; package: string; export?: string }
  | { kind: "hosted_route"; basePath: string }
  | { kind: "external"; product: string };

export interface RuntimeConnection {
  id: string;
  displayName: string;
  category: RuntimeConnectionCategory;
  metadataVersion: string;
  status: RuntimeConnectionStatus;
  capabilities: string[];
  authType: AuthType;
  emitsEvidence: boolean;
  supportsReplay: boolean;
  supportsHumanApproval: boolean;
  supportsGuards: boolean;
  requiresTenantAuth: boolean;
  selfHostCompatible: boolean;
  hostedCompatible: boolean;
  implementationRef: ImplementationRef;
  featureFlags?: string[];
  docsUrl?: string;
}

export interface RuntimeConnectionCatalog {
  catalogVersion: string;
  connections: RuntimeConnection[];
}

export interface MetadataConnectionsResponse {
  contractVersion: string;
  catalogVersion: string;
  connections: RuntimeConnection[];
}

export const RUNTIME_CONNECTION_CATEGORIES: readonly RuntimeConnectionCategory[] = [
  "provider",
  "channel",
  "integration",
  "protocol",
] as const;
