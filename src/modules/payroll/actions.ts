"use server";

import { getPayrollReport } from "./report";
import type { PeriodType } from "./period";

export async function exportPayrollAction(type: PeriodType, anchor: string, departmentId?: string) {
  const report = await getPayrollReport(type, anchor, departmentId);
  return { filename: `kru-marcaje-${report.from}-${report.to}.csv`, content: report.csv };
}
