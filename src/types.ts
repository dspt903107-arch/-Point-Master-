export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export interface Student {
  id: string;
  name: string;
  points: number;
  draws: number;
  coins?: number;
  inventory: Record<string, number>;
  doubleDraw?: boolean;
  maxPointsReached?: number;
}

export interface Log {
  id: string;
  targetId: string;
  action: string;
  detail: string;
  timestamp: number;
}

export interface Task {
  id: string;
  content: string;
  reward: string;
  timestamp: number;
}

export type CardTier = 'N' | 'R' | 'SR' | 'SSR';

export interface Card {
  name: string;
  tier: CardTier;
  icon: string;
  desc: string;
}
