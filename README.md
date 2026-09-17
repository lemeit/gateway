# lemeit-gateway

Worker de Cloudflare que unifica los 3 portales de la Red Ambiental
(`aq.lemeit.ar`, `emas.lemeit.ar`, `wq.lemeit.ar`) bajo un solo origen,
**`app.lemeit.ar`**, para que una vez instalada la PWA cambiar de portal sea
navegación interna en vez de abrir el navegador — y redirige los 3
subdominios viejos hacia el nuevo dominio (`aq.lemeit.ar` → ya divulgado en
la reunión, se redirige desde el día 1; `emas`/`wq` se redirigen también,
aunque todavía no se divulgaron con el nombre viejo).

No reemplaza ni fusiona los repos de cada portal (`lemeit-aq`, `lemeit-emas`,
`lemeit-wq`) — siguen siendo proyectos y deploys de Cloudflare Pages
independientes. Este Worker es solo una capa de ruteo fina arriba, mismo
patrón que ya usa `lemeit-aq/worker` para `api.lemeit.ar/aq`.

## Orden de pasos (importante hacerlo en este orden, es un dominio ya
público y con `aq.lemeit.ar` ya divulgado)

**1. Crear el repo y el DNS — sin riesgo, nada roto todavía**

```powershell
# Crear el repo lemeit-gateway en GitHub (vacío), después:
git clone https://github.com/lemeit/lemeit-gateway.git
# copiar wrangler.toml y src/index.js de este paquete al repo
cd lemeit-gateway
git add wrangler.toml src/index.js README.md
git commit -m "feat: gateway inicial para app.lemeit.ar"
git push
```

En Cloudflare Dashboard → DNS de `lemeit.ar`, agregar un registro dummy
(igual que se hizo para `api.lemeit.ar`) para que Cloudflare intercepte el
hostname nuevo:

| Tipo | Nombre | Contenido | Proxy |
|---|---|---|---|
| A | `app` | `192.0.2.1` | Proxied (nube naranja) |

**2. Deployar el Worker — todavía sin riesgo**

```powershell
cd lemeit-gateway
npx wrangler deploy
```

Con esto `app.lemeit.ar/aq/`, `/emas/`, `/wq/` ya deberían andar — pero
`aq.lemeit.ar`, `emas.lemeit.ar` y `wq.lemeit.ar` **siguen sirviendo el sitio
directo como hasta ahora**, porque el Custom Domain de cada Pages todavía
apunta ahí (un Worker Route no le gana a un Custom Domain de Pages en el
mismo hostname). Nada se rompe todavía.

**3. Probar antes de tocar nada más**

Abrir `https://app.lemeit.ar/aq/`, `https://app.lemeit.ar/emas/` y
`https://app.lemeit.ar/wq/` y confirmar que cada portal carga bien: datos,
íconos, CSS de `design.lemeit.ar`, el switcher de portales (todavía va a
llevar a los subdominios viejos, eso se cambia en el paso 5).

**4. Recién ahora, sacar el Custom Domain viejo — portal por portal**

En Cloudflare Dashboard → Workers & Pages:

- Proyecto `purpleair-saladillo` → Custom domains → quitar `aq.lemeit.ar`
  (esto es lo urgente, ya divulgado en la reunión).
- Probar `https://aq.lemeit.ar` → debería redirigir a
  `https://app.lemeit.ar/aq/`.
- Si anda bien, repetir con `ema-saladillo` (quitar `emas.lemeit.ar`) y
  `agua-saladillo` (quitar `wq.lemeit.ar`).

Quitar el Custom Domain NO borra el deploy — el proyecto sigue publicado en
su `*.pages.dev`, que es justamente lo que este Worker usa como origen. Por
eso el orden importa: si se saca el Custom Domain antes de que el Worker
esté deployado y probado, esos 3 sitios quedan momentáneamente sin servir
nada.

**5. Actualizar el switcher de portales**

Recién en este punto, en `lemeit-design/lemeit-common.js`, cambiar el
`SITES` array para que las URLs apunten a `https://app.lemeit.ar/aq`,
`/emas`, `/wq` en vez de los subdominios viejos — ahí es donde realmente se
resuelve lo de "se abre como navegador" al cambiar de portal, porque pasa a
ser navegación al mismo origen. Redeployar `design.lemeit.ar`.

## Pendiente / a definir más adelante

- Un `manifest.json` + `sw.js` único en la raíz de `app.lemeit.ar` (con
  `scope: "/"`) para que el sistema ofrezca instalar una sola app en vez de
  una por portal — por ahora cada portal sigue con su propio manifest
  (`emas`/`wq` todavía no tienen uno, eso es aparte).
- Qué ícono/color usa la app unificada (ninguno de los 3 actuales es
  "neutral" entre los tres portales).
