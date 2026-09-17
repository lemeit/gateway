// lemeit-gateway — Worker de Cloudflare que unifica los 3 portales de la Red
// Ambiental (aq / emas / wq) bajo un solo origen: app.lemeit.ar.
//
// Dos trabajos:
//
// 1) app.lemeit.ar/aq/*, /emas/*, /wq/* → reverse-proxy transparente hacia
//    el *.pages.dev de cada proyecto (no hacia el subdominio viejo, para no
//    generar un loop de redirects con el punto 2).
//
// 2) aq.lemeit.ar/*, emas.lemeit.ar/*, wq.lemeit.ar/* → redirect 301
//    permanente a la ruta equivalente en app.lemeit.ar. Estas rutas solo
//    hacen efecto una vez que se les saca el Custom Domain a los proyectos
//    de Pages correspondientes y se agrega la ruta de Worker en su lugar
//    (ver README.md de este repo para el orden exacto — NO se debe hacer
//    antes de confirmar que app.lemeit.ar/* ya sirve bien los 3 portales).

const BACKENDS = {
  aq: "https://purpleair-saladillo.pages.dev",
  emas: "https://ema-saladillo.pages.dev",
  wq: "https://agua-saladillo.pages.dev",
};

const OLD_HOST_PREFIX = {
  "aq.lemeit.ar": "aq",
  "emas.lemeit.ar": "emas",
  "wq.lemeit.ar": "wq",
};

export default {
  async fetch(request) {
    const url = new URL(request.url);

    // — Subdominios viejos ya divulgados → redirect permanente —
    const oldPrefix = OLD_HOST_PREFIX[url.hostname];
    if (oldPrefix) {
      const dest = new URL(url.toString());
      dest.hostname = "app.lemeit.ar";
      dest.pathname = `/${oldPrefix}${url.pathname}`;
      return Response.redirect(dest.toString(), 301);
    }

    // — A partir de acá, host === app.lemeit.ar —
    const parts = url.pathname.split("/").filter(Boolean);
    const section = parts[0];

    if (!section) {
      // Raíz del dominio sin sección: aterriza en Aire Escolar por default.
      return Response.redirect("https://app.lemeit.ar/aq/", 302);
    }

    const backend = BACKENDS[section];
    if (!backend) {
      return new Response("No encontrado", { status: 404 });
    }

    // "/aq" sin barra final: se redirige a "/aq/" para que las rutas
    // relativas de cada sitio (favicon.svg, manifest.json, icons/...)
    // resuelvan tomando /aq/ como directorio base, no la raíz del dominio.
    if (parts.length === 1 && !url.pathname.endsWith("/")) {
      return Response.redirect(`https://app.lemeit.ar/${section}/`, 301);
    }

    const upstreamPath = "/" + parts.slice(1).join("/");
    const upstreamUrl = backend + upstreamPath + url.search;
    const upstreamReq = new Request(upstreamUrl, request);
    const resp = await fetch(upstreamReq);

    // Se devuelve el response del Pages de origen tal cual (mismo
    // content-type, cache-control, etc.), solo cambia la URL desde la que
    // se sirvió.
    return new Response(resp.body, resp);
  },
};
