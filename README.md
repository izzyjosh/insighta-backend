# Insighta Backend

A TypeScript + Express API that classifies a person by name using the Genderize, Agify, and Nationalize services, then persists the result in PostgreSQL with TypeORM. Supports bulk CSV uploads, natural-language search, and Redis caching for high performance.

## Features

- Accepts a `name` and validates it with Zod
- Fetches gender, age, and country data from external APIs
- Stores the computed profile in PostgreSQL
- Returns the existing record when the same name is submitted again
- Supports advanced query filtering for profile listing
- Supports pagination and sorting on listing endpoints
- **NEW**: Natural-language search query parsing (e.g., "female adults in nigeria", "women age 20-45")
- **NEW**: Bulk CSV upload with streaming 500-row chunks (supports up to 500,000 rows per file)
- **NEW**: Live upload progress tracking via Redis
- **NEW**: Multi-level caching (query cache, count cache, result cache) with deterministic keys
- Uses structured JSON success and error responses
- Comprehensive test suite for query parsing and CSV streaming

## Tech Stack

- Node.js 20+
- Express
- TypeScript
- TypeORM with PostgreSQL
- Redis (node-redis + ioredis)
- BullMQ for background job processing
- Zod for schema validation
- Pino for structured logging
- Multer for file uploads

## Requirements

- Node.js 18+
- PostgreSQL database (local or hosted)
- Redis instance (local or hosted)
- A valid database connection URL

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create a `.env` file in the project root:

```env
PORT=3000
DATABASE_URL=postgresql://user:password@localhost:5432/database_name
REDIS_URL=redis://localhost:6379
NODE_ENV=development
```

3. Start the development server:

```bash
npm run dev
```

4. Build the project:

```bash
npm run build
```

5. Start the compiled app:

```bash
npm start
```

6. Start the CSV upload worker (separate process):

```bash
npm run worker:csv:dev
```

## Available Scripts

- `npm run dev` - start the app with `nodemon` and `ts-node`
- `npm run worker:csv:dev` - start the background CSV worker with `nodemon`
- `npm run build` - compile TypeScript to `dist/`
- `npm start` - run the compiled app from `dist/app.js`
- `npm run lint` - run ESLint on `src/`
- `npm test` - run all tests (Node test runner)

## Running Locally

### Quick Start (All Services)

```bash
# Terminal 1: Main API server
npm run dev

# Terminal 2: CSV upload worker
npm run worker:csv:dev

# Terminal 3: Test requests (after server is ready)
npm test
```

### Testing API Endpoints

```bash
# 1. Create a profile
curl -X POST http://localhost:5000/api/profiles \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice"}'

# 2. List profiles
curl "http://localhost:5000/api/profiles?gender=female&limit=5"

# 3. Natural language search
curl "http://localhost:5000/api/profiles/search?q=women%20in%20nigeria%20age%2020%20to%2045"

# 4. Bulk upload CSV
curl -X POST http://localhost:5000/api/profiles/bulk-upload \
  -F "file=@profiles.csv"

# 5. Check upload status
curl "http://localhost:5000/api/profiles/bulk-upload/status?uploadId=<upload-id>"
```

## Test Suite

Run all tests:

```bash
npm test
```

### Tests Included

**File: `tests/natural-query.test.js`**

Tests the natural-language query parser and cache key generation:

1. **parseNaturalQuery extracts gender, country, and age range** ✓
   - Verifies parser converts "women in nigeria age 20 to 45" into structured filters
   - Tests: gender→female, country_id→NG, min_age→20, max_age→45
   - Covers: gender synonyms (women/female), country names (Nigeria/NG), age range formats (to/dash/through)

2. **equivalent natural queries normalize to the same cache key** ✓
   - Tests that semantically identical queries produce identical cache keys
   - Verifies: deterministic cache key generation for cache hit rate improvement

3. **normalizeSearchFilters keeps gender canonical and stable** ✓
   - Tests gender synonym normalization (woman→female, man→male)
   - Verifies: handles both string and array gender inputs
   - Ensures: consistent output format regardless of input format

4. **count cache ignores pagination while list cache includes it** ✓
   - Tests that count queries are cached per filter set (not per page)
   - Verifies: page 1 and page 2 share same count cache key
   - Validates: list queries include page number in cache key

**File: `tests/csv-parser.test.js`**

Tests the CSV streaming parser for bulk uploads:

1. **streamCSVChunks yields parsed rows in batches and skips malformed rows** ✓
   - Verifies: CSV is parsed in 500-row chunks
   - Tests: malformed rows (column mismatch) are skipped with warning
   - Validates: correct rows are included in output

2. **streamCSVChunks handles quoted values with commas** ✓
   - Tests: CSV values with quoted commas are parsed correctly
   - Verifies: RFC 4180 CSV standard compliance

### Running Tests with Output

```bash
# Run with verbose output
npm test -- --verbose

# Run only natural query tests
node --test tests/natural-query.test.js

# Run only CSV parser tests
node --test tests/csv-parser.test.js
```

## API Endpoints

### `GET /`

Health-style welcome route.

**Response**

```json
{
  "status": "success",
  "message": "Welcome to the Data Persistence API Processing Service!"
}
```

### `POST /api/profiles`

Classifies a person by name and stores the result if it does not already exist.

**Request body**

```json
{
  "name": "Alice"
}
```

**Success responses**

- `201 Created` when a new profile is saved
- `200 OK` when the profile already exists

**Example response for a new profile**

```json
{
  "status": "success",
  "data": {
    "id": "018f3f7c-2a2c-7b5d-9d7c-4e3f8b5d1a10",
    "name": "Alice",
    "gender": "female",
    "gender_probability": 0.98,
    "age": 29,
    "age_group": "adult",
    "country_id": "US",
    "country_name": "United States",
    "country_probability": 0.71,
    "created_at": "2026-04-14T20:00:00.000Z"
  }
}
```

**Example response when the profile already exists**

```json
{
  "status": "success",
  "message": "Profile already exists",
  "data": {
    "id": "018f3f7c-2a2c-7b5d-9d7c-4e3f8b5d1a10",
    "name": "Alice",
    "gender": "female",
    "gender_probability": 0.98,
    "age": 29,
    "age_group": "adult",
    "country_id": "US",
    "country_name": "United States",
    "country_probability": 0.71,
    "created_at": "2026-04-14T20:00:00.000Z"
  }
}
```

### `GET /api/profiles/:id`

Returns a single profile by id.

**Success response (`200 OK`)**

```json
{
  "status": "success",
  "data": {
    "id": "018f3f7c-2a2c-7b5d-9d7c-4e3f8b5d1a10",
    "name": "Emmanuel",
    "gender": "male",
    "gender_probability": 0.99,
    "age": 25,
    "age_group": "adult",
    "country_id": "NG",
    "country_name": "Nigeria",
    "country_probability": 0.85,
    "created_at": "2026-04-14T20:00:00.000Z"
  }
}
```

### `GET /api/profiles`

Returns stored profiles with optional filters, pagination, and sorting.

- `gender`
- `country_id`
- `age_group`
- `min_age`
- `max_age`
- `min_gender_probability`
- `min_country_probability`
- `page` (default `1`)
- `limit` (default `10`, max `50`)
- `sort_by` (`created_at`, `age`, `gender_probability`, `country_probability`)
- `order` (`asc` or `desc`)

**Example**

`GET /api/profiles?gender=male&country_id=NG&min_age=20&sort_by=age&order=asc&page=1&limit=5`

**Success response (`200 OK`)**

```json
{
  "status": "success",
  "page": 1,
  "limit": 5,
  "total": 2,
  "data": [
    {
      "id": "018f3f7c-2a2c-7b5d-9d7c-4e3f8b5d1a10",
      "name": "Emmanuel",
      "gender": "male",
      "gender_probability": 0.99,
      "age": 25,
      "age_group": "adult",
      "country_id": "NG",
      "country_name": "Nigeria",
      "country_probability": 0.85,
      "created_at": "2026-04-14T20:00:00.000Z"
    },
    {
      "id": "018f3f7c-2a2c-7b5d-9d7c-4e3f8b5d1a11",
      "name": "Sarah",
      "gender": "female",
      "gender_probability": 0.97,
      "age": 28,
      "age_group": "adult",
      "country_id": "US",
      "country_name": "United States",
      "country_probability": 0.78,
      "created_at": "2026-04-14T20:01:00.000Z"
    }
  ]
}
```

### `GET /api/profiles/search`

Searches profiles using a natural-language query.

**Query params**

- `q` (required) - natural language phrase
  - Examples: "women in nigeria", "male above 30", "teenagers under 18 in canada"
  - Supports: gender (male/female, man/woman, boy/girl), countries (Nigeria/NG), age groups (child/teen/adult/senior), and age ranges (20-45, 20 to 45, age between 20 and 45)
- `page` (default `1`)
- `limit` (default `10`, max `50`)

**Success response (`200 OK`)**

```json
{
  "status": "success",
  "page": 1,
  "limit": 10,
  "total": 1,
  "data": [
    {
      "id": "018f3f7c-2a2c-7b5d-9d7c-4e3f8b5d1a10",
      "name": "Amina",
      "gender": "female",
      "gender_probability": 0.96,
      "age": 34,
      "age_group": "adult",
      "country_id": "NG",
      "country_name": "Nigeria",
      "country_probability": 0.88,
      "created_at": "2026-04-14T20:00:00.000Z"
    }
  ]
}
```

### `DELETE /api/profiles/:id`

Deletes a profile by id.

**Success response**

- `204 No Content`

### `POST /api/profiles/bulk-upload`

Uploads a CSV file for bulk profile ingestion.

**Request**

- Multipart form-data with file field `file`
- Supported: CSV files up to 100MB
- Format: `name,gender,age` (or any other Profile columns)
- Processing: Streamed in 500-row chunks via background worker
- Performance: Does not block API server

**Response**

```json
{
  "status": "success",
  "uploadId": "550e8400-e29b-41d4-a716-446655440000",
  "message": "File upload queued for processing"
}
```

### `GET /api/profiles/bulk-upload/status?uploadId=<id>`

Returns the status of a bulk upload job.

**Response (In Progress)**

```json
{
  "uploadId": "550e8400-e29b-41d4-a716-446655440000",
  "state": "active",
  "progress": 45,
  "summary": {
    "inserted": 2250,
    "skipped": 50,
    "errors": 0
  }
}
```

**Response (Completed)**

```json
{
  "uploadId": "550e8400-e29b-41d4-a716-446655440000",
  "state": "completed",
  "progress": 100,
  "summary": {
    "inserted": 5000,
    "skipped": 125,
    "errors": 0
  }
}
```

## Validation and Errors

- `400 Bad Request` - missing body, invalid fields, or validation fails
- `422 Unprocessable Entity` - field type mismatch (e.g., name is not a string)
- `502 Bad Gateway` - external API (Genderize, Agify, Nationalize) fails
- `500 Internal Server Error` - database or unexpected error

## Architecture

### Natural Language Query Parsing

The `parseNaturalQuery()` function converts user input into structured filters:

- **Gender Extraction**: Recognizes male/female variants (man, woman, boy, girl, etc.)
- **Country Extraction**: Matches country names (Nigeria, US, UK) and ISO codes (NG, US, GB)
- **Age Range Extraction**: Parses multiple formats:
  - `age 20 to 45`, `20-45`, `20 through 45` → min_age: 20, max_age: 45
  - `above 30`, `under 25` → min_age or max_age bounds
  - `between 20 and 45` → both bounds

### Caching Strategy

**Three-tier cache:**

1. **Search Cache**: Caches full search results (profiles + pagination) per normalized query
   - TTL: 120 seconds
   - Key includes: gender, country_id, min_age, max_age, page number

2. **Count Cache**: Caches profile count per filter set (ignores pagination)
   - TTL: 120 seconds
   - Key includes: gender, country_id, min_age, max_age (NOT page)
   - Benefit: page 2 reuses count from page 1

3. **Deterministic Keys**: All keys use normalized, sorted JSON to ensure identical queries produce identical keys
   - Maximizes cache hit rate
   - Supports complex natural-language variations

### Bulk Upload Processing

- **Streaming Parser**: Reads CSV line-by-line, yields 500-row chunks
- **Background Worker**: Separate Node process (BullMQ) processes uploads without blocking API
- **Live Progress**: Updates Redis with inserted/skipped counts every chunk
- **Duplicate Handling**: Queries DB for existing names in batch, skips duplicates
- **Atomicity**: Per-chunk transactions ensure consistency on failure
- **Scalability**: Can process 500k-row files without memory issues

### Performance Targets

- **First request (cold cache)**: 1-3 seconds (external API + DB + serialization)
- **Cached requests**: 200-500ms (hosted Redis/DB network latency)
- **Bulk uploads**: Up to 500,000 rows, non-blocking background processing
- **Query parsing**: <1ms per request

## Notes

- The app uses TypeORM with PostgreSQL for persistence.
- Duplicate names are handled idempotently: the existing profile is returned instead of creating a new row.
- The database schema is configured for local development with TypeORM synchronization.
- Natural language search is case-insensitive.
- Admin role required for bulk uploads (future authentication feature).
- CSV uploads stored temporarily in `/tmp/insighta-uploads`, cleaned up after processing.
- Background workers process jobs independently; main API remains responsive during uploads.
