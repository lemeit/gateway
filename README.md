# lemeit-gateway

Worker de Cloudflare que unifica los 3 portales de la Red Ambiental
(`aq.lemeit.ar`, `emas.lemeit.ar`, `wq.lemeit.ar`) bajo un solo origen,
**`app.lemeit.ar`**, para que una vez instalada la PWA cambiar de portal sea
navegación interna en vez de abrir el navegador — y redirige los 3
subdominios viejos hacia el nuevo dominio.

No reemplaza ni fusiona los repos de cada portal (`lemeit-aq`, `lemeit-emas`,
`lemeit-wq`) — siguen siendo proyectos y deploys de Cloudflare Pages
independientes. Este Worker es solo una capa de ruteo fina arriba, mismo
patrón que ya usan `lemeit-aq/worker` y `lemeit-emas/worker` para
`api.lemeit.ar/aq` y `api.lemeit.ar/emas`.

**Estado: migrado y en producción (17/9/2026)**. Los 3 portales sirven desde
`app.lemeit.ar/aq`, `/emas`, `/wq`; los 3 subdominios viejos redirigen (301)
ahí; el switcher de portales (`lemeit-design/lemeit-common.js`) ya apunta a
las URLs nuevas; el `manifest.json` de Monitoreo Ambiental Escolar (la única
app instalable de las 3 por ahora) amplió su `scope` de `/aq/` a `/` para
que alternar de portal desde la app instalada no salga al navegador.

## Cómo se hizo (orden de pasos, para referencia futura)

**1. Crear el repo y el DNS**

Se creó este repo, se copiaron `wrangler.toml` y `src/index.js`, y en
Cloudflare Dashboard → DNS de `lemeit.ar` se agregó un registro dummy para
que Cloudflare intercepte el hostname nuevo:

| Tipo | Nombre | Contenido | Proxy |
|---|---|---|---|
| A | `app` | `192.0.2.1` | Proxied (nube naranja) |

**2. Deployar el Worker (`npx wrangler deploy`)** — con las 4 Routes ya en
`wrangler.toml` (`app`/`aq`/`emas`/`wq.lemeit.ar`), pero mientras el Custom
Domain de cada Pages siguiera activo en su subdominio viejo, ese Custom
Domain le seguía ganando a la Route del Worker en el mismo hostname — así
que nada se rompía todavía en ese punto.

**3. Probar `app.lemeit.ar/aq/`, `/emas/`, `/wq/`** antes de tocar nada más:
datos, íconos, CSS de `design.lemeit.ar`, switcher de portales.

**4. Recién ahí, sacar el Custom Domain viejo de cada proyecto de Pages —
portal por portal, probando entre uno y el siguiente.**

⚠️ **Gotcha real, no anticipado en el plan original**: sacarle el Custom
Domain a un proyecto de Pages no solo "libera" el hostname para que lo tome
la Route del Worker — **borra directamente el registro DNS que Cloudflare
había creado** para ese Custom Domain (a diferencia de un registro DNS
creado a mano, que queda). Le pasó a `emas.lemeit.ar` y `wq.lemeit.ar`
(quedaron en `NXDOMAIN`, detectado con `nslookup ... 1.1.1.1` para
descartar caché) — no le pasó a `aq.lemeit.ar`, sin una causa clara todavía.
Se resuelve igual que el paso 1: un registro `A` dummy (`192.0.2.1`,
Proxied) por cada subdominio afectado. **Al repetir esta migración con un
proyecto nuevo, conviene confirmar el DNS con `nslookup` inmediatamente
después de sacar cada Custom Domain, antes de pasar al siguiente.**

**5. Actualizar el switcher de portales** en
`lemeit-design/lemeit-common.js` (`SITES`) para que apunte a
`https://app.lemeit.ar/aq`, `/emas`, `/wq` — ahí es donde se resuelve de
verdad lo de "se abre como navegador" al cambiar de portal, porque pasa a
ser navegación al mismo origen. Redeploy de `design.lemeit.ar`.

⚠️ **Gotcha real #2, encontrado el 17/9/2026 con `creditos.html` y
`api.html` dando 404**: Cloudflare Pages redirige automáticamente
`/archivo.html` → `/archivo` (sin extensión), con un header `Location`
**relativo a la raíz del propio proyecto de Pages** — no tiene ni idea del
prefijo `/aq`, `/emas` o `/wq` que le agrega este Worker. La primera versión
de `src/index.js` devolvía la respuesta del upstream tal cual, así que ese
`Location` le llegaba crudo al browser (que le pegó a `app.lemeit.ar`, no al
`*.pages.dev`) y se resolvía contra `app.lemeit.ar` directo — perdiendo el
prefijo de sección y cayendo en el 404 propio del gateway. Pasaba con
*cualquier* archivo `.html` que no fuera `index.html` (se confirmó con
`api.html` de los 3 portales, no solo con el nuevo `creditos.html`).
Se resuelve reescribiendo el header `Location` cuando el upstream contesta
un 3xx hacia su propio origen, volviendo a anteponerle el prefijo de sección
— ver el bloque correspondiente en `src/index.js`, justo antes del
`return new Response(resp.body, resp)` final.

## Pendiente / a definir más adelante

- Un `manifest.json` + `sw.js` único en la raíz de `app.lemeit.ar` (con
  `scope: "/"`) para que el sistema ofrezca instalar una sola app en vez de
  una por portal — por ahora la única instalable es Monitoreo Ambiental
  Escolar (con `scope` ya ampliado a `/`); `emas` y `wq` todavía no tienen
  manifest propio.
- Qué ícono/color usa la app unificada (ninguno de los 3 actuales es
  "neutral" entre los tres portales).
