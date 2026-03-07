import { SourceReference } from './source-reference.js';

export interface ContextTransaction {
  transactionId: string;
  objectId: string;
  transactionType: string;
  occurredAt: Date;
  context: Record<string, unknown>;
  actors?: Record<string, unknown>;
  measures?: Record<string, unknown>;
  sourceRef?: SourceReference;
  createdAt: Date;
}

export interface RecordTransactionRequest {
  transactionType: string;
  context: Record<string, unknown>;
  actors?: Record<string, unknown>;
  measures?: Record<string, unknown>;
  occurredAt?: string;
}

export interface RecordTransactionResponse {
  transactionId: string;
  status: 'recorded';
}
