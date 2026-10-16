# Bitácora de uso de IA

**Herramienta:** Codex, asistente de programación basado en GPT, usado para analizar el enunciado, consultar documentación oficial, diseñar, implementar y verificar el proyecto. Las decisiones y resultados se comprobaron con TypeScript, ESLint, Jest, PostgreSQL, Playwright y una compilación de Next.js. Esta bitácora describe cambios que ocurrieron durante el trabajo, no ejemplos hipotéticos.

1. **Compilación con Turbopack.** El primer script de compilación dependía del comportamiento predeterminado de Next.js. En este entorno Turbopack intentó abrir un puerto y la compilación falló por una restricción del proceso. Se cambió el script a `next build --webpack` y el de desarrollo a `next dev --webpack`; después se verificó la compilación. La corrección mantiene Next.js 16 sin atribuir falsamente el problema al código de la aplicación.

2. **Fecha de inicio del colaborador de demostración.** La semilla inicial creaba el turno de Ana el 5 de octubre de 2026, pero su pertenencia a la empresa comenzaba en la fecha en que se ejecutaba la semilla. El reporte filtraba correctamente por vigencia y omitía el turno histórico. Se corrigió la semilla para iniciar la pertenencia el 1 de octubre y se verificó el reporte con Playwright. Esto dejó explícita la diferencia entre “dato de ejemplo visible” y “dato realmente coherente con la regla temporal”.

3. **Error de concurrencia envuelto por Drizzle.** Una primera versión de la acción de entrada comprobaba `error.code === "23505"` para traducir una infracción del índice único a un mensaje útil. La prueba de integración demostró que Drizzle envuelve el error PostgreSQL en `error.cause`; el mensaje no se mostraba. Se corrigió la inspección de la causa y se repitió la prueba de entrada duplicada y cierre de turno en PostgreSQL.

También se corrigió la configuración de Jest después de que intentara ejecutar pruebas Playwright como si fueran Jest. Las pruebas de navegador viven en `e2e/` y Jest ahora excluye esa carpeta.
