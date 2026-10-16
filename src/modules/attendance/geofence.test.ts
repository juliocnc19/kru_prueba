import { validateLocation } from "./geofence";

const center = { latitude: 10.4806, longitude: -66.9036 };

describe("department geofence", () => {
  it("allows remote marking when the department does not require location", () => {
    expect(validateLocation({ required: false, radiusMeters: null, ...center }, null, new Date("2026-10-05T12:00:00Z"))).toEqual({ allowed: true, distanceMeters: null, accuracyMeters: null });
  });

  it("rejects a location outside the configured 20-metre radius", () => {
    expect(validateLocation({ required: true, radiusMeters: 20, ...center }, { latitude: 10.481, longitude: -66.9036, accuracyMeters: 5, capturedAt: "2026-10-05T12:00:00Z" }, new Date("2026-10-05T12:00:10Z")).allowed).toBe(false);
  });

  it("rejects stale or inaccurate readings", () => {
    expect(validateLocation({ required: true, radiusMeters: 30, ...center }, { ...center, accuracyMeters: 40, capturedAt: "2026-10-05T12:00:00Z" }, new Date("2026-10-05T12:00:10Z")).reason).toBe("accuracy");
    expect(validateLocation({ required: true, radiusMeters: 30, ...center }, { ...center, accuracyMeters: 5, capturedAt: "2026-10-05T12:00:00Z" }, new Date("2026-10-05T12:03:00Z")).reason).toBe("stale");
  });

  it("accepts a precise reading inside the configured radius", () => {
    const result = validateLocation({ required: true, radiusMeters: 40, ...center }, { ...center, accuracyMeters: 8, capturedAt: "2026-10-05T12:00:00Z" }, new Date("2026-10-05T12:00:10Z"));
    expect(result).toEqual({ allowed: true, distanceMeters: 0, accuracyMeters: 8 });
  });

  it("rejects missing, invalid and implausibly future readings", () => {
    const fence = { required: true, radiusMeters: 30 as const, ...center };
    expect(validateLocation(fence, null, new Date()).reason).toBe("missing");
    expect(validateLocation(fence, { latitude: 95, longitude: 0, accuracyMeters: 5, capturedAt: "2026-10-05T12:00:00Z" }, new Date("2026-10-05T12:00:00Z")).reason).toBe("invalid");
    expect(validateLocation(fence, { ...center, accuracyMeters: 5, capturedAt: "2026-10-05T12:01:00Z" }, new Date("2026-10-05T12:00:00Z")).reason).toBe("stale");
  });
});
