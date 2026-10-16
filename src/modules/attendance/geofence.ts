export type Geofence = { required: boolean; radiusMeters: 20 | 30 | 40 | null; latitude: number; longitude: number };
export type LocationReading = { latitude: number; longitude: number; accuracyMeters: number; capturedAt: string };
export type LocationResult = { allowed: boolean; distanceMeters: number | null; accuracyMeters: number | null; reason?: "missing" | "stale" | "accuracy" | "outside" | "invalid" };

export function validateLocation(fence: Geofence, reading: LocationReading | null, now: Date): LocationResult {
  if (!fence.required) return { allowed: true, distanceMeters: null, accuracyMeters: null };
  if (!reading) return { allowed: false, distanceMeters: null, accuracyMeters: null, reason: "missing" };
  const validCoordinate = (latitude: number, longitude: number) => Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180;
  if (!fence.radiusMeters || !validCoordinate(fence.latitude, fence.longitude) || !validCoordinate(reading.latitude, reading.longitude) || !Number.isFinite(reading.accuracyMeters) || reading.accuracyMeters <= 0) {
    return { allowed: false, distanceMeters: null, accuracyMeters: null, reason: "invalid" };
  }
  const age = now.getTime() - new Date(reading.capturedAt).getTime();
  if (!Number.isFinite(age) || age < -30_000 || age > 60_000) return { allowed: false, distanceMeters: null, accuracyMeters: reading.accuracyMeters, reason: "stale" };
  if (reading.accuracyMeters > fence.radiusMeters) return { allowed: false, distanceMeters: null, accuracyMeters: reading.accuracyMeters, reason: "accuracy" };
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const deltaLatitude = radians(reading.latitude - fence.latitude);
  const deltaLongitude = radians(reading.longitude - fence.longitude);
  const a = Math.sin(deltaLatitude / 2) ** 2 + Math.cos(radians(fence.latitude)) * Math.cos(radians(reading.latitude)) * Math.sin(deltaLongitude / 2) ** 2;
  const distanceMeters = 6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return distanceMeters <= fence.radiusMeters
    ? { allowed: true, distanceMeters, accuracyMeters: reading.accuracyMeters }
    : { allowed: false, distanceMeters, accuracyMeters: reading.accuracyMeters, reason: "outside" };
}
