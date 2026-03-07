import { SourceReference } from './source-reference.js';

export interface ContextGroups {
  attributes?: Record<string, unknown>;
  measures?: Record<string, unknown>;
  actors?: Record<string, unknown>;
  temporals?: Record<string, unknown>;
  locations?: Record<string, unknown>;
  intents?: Record<string, unknown>;
  processes?: Record<string, unknown>;
}

export interface ContextObject {
  objectId: string;
  objectType: string;
  subtype: string;
  canonicalName: string;
  context: ContextGroups;
  summary?: string;
  embedding?: number[];
  sourceRefs: SourceReference[];
  confidence: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpsertObjectRequest {
  objectType: string;
  subtype: string;
  canonicalName: string;
  context: ContextGroups;
  summary?: string;
  sourceRefs: SourceReference[];
  confidence?: number;
}

export interface UpsertObjectResponse {
  objectId: string;
  status: 'created' | 'updated';
}
