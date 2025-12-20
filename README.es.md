# Table — Rastreador de hábitos

[![GitHub stars](https://img.shields.io/github/stars/korgmen/table-habit-tracker)](https://github.com/korgmen/table-habit-tracker/stargazers)
[![GitHub last commit](https://img.shields.io/github/last-commit/korgmen/table-habit-tracker)](https://github.com/korgmen/table-habit-tracker/commits/main)
[![GitHub issues](https://img.shields.io/github/issues/korgmen/table-habit-tracker)](https://github.com/korgmen/table-habit-tracker/issues)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://github.com/korgmen/table-habit-tracker/blob/main/LICENSE.txt)

[Русский](./README.md) | [English](./README.en.md) | [العربية](./README.ar.md) | [中文](./README.zh.md)

**Table** es un rastreador de hábitos multifuncional que te ayuda a seguir el cumplimiento diario de tareas, construir hábitos sostenibles y analizar el progreso. La aplicación funciona tanto en el navegador como PWA (Progressive Web App), soporta modo offline, sincronización con Google y la impresión de tablas para rellenar manualmente.

Stack moderno: Vue 3, Vite, Pinia, TailwindCSS, vue-i18n, vue-draggable-next, Lucide icons, ESLint, Prettier, Firebase (para autenticación y sincronización), Vite PWA.

La aplicación almacena los datos localmente en el navegador (localStorage), con archivo mensual. Máximo 20 tareas y 8 subtareas por tarea para un rendimiento óptimo.

![Captura de pantalla de la app](https://lebedevcode.ru/table-screenshot-es.png)

---

## Multilingüe
- Toda la interfaz está traducida (ver `src/locales/`).
- Idiomas soportados: ruso, inglés, árabe, español, chino.
- El idioma se puede cambiar en la configuración o usar el del sistema.

## Funcionalidades
- **Tareas y subtareas**: Añadir, editar, eliminar tareas y subtareas (hasta 8 subtareas por tarea). Drag&Drop para reordenar tareas (vue-draggable-next).
- **Marcas diarias**: Marcas diarias: completado (círculo relleno), no completado (vacío), salto (cruz — el día no cuenta en las estadísticas). Soporte de doble toque en móviles para cambiar rápidamente (simple — completado/borrado, doble — salto). En PC: clic izquierdo — completado/borrado, clic derecho — salto.
- **Modos de trabajo**: 
  - Modo borrador para eliminar marcas rápidamente.
  - Modo de eliminación de tareas.
- **Navegación mensual**: Cambia de mes, consulta el archivo de meses anteriores (los datos se guardan por mes en localStorage). Archivo automático al cambiar de mes.
- **Estadísticas**: Cálculo de porcentaje de cumplimiento por tarea, promedio general, valoración en escala de 5 puntos. Dos modos de cálculo: todo el mes o solo días pasados.
- **Exportar/importar datos**: Exportar a JSON, importar desde archivo. Total compatibilidad con el archivo.
- **Cambio de tema**: Claro, oscuro o sistema (automático según la configuración del SO).
- **Cambio de idioma**: Ruso, inglés, árabe, español, chino o sistema.
- **Configuración de visualización**: Separadores de semana (líneas verticales), elección de inicio de semana (lunes/domingo).
- **Atajos de teclado**: Control rápido (Escape — reset, E — borrar, D — eliminar, N — nueva tarea, flechas — cambiar mes, S — configuración).
- **Impresión**: Soporte para imprimir la tabla limpia (sin botones ni interfaz) para rellenar manualmente en papel.
- **Soporte PWA**: Instalación como app móvil, trabajo offline, actualización automática con notificación.
- **Sincronización**: Inicio de sesión con Google para sincronizar datos en la nube (Firebase). Carga/guardado automático al iniciar sesión.
- **Modales**: Explicación de bienvenida en el primer inicio, confirmaciones para duplicar tareas, notificación de actualización de PWA.
- **Duplicado de tareas**: Copia tareas del mes anterior al actual.
- **Diseño adaptable**: Totalmente responsivo para móviles y tablets.
- **Limitaciones y optimización**: Máximo 20 tareas para rendimiento; guardado automático de configuración y datos entre sesiones.

## Estructura del proyecto
- `src/App.vue` — componente principal de la app (tabla, encabezado, modales).
- `src/main.js` — inicialización de Vue, Pinia, i18n, Firebase.
- `src/stores/habitStore.js` — Pinia store: gestión de tareas, progreso, tema, idioma, archivo, exportación/importación, configuración de semanas, autenticación y sincronización.
- `src/locales/` — archivos de localización (JSON por idioma).
- `src/components/` — componentes: Header, TableHeader, TaskRow, Modal, SettingsModal, Controls, OverallStats y otros.
- `src/composables/` — hooks: useHabitUtils (utilidades para semanas/temas), useModals (modales).
- `src/style.css` — estilos globales, TailwindCSS y fuentes personalizadas.
- `src/firebase.js` — configuración de Firebase para autenticación y Firestore.
- Configs: `vite.config.js` (Vite, PWA, Tailwind), `eslint.config.js` (ESLint), `.prettierrc` (Prettier), `package.json` (dependencias y scripts).

## Inicio rápido
1. Clona el repositorio:
   ```sh
   git clone https://github.com/korgmen/table-habit-tracker.git
   cd table-habit-tracker
   ```
2. Instala las dependencias:
   ```sh
   pnpm install
   ```
3. Ejecuta en modo desarrollo:
   ```sh
   pnpm run dev
   ```
4. Compila para producción:
   ```sh
   pnpm run build
   ```
5. Revisa el código:
   ```sh
   pnpm run lint        # Linting ESLint
   pnpm run format      # Formateo Prettier
   ```
6. Vista previa de la compilación:
   ```sh
   pnpm run preview
   ```

Para PWA: tras la compilación, abre en el navegador e instala como app. El modo offline funciona gracias a Service Worker.

## Dependencias principales
- [Vue 3](https://vuejs.org/) — framework.
- [Vite](https://vitejs.dev/) — bundler.
- [Pinia](https://pinia.vuejs.org/) — gestión de estado.
- [TailwindCSS](https://tailwindcss.com/) — estilos.
- [vue-i18n](https://vue-i18n.intlify.dev/) — localización.
- [vue-draggable-next](https://github.com/anish2690/vue-draggable-next) — drag&drop.
- [lucide-vue-next](https://lucide.dev/) — iconos.
- [Firebase](https://firebase.google.com/) — autenticación y almacenamiento en la nube.
- [vite-plugin-pwa](https://vite-pwa-org.netlify.app/) — funciones PWA.
- Dev: ESLint, Prettier, eslint-plugin-vue, eslint-plugin-tailwindcss.

Lista completa en `package.json`.

## Arquitectura y lógica
- **Almacenamiento de datos**: localStorage para tareas, marcas y archivo (clave: `habitArchive`). Archivo mensual en formato `{ "YYYY-MM": { tasks: [...] } }`. Configuración guardada aparte (tema, idioma, semana).
- **Pinia store** (`habitStore.js`): Gestión centralizada de tareas, subtareas, marcas, estadísticas, tema, idioma, exportación/importación, semanas, modales, autenticación y sincronización con Firestore.
- **Localización**: vue-i18n con archivos JSON en `src/locales/`. Detección automática del idioma del sistema.
- **Temas**: Sistema, claro/oscuro. Se aplica al elemento raíz.
- **PWA**: Manifest en `vite.config.js` (iconos, theme_color). Actualización automática con modal.
- **Sincronización**: Firebase Auth (Google) y Firestore. Los datos se guardan en `/users/{uid}`. Carga automática al iniciar sesión.
- **Modales**: Componente universal para confirmaciones, alertas, contenido personalizado (bienvenida, actualización).
- **Optimización**: Carga perezosa, diseño responsivo, soporte táctil, accesibilidad (ARIA, focus trap).

## Atajos de teclado
- Escape — reset de modos, cerrar menú/configuración.
- E — cambiar a modo borrador.
- D — cambiar a modo eliminar.
- N — añadir nueva tarea.
- Flecha izquierda/derecha — cambiar mes.
- S — abrir/cerrar configuración.

## Contribución
¡Las contribuciones son bienvenidas! 
- Haz fork del repositorio y crea una rama para tu feature/fix.
- Sigue el estilo de código (Prettier, ESLint).
- Usa los componentes y store existentes.
- Para nuevos idiomas — añade traducciones en `src/locales/` (JSON).
- Antes del pull request: `pnpm run lint && pnpm run format`.
- Describe los cambios en el PR, añade tests si es necesario.

¿Preguntas? Abre un issue.

## Licencia
Apache-2.0 – [LICENSE.txt](./LICENSE.txt) | [NOTICE.txt](./NOTICE.txt)