# PaquetExpress Tracking Scraper

Apify actor that scrapes shipment tracking details from
[paquetexpress.com.mx](https://www.paquetexpress.com.mx) and outputs structured JSON.

The tracking page renders its data client-side, so the actor drives a headless
browser (Playwright) and transforms the rendered DOM into JSON.

## Input

```json
{
  "trackingNumbers": ["111253951107"]
}
```

| Field | Type | Description |
| --- | --- | --- |
| `trackingNumbers` | string[] | PaquetExpress tracking numbers (guias) to look up. Required. |
| `proxyConfiguration` | object | Optional Apify proxy settings. The site is public; usually not needed. |

## Output

One JSON object per tracking number in the default dataset:

```json
{
  "trackingNumber": "111253951107",
  "guide": "MOCK00WE0000000",
  "reference": "MOCK-REFERENCE-000",
  "shippingDate": "05 De Enero Del 2026",
  "deliveryService": "A domicilio",
  "destinationBranch": "Calle Falsa 123, Colonia Ejemplo",
  "origin": { "code": "ORG01", "cityState": "Ciudad Origen, Estado", "country": "Mexico" },
  "destination": { "code": "DES01", "cityState": "Ciudad Destino, Estado", "country": "Mexico" },
  "status": "Entregado",
  "statusStep": 5,
  "steps": ["Mercancía documentada", "En tránsito", "En sucursal de destino", "Entrega a Domicilio", "Entregado"],
  "estimatedDeliveryDate": "",
  "electronicSignature": { "dataUri": "data:image/png;base64,AAAA...", "mimeType": "image/png", "bytes": 2600 },
  "movements": [
    {
      "time": "10:00",
      "date": "10 De Enero Del 2026",
      "description": "Envío Entregado A Domicilio, recibió nombre",
      "location": "Ciudad Destino, Estado, Mexico"
    }
  ],
  "sourceUrl": "https://www.paquetexpress.com.mx/rastreo/111253951107",
  "scrapedAt": "2026-10-12T00:00:00.000Z"
}
```

Unknown or invalid tracking numbers produce a record with `"error": "not_found"` and
empty fields instead of crashing the run.

## Run locally

```bash
npm install
npx playwright install chromium
node src/main.js 111253951107
```

The full JSON result array is also printed to stdout at the end of a run.
Multiple numbers are accepted: `node src/main.js 111253951107 111253951102`.

## Run on Apify

Push this repository to Apify (or use `apify push`). The `Dockerfile` and
`.actor/` configuration are already set up; input takes `trackingNumbers`.
