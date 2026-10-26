export interface Rate {
  id: number;
  period: 'special' | 'weekend';
  minutes: number;
  quantity: number;
  priceCents: number;
  active: boolean;
  validFrom: string | null;
  validUntil: string | null;
}

export interface Faq {
  id: number;
  question: string;
  answer: string;
  position: number;
  active: boolean;
}

export interface PublicData {
  rates: Rate[];
  faqs: Faq[];
  settings: Record<string, string>;
}

export interface Equipment {
  id: number;
  code: string;
  kind: 'scooter' | 'helmet';
  status: 'available' | 'maintenance' | 'inactive';
  busy: boolean;
}

export interface Rental {
  id: number;
  customerName: string;
  customerDocumentType: string;
  customerDocument: string;
  customerPhone: string | null;
  minutes: number;
  priceCents: number;
  finalPriceCents: number | null;
  startedAt: string;
  dueAt: string;
  endedAt: string | null;
  createdByName: string;
  endedByName: string | null;
  notes: string;
  equipment: { code: string; kind: 'scooter' | 'helmet' }[];
}

export interface Dashboard {
  rentals: Rental[];
  equipment: Equipment[];
  rates: Rate[];
}

export interface SessionUser {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'worker' | 'operator';
}

export interface AdminUser extends SessionUser {
  active: boolean;
}

export interface AuditEntry {
  id: number;
  action: string;
  entity: string;
  entityId: string;
  createdAt: string;
  name: string | null;
}

export interface AdminData {
  rates: Rate[];
  users: AdminUser[];
  faqs: Faq[];
  settings: Record<string, string>;
  audit: AuditEntry[];
}

export interface Notification {
  id: number;
  channel: string;
  category: string;
  templateKey: string;
  status: string;
  attempts: number;
  scheduledFor: string;
  recipient: string;
  lastError: string | null;
}
