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
- `fuzz.js` (v12) **FuzzHead integrado**: sus 5 motores (`TP.fuzz.renderNote`) y su cadena de efectos (`TP.fuzz.applyFx`). Es el mismo DSP que la app FuzzHead (repo FuzzHead, `web/dsp.js` v1.0.1); si se cambia allí, cambiarlo aquí igual.
- `app.js` interfaz (acordeones). Módulos escritos como funciones con nombre (`tpMusic`…) para poder inyectarlos en los Workers.
- `build.py` compila `src/` en 3 archivos y el zip. PWA: `sw.js`, `manifest.webmanifest`.

## Latencia de pads
AudioContext creado al arrancar (`latencyHint:interactive`) y reanudado en el primer toque; las 16 muestras se pre-renderizan en un Worker a la frecuencia del contexto; el toque solo lanza un `BufferSource`; el cabezal se pinta en un canvas aparte. La app muestra la latencia medida.

## Historial
- **v12** — **FuzzHead dentro de TonoPad**: (1) los 5 motores de FuzzHead (Deep, Vintage, Solo, Strings, Harmony) como sonidos de pad, con estilo propio «FuzzHead» (Deep también en la lista de bajos); (2) nueva pestaña **«Efectos FuzzHead»**: Distorsión (Soft/Hard/Rich/Wavefold, antes/después), Modulación (voces desafinadas ±30 cents en estéreo), Bitcrush, Ring Mod y Gated Reverb reordenables, mezcla general, aplicar a A, B o ambos y 7 combinaciones rápidas (presets de FuzzHead). Los efectos se aplican en `renderPad`, así que suenan en los pads y van en **todas las exportaciones** (la reverb alarga la muestra con su cola). Se guardan en los proyectos y salen en el informe de error. En Solo, la desafinación de su 2.ª onda se reparte a ambos lados (±2,6 cents) para que la nota quede centrada.
- v1: primera versión (una región, 2 disposiciones A/B).
- v10: dos zonas distintas: «Detectar → banco A / banco B» analiza la región marcada y la asigna a ese banco (B puede tener zona propia o seguir siendo la escala compatible con A). Se guarda en los proyectos.
- v9: octava de −3 a +4 (antes −1 a +1); si el reparto se sale del rango MIDI 0–127 se desplaza entero por octavas; aviso en pads si hay notas muy graves o agudas.
- v8: botón «Nuevo proyecto» (guarda el actual si ya estaba guardado, pregunta si no, y deja la app en blanco).
- v7: **proyectos guardados** en el navegador (IndexedDB: audio, región, partes, análisis, escalas A/B, sonidos y ajustes), autoguardado tras el primer «Guardar», abrir/borrar, y exportar/importar a archivo `.tonopad` (ZIP con `project.json` + el audio) para pasar de un dispositivo a otro.
- v6: pads tocables con controlador MIDI (Web MIDI: por pad desde una nota inicial o por coincidencia de nota; velocidad opcional) y letras del teclado visibles en los pads.
- v5: arreglo de instalación en el móvil: iconos PNG 192/512 (+maskable) en el manifest, apple-touch-icon y metas iOS (Chrome Android no instala con icono solo SVG).
- v4: la app se entrega en 3 archivos (`index.html` con CSS y JS dentro, `manifest.webmanifest`, `sw.js`), como las demás. El código fuente por módulos vive en `src/` y `build.py` lo compila.
- v3: exportador de **proyecto SP-404MKII** (`PROJECT/Pnn_NOMBRE/` con `PADCONF.BIN` y `SMPL/BANKb-pp.SMP`), deducido de un proyecto real del usuario y validado contra él (`test/test_sp404proj.js`). Banco A = escala A, banco B = escala B.
- v2: zoom y selección fina, detección de partes, dos escalas distintas, acordeones, pads sin lag (Workers), exportadores Move/Live/SP-404 al estilo de las otras apps, PWA, estilo SampledHead.
- **v11** — 8 sonidos de theremin (clásico, Etherwave, ciencia ficción, voz, oscuro, 8-bit, wobble, pad etéreo). Pestaña «Muestra» (admite varios archivos: se juntan en una muestra y se identifica la nota de cada uno): carga de un instrumento (bajo, guitarra, teclado…), detección de altura (YIN propio, `pitch.js`), troceado por golpes (sensibilidad ajustable, partir/unir/mover bordes, «una sola nota») y nota+cents+confianza por chop. Los pads usan el chop más cercano con cambio de tono por remuestreo (tope ±5 st automático; ±7 con aviso; ±12), prefiriendo bajar a subir; afinación fina a 0 cents; si no hay chop en el tope, suena el sintético. Cada banco (A/B) puede usar la muestra y cada mitad (pads 1–8 / 9–16) un sonido distinto. Repartos nuevos: «2 × 8 notas», acordes de tríadas y de séptimas (MIDI con las notas del acorde). Nombres con la canción (`names.js`) ajustados al límite de cada destino, con vista previa. La muestra, los chops y las fuentes se guardan en el proyecto y en `.tonopad`.

## Reglas permanentes
Entrega numerada `tonopad-vN.zip` + standalone; versión en el pie; informe de error automático (.txt) y botón visible; esta hoja en el zip; probar en navegador headless y decir qué no se probó.

## Formato del proyecto SP-404MKII (deducido, sin documentación oficial)
- `.SMP`: `RFWV` + (bytes−8) + 48000 + 2 + 16 (u32 big-endian), cabecera de 512 bytes (el resto se escribe a cero; en el original son bytes sin significado aparente), PCM 16 bit **big-endian** estéreo.
- `PADCONF.BIN`: `RFPD`, nombre en el offset 128, 160 fichas de 172 bytes desde el offset 160 (banco×16+pad). Palabras [0]=[2]=bytes del .SMP, [1]=[11]=tempo×10; el resto, como una ficha vacía.
- No se conoce el significado de las palabras 4, 5 y 15 de la ficha ni de la cabecera; se dejan por defecto.

## Límites conocidos
- **FuzzHead (v12):** la modulación de los pads se hace leyendo la muestra algo más lenta/rápida (en FuzzHead son voces del sintetizador): en notas largas las voces se van desfasando, como un chorus lento. La afinación de los motores FuzzHead se comprobó con su detector (±2 cents en Solo, <0,1 en el resto). Probado en Chrome de escritorio sin pantalla; no en móvil.
- **Código fuente:** v12 se aplicó directamente sobre `index.html` (la carpeta `src/` completa y `build.py` no están en el repositorio). El módulo nuevo está también en `src/js/fuzz.js`; si se vuelve a compilar desde `src/`, hay que añadir ese archivo al build y los cambios de `app.js`/`synth.js` (presets FuzzHead, `renderPad` con efectos, pestaña de efectos).
- El proyecto SP-404 generado no se ha probado en la máquina (solo contra el proyecto de ejemplo).
- Probado solo con canciones sintéticas (no hay música real en el entorno de pruebas). La precisión con música real está por validar.
- Tempo: puede salir al doble/mitad (botones ½×/2×). «Puente» y «solo» se unifican.
- Move, Live y SP-404 no se han probado en los equipos/programas reales; se validó la estructura de los archivos (JSON/XML/ZIP/WAV). MPC: solo WAV ordenados (sin .xpm).
- Los proyectos viven en el almacenamiento del navegador de cada dispositivo (se pierden si se borran los datos del sitio): para conservarlos, exportar a `.tonopad`. No se guardan las muestras generadas, se regeneran al abrir.
- MIDI: solo Chrome/Edge/Firefox de ordenador y con https; probado únicamente con mensajes simulados, no con un controlador real.
- Latencia con Bluetooth no controlable. No probado en iOS/Safari.
- **Muestra (v11):** solo una voz a la vez; acordes, rasgueos o percusión no se detectan bien (un acorde puede salir con confianza alta y nota errónea). Si el sonido lleva un sub una octava abajo (p. ej. el preset Reese), el detector da esa octava. Por debajo de ~28 Hz no detecta. Cambiar el tono por remuestreo cambia también la duración y el timbre (más allá de ±5 st suena a efecto). Probado solo con notas sintéticas; no con instrumentos reales.
- **Nombres (v11):** los máximos (16 caracteres en SP-404 y MPC, 31 Move, 40 Live) son suposiciones prudentes. Solo está comprobado el nombre de proyecto SP-404 (campo de 32 bytes). No se ha localizado dónde guarda la SP el nombre de cada pad dentro del proyecto: ahí solo se pone el nombre de proyecto y la lista sugerida va en LEEME.txt.
- **Guardado (v11):** la muestra se guarda dentro de un proyecto con canción; no hay proyectos solo de muestra.
- **Gate (v11):** en la app los pads suenan en gate por defecto. En el proyecto SP-404 el modo gate/one-shot de cada pad NO se escribe: no está localizado el campo en PADCONF (solo hay un proyecto de referencia, sin modos conocidos). Pendiente: un proyecto con el mismo pad en GATE y en ONE-SHOT para ubicarlo.
