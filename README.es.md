## Table — Rastreador de hábitos — Vue 3 + Vite

Aplicación multifuncional para seguimiento de hábitos con soporte para tareas, subtareas, marcas diarias, exportación/importación de datos y cambio de tema e idioma. Stack moderno: Vue 3, Vite, Pinia, TailwindCSS, i18n, ESLint, Prettier.

---

## Soporte multilingüe
- Idiomas soportados: ruso, inglés, árabe, español, chino
- Todos los textos de la interfaz están localizados (ver `src/locales/index.json`)
- Puedes cambiar el idioma de la app en la configuración
- Para agregar nuevos idiomas, extiende `src/locales/index.json` y actualiza el selector de idioma

## Características
- Añadir, editar, eliminar tareas y subtareas
- Marcas diarias para cada tarea/subtarea
- Cambio de mes, vista de archivo
- Exportación e importación de datos (JSON)
- Cambio de tema (claro/oscuro/sistema)
- Cambio de idioma (ruso/inglés/árabe/español/chino/sistema)
- Drag&Drop para tareas (vue-draggable-next)
- Diseño responsivo, soporte de impresión
- Configuración de visualización de semanas: separadores de semana, elegir inicio de semana (lunes/domingo)
- Atajos de teclado para control rápido
- Todas las configuraciones se guardan entre sesiones

## Estructura del proyecto
- `src/App.vue` — componente principal de la aplicación
- `src/main.js` — inicialización de Vue, Pinia, i18n
- `src/stores/habitStore.js` — Pinia store: lógica de tareas, progreso, tema, idioma, exportación/importación, configuración de semanas
- `src/locales/index.json` — localizaciones (ru, en, ar, es, zh)
- `src/components/` — componentes adicionales (si los hay)
- `src/style.css` — TailwindCSS y estilos globales
- `public/` — archivos estáticos
- Configuración: `vite.config.js`, `eslint.config.js`, `.prettierrc`

## Inicio rápido
```sh
pnpm install         # Instalar dependencias
pnpm run dev         # Iniciar servidor de desarrollo
pnpm run build       # Compilar para producción
pnpm run lint        # Lint de código
pnpm run format      # Formatear código
```

## Dependencias principales
- [Vue 3](https://vuejs.org/) — framework
- [Vite](https://vitejs.dev/) — herramienta de compilación
- [Pinia](https://pinia.vuejs.org/) — gestión de estado
- [TailwindCSS](https://tailwindcss.com/) — estilos
- [vue-i18n](https://vue-i18n.intlify.dev/) — localización
- [vue-draggable-next](https://github.com/anish2690/vue-draggable-next) — drag&drop
- [lucide-vue-next](https://lucide.dev/) — iconos

## Arquitectura y lógica
- Todos los datos de tareas y marcas se almacenan en localStorage (archivo por mes)
- Pinia store (`habitStore.js`) gestiona tareas, subtareas, progreso, tema, idioma, exportación/importación, configuración de semanas
- Localización vía vue-i18n, traducciones en `src/locales/index.json`
- Tema, idioma y configuración de semanas son persistentes
- Drag&Drop implementado con vue-draggable-next

## Atajos de teclado
- Escape — restablecer modos, cerrar menú/configuración
- E — alternar modo borrador
- D — alternar modo eliminar
- N — añadir nueva tarea
- Flecha izquierda/derecha — cambiar mes
- S — abrir/cerrar configuración

## Contribución
- Sigue el estilo de código (Prettier, ESLint)
- Usa los componentes y store existentes
- Para nuevos idiomas — añade traducciones en `src/locales/index.json`
- Antes de pull request: `pnpm run lint && pnpm run format`

## Licencia
MIT
