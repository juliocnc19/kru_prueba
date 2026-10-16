import { expect, test, type Page } from "@playwright/test";

async function adminLogin(page: Page, email: string) {
  await page.goto("/login");
  await page.getByRole("textbox", { name: "Correo electrónico" }).fill(email);
  await page.getByLabel("Contraseña").fill("Demo12345!");
  await page.getByRole("button", { name: "Ingresar" }).click();
}

test("platform owner can approve companies but has no attendance navigation", async ({ page }) => {
  await adminLogin(page, "owner@kru.demo");
  await expect(page).toHaveURL(/\/plataforma$/);
  await expect(page.getByRole("heading", { name: "Empresas", exact: true })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Principal" })).not.toContainText("Nómina");
  await page.goto("/empresa/nomina");
  await expect(page).toHaveURL(/\/sin-permiso$/);
});

test("HR sees only its company and exports the seeded payroll week", async ({ browser }) => {
  const a = await browser.newContext();
  const pageA = await a.newPage();
  await adminLogin(pageA, "rrhh@empresa-a.demo");
  await expect(pageA).toHaveURL(/\/empresa$/);
  await expect(pageA.getByText("Ana Pérez").first()).toBeVisible();
  await pageA.goto("/empresa/nomina?type=week&date=2026-10-05");
  await expect(pageA.locator("table").getByText("Ana Pérez")).toBeVisible();
  await expect(pageA.locator("table").getByText("10.00").first()).toBeVisible();
  await pageA.goto("/plataforma");
  await expect(pageA).toHaveURL(/\/sin-permiso$/);
  await pageA.goto("/empresa/nomina?type=week&date=2026-10-05");
  const downloadPromise = pageA.waitForEvent("download");
  await pageA.getByRole("button", { name: "Exportar CSV" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("kru-marcaje-2026-10-05-2026-10-11.csv");
  await a.close();

  const b = await browser.newContext();
  const pageB = await b.newPage();
  await adminLogin(pageB, "rrhh@empresa-b.demo");
  await expect(pageB).toHaveURL(/\/empresa$/);
  await expect(pageB.getByText("Ana Pérez")).toHaveCount(0);
  await pageB.goto("/empresa/marcajes?date=2026-10-05");
  await expect(pageB.getByText("Ana Pérez")).toHaveCount(0);
  await b.close();
});

test("employee mobile page fits a 320px screen", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/login");
  await page.getByRole("button", { name: "Colaborador" }).click();
  await page.getByLabel("Código de empresa").fill("empresa-a");
  await page.getByLabel("Cédula").fill("12345678");
  await page.getByLabel("Contraseña").fill("Demo12345!");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).toHaveURL(/\/marcar$/);
  await expect(page.getByRole("button", { name: /Registrar entrada|Registrar salida/ })).toBeVisible();
  await page.goto("/empresa");
  await expect(page).toHaveURL(/\/sin-permiso$/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("a company remains pending until the platform owner approves it", async ({ browser }) => {
  const suffix = Date.now().toString(36);
  const companyName = `Empresa prueba ${suffix}`;
  const email = `rrhh-${suffix}@ejemplo.test`;
  const registration = await browser.newContext();
  const applicant = await registration.newPage();
  await applicant.goto("/registro");
  await applicant.getByLabel("Nombre de la empresa").fill(companyName);
  await applicant.getByLabel("Código para colaboradores").fill(`prueba-${suffix}`);
  await applicant.getByLabel("Nombre completo").fill("RRHH de prueba");
  await applicant.getByLabel("Correo electrónico").fill(email);
  await applicant.getByLabel("Contraseña").fill("Demo12345!");
  await applicant.getByRole("button", { name: "Enviar solicitud" }).click();
  await expect(applicant.getByRole("status")).toContainText("Solicitud recibida");
  await adminLogin(applicant, email);
  await expect(applicant.getByRole("alert").filter({ hasText: "espera aprobación" })).toBeVisible();
  await registration.close();

  const ownerContext = await browser.newContext();
  const owner = await ownerContext.newPage();
  await adminLogin(owner, "owner@kru.demo");
  const companyRow = owner.locator("tr").filter({ hasText: companyName });
  await companyRow.getByRole("button", { name: "Aprobar" }).click();
  await expect(companyRow).toContainText("Activa");
  await ownerContext.close();

  const approvedContext = await browser.newContext();
  const approved = await approvedContext.newPage();
  await adminLogin(approved, email);
  await expect(approved).toHaveURL(/\/empresa$/);
  await approvedContext.close();
});

test("HR can review historical shifts and must give a correction reason", async ({ page }) => {
  await adminLogin(page, "rrhh@empresa-a.demo");
  await expect(page).toHaveURL(/\/empresa$/);
  await page.goto("/empresa/marcajes?date=2026-10-05");
  const shift = page.locator("article").filter({ hasText: "Ana Pérez" });
  await expect(shift).toContainText("16:00");
  await shift.getByText("Corregir").click();
  const form = shift.locator("form");
  await form.evaluate((element: HTMLFormElement) => { element.noValidate = true; });
  await form.getByRole("button", { name: "Guardar corrección" }).click();
  await expect(form.getByRole("alert")).toContainText("motivo");
  await form.getByLabel("Motivo de corrección").fill("Revisión del turno de demostración");
  await form.getByRole("button", { name: "Guardar corrección" }).click();
  await expect(form.getByRole("status")).toContainText("auditado");
});

test("HR dashboard and report remain usable on a narrow phone", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await adminLogin(page, "rrhh@empresa-a.demo");
  await expect(page).toHaveURL(/\/empresa$/);
  await expect(page.getByRole("heading", { name: "Resumen de hoy" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.goto("/empresa/nomina?type=week&date=2026-10-05");
  await expect(page.getByRole("button", { name: "Exportar CSV" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("report-mobile.png"), fullPage: true });
});

test("administration screens fit a 320px phone", async ({ browser }) => {
  const ownerContext = await browser.newContext({ viewport: { width: 320, height: 740 } });
  const owner = await ownerContext.newPage();
  await adminLogin(owner, "owner@kru.demo");
  await expect(owner).toHaveURL(/\/plataforma$/);
  await expect(owner.getByText("Empresa A").first()).toBeVisible();
  expect(await owner.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await ownerContext.close();

  const hrContext = await browser.newContext({ viewport: { width: 320, height: 740 } });
  const hr = await hrContext.newPage();
  await adminLogin(hr, "rrhh@empresa-a.demo");
  await expect(hr).toHaveURL(/\/empresa$/);
  for (const path of ["/empresa/colaboradores", "/empresa/departamentos", "/empresa/marcajes?date=2026-10-05"]) {
    await hr.goto(path);
    await expect(hr.locator("main").first()).toBeVisible();
    expect(await hr.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  await hrContext.close();
});
