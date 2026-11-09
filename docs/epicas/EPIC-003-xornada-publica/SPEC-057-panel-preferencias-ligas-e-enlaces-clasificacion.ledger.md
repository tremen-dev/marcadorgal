# SPEC-057 — Panel de preferencias de ligas visibles e enlaces a clasificación en cabeceiras de columna

| Criterio | Módulos afectados | Pruebas | Estado |
| :--- | :--- | :--- | :--- |
| CA-1 Cabecera limpia en portada | `src/app/xornada-home.tsx` | Verificación visual y pruebas de navegación e2e | ✅ Completado |
| CA-2 Enlaces en cabeceras de columna | `src/components/xornada/CompetitionSection.tsx`, `Xornada.module.css` | Subheader con enlace contextual `Táboa ↗` / `Clasificación ↗` | ✅ Completado |
| CA-3 Panel de preferencias ⚙ | `src/components/xornada/LeaguesPreferencesDialog.tsx`, `XornadaControls.tsx`, `Xornada.module.css` | Diálogo accesible con interruptores por liga y presets rápidos | ✅ Completado |
| CA-4 Persistencia en localStorage | `src/lib/league-preferences.ts`, `src/lib/league-preferences.test.ts` | 5 pruebas unitarias de persistencia, fallback y eventos de DOM | ✅ Completado |
| CA-5 Resiliencia SSR e hidratación | `src/components/xornada/XornadaFilters.tsx` | Atributo `data-user-hidden` en cliente; render SSR completo sin JS | ✅ Completado |
| CA-6 Calidad y gates | Suite completa (`npm run gates`, `npx playwright test`) | Biome (0 errores), TypeScript (0 errores), Vitest (2225 pruebas), Playwright (250 pruebas) | ✅ Completado |
