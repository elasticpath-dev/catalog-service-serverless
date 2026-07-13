# Catalog Service

Product catalog API for ecommerce storefronts: AWS Lambda + API Gateway (HTTP API) + DynamoDB, built with the Serverless Framework (v3) in TypeScript.

- Products with core attributes (`name`, `description`, `sku`, `slug`), image URLs, and free-form custom `attributes` (key-value pairs)
- Product variations, each with its own variation SKU and option values (e.g. `{ "size": "M", "color": "Red" }`) plus optional variation-specific images
- Hierarchical category taxonomy (e.g. Men → Tops → Shirts) for top navigation, with products assigned to one or more categories
- PLP endpoint that **rolls up the hierarchy**: a product in Shirts is also returned when listing Tops or Men
- Search products by `id`, `sku` (parent product SKU), or `slug`
- Multi-currency prices in a separate table: required list price, optional sale price ("was/now" on PDP/PLP), keyed by SKU + currency. Variations without their own price inherit the parent product's price per currency
- Sample clothing data upserted on deploy, auto-seeded locally, plus a manual seed script

## Prerequisites

- Node.js 20+
- Java JRE 17+ (required by DynamoDB Local via the `serverless-dynamodb` plugin). On macOS: `brew install openjdk`, then make sure `java` is on your PATH, e.g. add `export PATH="/opt/homebrew/opt/openjdk/bin:$PATH"` to your shell profile.

## Getting started (local)

```bash
npm install
npx serverless dynamodb install   # one-time download of DynamoDB Local
npm run dev                       # starts DynamoDB Local :8000 + API :3000, creates tables, auto-seeds
```

Then:

```bash
curl http://localhost:3000/products
curl http://localhost:3000/categories/tree
curl http://localhost:3000/categories/men/products
```

## Seeding

Seed data lives in [data/](data/) (`products.json`, `categories.json`, `product-categories.json`, `prices.json`) with **fixed ids/keys**, so seeding is an idempotent upsert: re-running never duplicates, existing items keep their `createdAt`. Seed prices cover USD and EUR, two products on sale, and one variation-level override (the XL hoodie costs more).

| How | When |
| --- | --- |
| `serverless-dynamodb` auto-seed | Automatically on `npm run dev` (local tables created + seeded on startup) |
| `seed` Lambda | Automatically on `npm run deploy` (`serverless deploy && serverless invoke -f seed`) |
| `npm run seed` | Manual, against local DynamoDB (`http://localhost:8000`) |
| `npm run seed:aws -- --stage dev` | Manual, against deployed AWS tables |

## API

Machine-readable definitions:

- **OpenAPI 3.0 spec**: [openapi.yaml](openapi.yaml) — full request/response schemas for every endpoint
- **Postman collection**: [postman/catalog-service.postman_collection.json](postman/catalog-service.postman_collection.json) — import into Postman; `baseUrl` defaults to `http://localhost:3000`, with `productId`, `categoryIdOrSlug`, and `sku` collection variables pre-set to seed data

Products:

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/products` | Create (unique `sku`/`slug`; `categoryIds` must exist) |
| `GET` | `/products` | List, paginated (`?limit=`, `?nextToken=`) |
| `GET` | `/products/search` | Exactly one of `?id=`, `?sku=`, `?slug=` |
| `GET` | `/products/{id}` | Get by id |
| `PUT` | `/products/{id}` | Partial update (any of name/description/sku/slug/images/attributes/categoryIds/variations — variations are replaced wholesale when provided) |
| `DELETE` | `/products/{id}` | Delete (also removes category mappings) |

Categories:

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/categories` | Create (unique `slug`; optional `parentId`) |
| `GET` | `/categories` | Flat list |
| `GET` | `/categories/tree` | Nested taxonomy tree (top navigation) |
| `GET` | `/categories/{idOrSlug}` | Get by id or slug |
| `PUT` | `/categories/{id}` | Update / re-parent (cycles rejected; `parentId: null` moves to top level) |
| `DELETE` | `/categories/{id}` | Delete (409 if it has child categories) |
| `GET` | `/categories/{idOrSlug}/products` | **PLP**: products in the category and all descendants, paginated |

Prices:

| Method | Path | Description |
| --- | --- | --- |
| `PUT` | `/prices` | Upsert a price for `{ sku, currency, listPrice, salePrice? }` (amounts are integers in minor units — cents) |
| `GET` | `/prices/{sku}` | Raw price rows for a SKU across currencies (`?currency=` to filter). No parent fallback here |
| `DELETE` | `/prices/{sku}/{currency}` | Remove one currency's price for a SKU |

Product responses carry prices automatically:

- `GET /products/{id}` and `GET /products/search` return `prices` on the product **and on every variation**, with per-currency fallback: a variation without its own price row inherits the parent product's price for that currency.
- `GET /products` and `GET /categories/{idOrSlug}/products` (PLP) attach product-level `prices` (what listing cards show).
- All of these accept `?currency=USD` to narrow the `prices` array to one currency.
- A price with `salePrice` is on sale — render `listPrice` as "was" and `salePrice` as "now".

```bash
curl -X PUT http://localhost:3000/prices \
  -H 'Content-Type: application/json' \
  -d '{ "sku": "CLO-TEE-001", "currency": "GBP", "listPrice": 2200, "salePrice": 1799 }'
```

Errors use a consistent shape: `{ "error": { "code": "...", "message": "..." } }`.

### Example: create a product

```bash
curl -X POST http://localhost:3000/products \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Oxford Button-Down Shirt",
    "description": "Classic oxford cloth shirt",
    "sku": "CLO-SHI-006",
    "slug": "oxford-button-down-shirt",
    "images": ["https://placehold.co/600x800?text=Oxford"],
    "attributes": { "color": "Light Blue", "material": "100% Cotton" },
    "categoryIds": ["cat-mens-shirts"],
    "variations": [
      { "sku": "CLO-SHI-006-M", "options": { "size": "M", "color": "Light Blue" } },
      { "sku": "CLO-SHI-006-L", "options": { "size": "L", "color": "Light Blue" } }
    ]
  }'
```

Product SKUs are unique across products; variation SKUs are unique within their product. Search matches the parent product SKU:

```bash
curl 'http://localhost:3000/products/search?sku=CLO-TEE-001'
# -> the Classic Cotton Crew Tee product, including all of its variations
```

## Data model

Four DynamoDB tables (`${stage}`-suffixed):

| Table | Keys | Indexes |
| --- | --- | --- |
| `catalog-products-*` | `id` | `sku-index`, `slug-index` |
| `catalog-categories-*` | `id` | `slug-index`, `parent-index` (sparse — top-level categories omit `parentId`) |
| `catalog-product-categories-*` | `categoryId` + `productId` | `product-index` |
| `catalog-prices-*` | `sku` + `currency` | — |

Variations are embedded on the product item, so a single `GET /products/{id}` returns everything a PDP needs. Search-by-SKU matches the parent product SKU via `sku-index` (variation SKUs are not indexed).

The junction table exists because DynamoDB can't index a list attribute. Junction rows are written only for a product's *directly assigned* categories; the PLP endpoint expands the requested category to all descendants in memory (taxonomies are small) and queries per category. Re-parenting a category therefore never requires rewriting product mappings.

## Deploy

```bash
npm run deploy            # dev stage; runs the seed Lambda after deploy
npx serverless deploy --stage prod
```
