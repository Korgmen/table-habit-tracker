# Table — Rastreador de hábitos

[![GitHub stars](https://img.shields.io/github/stars/korgmen/table-habit-tracker)](https://github.com/korgmen/table-habit-tracker/stargazers)
[![GitHub last commit](https://img.shields.io/github/last-commit/korgmen/table-habit-tracker)](https://github.com/korgmen/table-habit-tracker/commits/main)
[![GitHub issues](https://img.shields.io/github/issues/korgmen/table-habit-tracker)](https://github.com/korgmen/table-habit-tracker/issues)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://github.com/korgmen/table-habit-tracker/blob/main/LICENSE.txt)

[Русский](./README.md) | [English](./README.en.md) | **Español** | [中文](./README.zh.md) | [العربية](./README.ar.md)

**Table** es un rastreador de hábitos en forma de tabla «hábito × día del mes». Cada día se marca lo cumplido, y la aplicación calcula el porcentaje, las rachas y el resumen del mes y guarda un archivo por meses. Funciona en el navegador y como PWA sin conexión, y sincroniza los datos entre dispositivos mediante el inicio de sesión con Google. La hoja del mes se puede imprimir, rellenar a mano y pasar sus marcas a la aplicación a partir de una foto.

Stack: Vue 3, Vite, Pinia, Tailwind CSS 4, vue-i18n, Firebase (Auth y Firestore), vite-plugin-pwa.

![Captura de la aplicación](https://lebedevcode.ru/table-screenshot.png)

---

## Idiomas

- La interfaz está en ruso, inglés, español, chino y árabe (con diseño de derecha a izquierda).
- El idioma se elige en los ajustes; por defecto se usa el idioma del sistema.
- Los diccionarios están en `src/locales/`, el de referencia es `en.json`.

## Funcionalidades

### Marcas

- Una celda tiene tres estados: hecho, no hecho (vacío) y omitido. Un día omitido no cuenta en el porcentaje.
- Se pueden marcar los días pasados y el de hoy. Los meses futuros no se abren.
- Ordenador: la tabla del mes. Un clic en una celda pone «hecho», un segundo clic o el clic derecho pone omitido, un tercer clic borra la marca. Un clic en el número del encabezado marca el día en todos los hábitos, el clic derecho en el número pone omitido. Alt+clic abre la nota del día.
- Teléfono (pantalla de menos de 768 px): una franja de días y las marcas del día elegido. Un toque en el círculo alterna hecho → omitido → vacío, una pulsación larga pone omitido. Deslizar sobre la lista cambia el día, deslizar sobre el nombre del mes cambia el mes. Acciones rápidas: ir a hoy, a ayer o a los días sin marcar, marcar todo el día, quitar las marcas de hecho.

### Hábitos

- Hasta 20 hábitos por mes y hasta 8 marcas al día en cada uno (por ejemplo, series o vasos de agua).
- Nombre de hasta 60 caracteres, emoji (búsqueda en el catálogo y sugerencias según el nombre del hábito), uno de 8 colores.
- Calendario: todos los días, los días de la semana elegidos o N veces por semana (hasta 6). Los días fuera del calendario se marcan como omitidos. Cuando se alcanza el objetivo de la semana, los días vacíos restantes de esa semana se marcan como omitidos. En las semanas incompletas de los bordes del mes el objetivo es proporcionalmente menor.
- Pausa: el hábito no entra en el porcentaje medio y se puede marcar como siempre.
- Notas de los días, de hasta 500 caracteres.
- El orden se cambia arrastrando o con los botones «Subir» y «Bajar».
- Ficha del hábito: marcas del mes, racha actual y mejor racha, media de todos los meses y de cada mes.

### Progreso y estadísticas

- Porcentaje de cumplimiento de cada hábito y porcentaje medio del mes. Se calcula sobre todos los días del mes o solo sobre los días pasados.
- Resumen del mes junto al porcentaje medio: solo porcentaje, estrellas 0–5, letras A–F, nota 2–5 o nada. Por defecto se muestra la nota 2–5 para el ruso y el porcentaje para los demás idiomas.
- Las rachas se cuentan en días, y en semanas para los hábitos con objetivo «N veces por semana».
- Ventana de estadísticas por años: media del año, número de marcas hechas, mejor racha, mapas de calor del mes y del año, media por meses, tabla de hábitos del año.

### Meses y archivo

- Cada mes se guarda por separado. Los meses pasados se abren con las flechas, sus marcas se pueden corregir y las estadísticas se recalculan.
- Un mes nuevo, al abrirse por primera vez, recibe los hábitos del último mes con datos y las marcas limpias.
- Los hábitos se pasan de un mes archivado al actual a mano: se eligen los hábitos necesarios y se añaden a los actuales o los reemplazan.
- Búsqueda: un filtro de los hábitos del mes abierto y una búsqueda por nombres, emoji y notas en todos los meses.

### Deshacer y rehacer

- Se pueden deshacer y rehacer los últimos 50 cambios: marcas, ediciones y orden de los hábitos, eliminación, traspaso, importación, notas, pausa, carga desde la nube.
- El historial de deshacer se conserva hasta que se recarga la página.

### Hoja y foto

- Impresión de la hoja del mes en A4 horizontal con marcadores ArUco en las esquinas y un código QR: nombres de los hábitos a la izquierda, días del mes a la derecha, hasta 20 hábitos en una hoja.
- La foto de la hoja rellena se reconoce en el navegador. En la pantalla de revisión, las diferencias con los datos actuales tienen un marco continuo, las marcas dudosas uno discontinuo, y un toque cambia la marca. Tras la revisión, las marcas se pasan a la tabla.
- La hoja está ligada al mes y a los hábitos para los que se imprimió. La aplicación avisa de una hoja de otro mes y de los hábitos eliminados después de imprimir.

### Datos

- Los datos se guardan en el navegador (`localStorage`) y la aplicación funciona sin conexión.
- Exportación e importación JSON (archivo de hasta 2 MB). Antes de importar se muestra un resumen y una elección: combinar con los datos actuales (para los meses que están aquí y en el archivo se elige una versión) o reemplazarlo todo junto con los ajustes.
- Antes de importar se guarda una copia de seguridad de los datos actuales. Se puede restaurar o descargar, y la propia importación se puede deshacer.
- Exportación CSV del mes abierto o de todos los meses.

### Sincronización

- Inicio de sesión con Google; los datos se guardan en Firestore por meses.
- Sin conexión, los cambios se acumulan en el dispositivo y se envían cuando hay conexión. El estado de la sincronización se ve en la interfaz.
- Si un mes difiere en el dispositivo y en la nube, se elige una versión para cada mes. La elección se puede aplazar, y los demás meses siguen sincronizándose.
- Al cerrar sesión, los datos locales se eliminan del dispositivo. Si los cambios no han llegado a la nube, la aplicación avisa y ofrece guardarlos en un archivo.

### Ajustes e interfaz

- Tema: claro, oscuro o del sistema.
- Inicio de la semana: lunes, domingo o según el idioma y la región. Los separadores de semanas en la tabla se activan aparte.
- La tabla y los grupos de opciones se manejan con el teclado, y las celdas tienen etiquetas para lectores de pantalla.
- PWA: instalación en el dispositivo, funcionamiento sin conexión, aviso de nueva versión con un botón para actualizar.
- Una ventana de bienvenida que explica las marcas y se vuelve a abrir desde los ajustes («Cómo funciona»).

## Atajos de teclado

La lista también está en los ajustes de la aplicación.

| Tecla                    | Acción                                       |
| ------------------------ | -------------------------------------------- |
| N                        | Nuevo hábito                                 |
| S                        | Ajustes                                      |
| ← / →                    | Mes anterior / siguiente (al revés en árabe) |
| T                        | Ir al mes actual                             |
| /                        | Filtro de hábitos                            |
| ↑ ↓ ← →, Home, End       | Moverse por la tabla                         |
| X                        | Omitido en una celda de la tabla             |
| Alt+Enter                | Nota del día en una celda de la tabla        |
| Ctrl/⌘+Z                 | Deshacer                                     |
| Ctrl/⌘+Shift+Z, Ctrl/⌘+Y | Rehacer                                      |
| Esc                      | Cerrar la ventana                            |

## Inicio rápido

Se necesitan Node.js y pnpm.

```sh
git clone https://github.com/korgmen/table-habit-tracker.git
cd table-habit-tracker
pnpm install
pnpm dev
```

Comandos:

- `pnpm dev` — servidor de desarrollo de Vite.
- `pnpm build` — compilación en `dist/`.
- `pnpm preview` — vista previa local de la compilación.
- `pnpm lint` — comprobación con ESLint, `pnpm lint:fix` — con correcciones.
- `pnpm format` — formateo con Prettier.
- `pnpm test` — pruebas con Vitest, `npx vitest run` — una sola ejecución.

El Service Worker y la instalación de la PWA funcionan en la compilación: `pnpm build` y después `pnpm preview`.

## Estructura del proyecto

- `src/App.vue` — componente raíz: la tabla en el ordenador o la franja de días en el teléfono, atajos globales, impresión de la hoja, ventanas y el aviso emergente.
- `src/main.js` — arranque de Vue, Pinia, vue-i18n y la autenticación.
- `src/i18n.js` — configuración de vue-i18n, elección del idioma y reglas de plural.
- `src/stores/habitStore.js` — estado y lógica: hábitos, marcas, progreso, meses, ajustes, deshacer, importación y exportación, inicio de sesión y sincronización.
- `src/stores/modalStore.js` — la pila de ventanas, la cola de ventanas que la aplicación abre por sí misma y el aviso emergente.
- `src/utils/` — funciones puras: `archive.js` (archivo, validación y reparación de datos, traspaso de hábitos), `habitMath.js` (progreso, rachas, calendario y objetivos), `stats.js` (estadísticas), `cloudSync.js` (decisiones de sincronización por meses), `csv.js` (CSV), `emojiSearch.js` (búsqueda de emoji), `sheetLayout.js` (geometría de la hoja y contenido del QR), `sheetScan.js` (reconocimiento de la foto de la hoja).
- `src/composables/` — `useHabitUtils.js` (días del mes, tema, semanas), `useModals.js` (escenarios de ventanas y cierre con el botón «atrás»), `useGridNavigation.js` (teclado en la tabla), `useGestures.js` (deslizamientos y pulsación larga), `useSearch.js` (búsqueda).
- `src/directives/radioGroup.js` — teclado en los grupos de opciones.
- `src/components/` — interfaz: tabla (`HabitGrid`, `HabitRow`, `MarkCircle`), teléfono (`MobileView`), ventanas (`HabitSheet`, `SettingsSheet`, `StatsSheet`, `ImportSheet`, `ConflictSheet`, `NoteSheet`, `SearchSheet` y otras), hoja y foto (`PaperSheet`, `PhotoImport`).
- `src/locales/` — diccionarios de la interfaz.
- `src/firebase.js` — configuración web pública de Firebase.
- `firestore.rules` — reglas de Firestore: cada usuario lee y escribe solo sus propios documentos.
- Configuraciones: `vite.config.js` (Vite, PWA, Tailwind, Vitest, datos de emoji), `eslint.config.js`, `.prettierrc`.
- Las pruebas `*.test.js` están junto a los módulos.

## Dependencias principales

- [Vue 3](https://vuejs.org/) — framework.
- [Vite](https://vite.dev/) — empaquetador.
- [Pinia](https://pinia.vuejs.org/) — estado.
- [Tailwind CSS](https://tailwindcss.com/) — estilos.
- [vue-i18n](https://vue-i18n.intlify.dev/) — localización.
- [vue-draggable-next](https://github.com/anish2690/vue-draggable-next) — arrastrar y soltar.
- [lucide-vue-next](https://lucide.dev/) — iconos.
- [Firebase](https://firebase.google.com/) — inicio de sesión y almacenamiento en la nube.
- [vite-plugin-pwa](https://vite-pwa-org.netlify.app/) — PWA.
- [js-aruco2](https://www.npmjs.com/package/js-aruco2) y [jsQR](https://www.npmjs.com/package/jsqr) — reconocimiento de la hoja, [uqr](https://www.npmjs.com/package/uqr) — código QR de la hoja.
- [emojibase-data](https://www.npmjs.com/package/emojibase-data) — catálogo de emoji, [Golos Text](https://www.npmjs.com/package/@fontsource-variable/golos-text) — fuente.
- Desarrollo: ESLint, eslint-plugin-vue, Prettier, prettier-plugin-tailwindcss, Vitest, jsdom.

La lista completa está en `package.json`.

## Arquitectura y datos

- Archivo: `localStorage.habitArchive` = `{ "YYYY-MM": { tasks: [...] } }`. Los ajustes se guardan en claves separadas (`theme`, `lang`, `weekStart`, `showWeekSeparators`, `calculationMode`, `summaryStyle`), la copia de seguridad previa a la importación en `habitArchiveBackup`, los metadatos de sincronización en `habitSyncMeta`.
- Hábito: `{ id, title, progress, subtasks: [{ id, marks }], color?, emoji?, schedule?, goal?, paused?, notes? }`. `marks` tiene un elemento por cada día del mes: `true` — hecho, `null` — no hecho, `false` — omitido.
- Firestore: `users/{uid}` contiene los ajustes y campos de servicio, los meses están en `users/{uid}/months/{YYYY-MM}`. La caché local de Firestore se guarda en IndexedDB.
- Ventanas: la pila está en `modalStore`, las ventanas las renderiza `ModalEntry.vue` y el botón «atrás» cierra la ventana superior.
- La disposición de la hoja en `src/utils/sheetLayout.js` es común a la impresión y al reconocimiento. El reconocimiento lee tanto la hoja horizontal como la hoja vertical de las versiones anteriores a 3.4.0; el formato se detecta por los números de los marcadores. `js-aruco2` y `jsqr` se cargan en el primer reconocimiento.

## Contribución

- Haz un fork del repositorio y crea una rama para tu cambio.
- El código es JavaScript, el estilo es ESLint y Prettier.
- Los textos nuevos de la interfaz se añaden a los 5 diccionarios de `src/locales/`.
- Antes de un pull request: `pnpm lint`, `npx vitest run`, `pnpm build`.
- Preguntas y errores, en [issues](https://github.com/korgmen/table-habit-tracker/issues).

## Licencia

Apache-2.0 — [LICENSE.txt](./LICENSE.txt), [NOTICE.txt](./NOTICE.txt).
