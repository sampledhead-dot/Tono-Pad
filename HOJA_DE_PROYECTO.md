# TonoPad — hoja de proyecto

## Descripción
App web (sin dependencias, funciona con doble clic en `index.html` o el standalone) que, a partir de un audio:
1. Detecta tempo, compases y **partes** (intro, estrofa, estribillo, puente/solo, final) y sugiere el bucle de cada una.
2. Deja elegir una región con zoom hasta nivel de muestra (imán a compases/pulsos y a cruce por cero).
3. Detecta tono y escala de la región (cromagrama armónico + bajo, afinación global en cents).
4. Propone **dos escalas**: A = la detectada, B = la alternativa compatible más segura (sin notas que el audio no confirme).
5. Genera 16 notas por escala (25 sonidos, ~3 s) tocables en pads con disposición SP-404MKII.
6. Exporta: SP-404MKII (IMPORT/…/A,B), Ableton Move (.ablbundle), MPC Sample (WAV ordenados), Ableton Live (.adg), WAV zip, MIDI.

## Arquitectura (src/js)
- `report.js` informe de errores .txt (versión, entorno, cronología, consola) · `music.js` escalas, layouts, `suggestScales`
- `dsp.js` detección de tono · `struct.js` tempo, compases, partes · `synth.js` síntesis offline
- `job.js` Workers (render y análisis) creados desde Blob, con fallback al hilo principal
- `wave.js` editor de región con zoom · `exporters.js` WAV/ZIP/MIDI/Move/Live (plantillas de CrazyHead en `tpl_*.js`)
- `app.js` interfaz (acordeones). Módulos escritos como funciones con nombre (`tpMusic`…) para poder inyectarlos en los Workers.
- `build.py` compila `src/` en 3 archivos y el zip. PWA: `sw.js`, `manifest.webmanifest`.

## Latencia de pads
AudioContext creado al arrancar (`latencyHint:interactive`) y reanudado en el primer toque; las 16 muestras se pre-renderizan en un Worker a la frecuencia del contexto; el toque solo lanza un `BufferSource`; el cabezal se pinta en un canvas aparte. La app muestra la latencia medida.

## Historial
- v1: primera versión (una región, 2 disposiciones A/B).
- v8: botón «Nuevo proyecto» (guarda el actual si ya estaba guardado, pregunta si no, y deja la app en blanco).
- v7: **proyectos guardados** en el navegador (IndexedDB: audio, región, partes, análisis, escalas A/B, sonidos y ajustes), autoguardado tras el primer «Guardar», abrir/borrar, y exportar/importar a archivo `.tonopad` (ZIP con `project.json` + el audio) para pasar de un dispositivo a otro.
- v6: pads tocables con controlador MIDI (Web MIDI: por pad desde una nota inicial o por coincidencia de nota; velocidad opcional) y letras del teclado visibles en los pads.
- v5: arreglo de instalación en el móvil: iconos PNG 192/512 (+maskable) en el manifest, apple-touch-icon y metas iOS (Chrome Android no instala con icono solo SVG).
- v4: la app se entrega en 3 archivos (`index.html` con CSS y JS dentro, `manifest.webmanifest`, `sw.js`), como las demás. El código fuente por módulos vive en `src/` y `build.py` lo compila.
- v3: exportador de **proyecto SP-404MKII** (`PROJECT/Pnn_NOMBRE/` con `PADCONF.BIN` y `SMPL/BANKb-pp.SMP`), deducido de un proyecto real del usuario y validado contra él (`test/test_sp404proj.js`). Banco A = escala A, banco B = escala B.
- v2: zoom y selección fina, detección de partes, dos escalas distintas, acordeones, pads sin lag (Workers), exportadores Move/Live/SP-404 al estilo de las otras apps, PWA, estilo SampledHead.

## Reglas permanentes
Entrega numerada `tonopad-vN.zip` + standalone; versión en el pie; informe de error automático (.txt) y botón visible; esta hoja en el zip; probar en navegador headless y decir qué no se probó.

## Formato del proyecto SP-404MKII (deducido, sin documentación oficial)
- `.SMP`: `RFWV` + (bytes−8) + 48000 + 2 + 16 (u32 big-endian), cabecera de 512 bytes (el resto se escribe a cero; en el original son bytes sin significado aparente), PCM 16 bit **big-endian** estéreo.
- `PADCONF.BIN`: `RFPD`, nombre en el offset 128, 160 fichas de 172 bytes desde el offset 160 (banco×16+pad). Palabras [0]=[2]=bytes del .SMP, [1]=[11]=tempo×10; el resto, como una ficha vacía.
- No se conoce el significado de las palabras 4, 5 y 15 de la ficha ni de la cabecera; se dejan por defecto.

## Límites conocidos
- El proyecto SP-404 generado no se ha probado en la máquina (solo contra el proyecto de ejemplo).
- Probado solo con canciones sintéticas (no hay música real en el entorno de pruebas). La precisión con música real está por validar.
- Tempo: puede salir al doble/mitad (botones ½×/2×). «Puente» y «solo» se unifican.
- Move, Live y SP-404 no se han probado en los equipos/programas reales; se validó la estructura de los archivos (JSON/XML/ZIP/WAV). MPC: solo WAV ordenados (sin .xpm).
- Los proyectos viven en el almacenamiento del navegador de cada dispositivo (se pierden si se borran los datos del sitio): para conservarlos, exportar a `.tonopad`. No se guardan las muestras generadas, se regeneran al abrir.
- MIDI: solo Chrome/Edge/Firefox de ordenador y con https; probado únicamente con mensajes simulados, no con un controlador real.
- Latencia con Bluetooth no controlable. No probado en iOS/Safari.
