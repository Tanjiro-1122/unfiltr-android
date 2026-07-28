import { getAppStorageItem, setAppStorageItem } from '@/lib/storage/appStorage';

export type TimeCapsule = {
  id: string;
  message: string;
  created_at: string;
  deliver_at: string;
  delivered: boolean;
};

export type TimeCapsulePreferences = {
  capsules: TimeCapsule[];
};

export const CAPSULE_STORAGE_KEY = 'unfiltr_time_capsules';

export const DEFAULT_CAPSULE_PREFERENCES: TimeCapsulePreferences = {
  capsules: [],
};

export const DELAY_OPTIONS: { label: string; days: number }[] = [
  { label: '1 day', days: 1 },
  { label: '3 days', days: 3 },
  { label: '1 week', days: 7 },
  { label: '1 month', days: 30 },
  { label: '3 months', days: 90 },
  { label: '6 months', days: 180 },
];

export async function loadTimeCapsules(): Promise<TimeCapsule[]> {
  const raw = await getAppStorageItem(CAPSULE_STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isCapsule);
  } catch {
    return [];
  }
}

export async function saveTimeCapsules(capsules: TimeCapsule[]): Promise<void> {
  await setAppStorageItem(CAPSULE_STORAGE_KEY, JSON.stringify(capsules));
}

export async function addCapsule(message: string, days: number): Promise<TimeCapsule[]> {
  const existing = await loadTimeCapsules();
  const newCapsule: TimeCapsule = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    message,
    created_at: new Date().toISOString(),
    deliver_at: new Date(Date.now() + days * 86_400_000).toISOString(),
    delivered: false,
  };
  const updated = [...existing, newCapsule];
  await saveTimeCapsules(updated);
  return updated;
}

export async function deleteCapsule(id: string): Promise<TimeCapsule[]> {
  const existing = await loadTimeCapsules();
  const updated = existing.filter((c) => c.id !== id);
  await saveTimeCapsules(updated);
  return updated;
}

export async function markCapsuleDelivered(id: string): Promise<TimeCapsule[]> {
  const existing = await loadTimeCapsules();
  const updated = existing.map((c) => (c.id === id ? { ...c, delivered: true } : c));
  await saveTimeCapsules(updated);
  return updated;
}

export function getDeliverableCapsules(capsules: TimeCapsule[]): TimeCapsule[] {
  const now = new Date().toISOString();
  return capsules.filter((c) => !c.delivered && c.deliver_at <= now);
}

export function getPendingCapsules(capsules: TimeCapsule[]): TimeCapsule[] {
  const now = new Date().toISOString();
  return capsules.filter((c) => !c.delivered && c.deliver_at > now);
}

export function getDeliveredCapsules(capsules: TimeCapsule[]): TimeCapsule[] {
  return capsules.filter((c) => c.delivered);
}

function isCapsule(value: unknown): value is TimeCapsule {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'string' &&
    typeof v.message === 'string' &&
    typeof v.created_at === 'string' &&
    typeof v.deliver_at === 'string' &&
    typeof v.delivered === 'boolean'
  );
}
