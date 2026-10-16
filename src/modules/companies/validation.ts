import { z } from "zod";

const name = z.string().trim().min(2).max(160);
const password = z.string().min(10).max(128).regex(/[A-Z]/).regex(/[a-z]/).regex(/[0-9]/);

export const companyRegistrationSchema = z.object({
  companyName: name,
  code: z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9-]{2,31}$/),
  adminName: name,
  email: z.email().trim().toLowerCase(),
  password,
});

export const employeeSchema = z.object({
  name,
  cedula: z.string().trim().regex(/^[VEJPGvejpg]?-?\d{6,12}$/),
  departmentId: z.uuid(),
  password,
});

export const policySchema = z.object({
  ordinaryMinutes: z.number().int().min(1).max(1440).default(480),
  nightStart: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).default("19:00"),
  nightEnd: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).default("05:00"),
  weeklyOvertimeAlertMinutes: z.number().int().min(0).max(10080).default(600),
  geofenceRequired: z.boolean(),
  latitude: z.number().min(-90).max(90).nullable(),
  longitude: z.number().min(-180).max(180).nullable(),
  radiusMeters: z.union([z.literal(20), z.literal(30), z.literal(40)]).nullable(),
}).refine((value) => !value.geofenceRequired || (value.latitude !== null && value.longitude !== null && value.radiusMeters !== null), { message: "La ubicación y el radio son obligatorios" });
