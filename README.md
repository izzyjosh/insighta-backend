# Data Persistence API

A small TypeScript + Express API that classifies a person by name using the Genderize, Agify, and Nationalize services, then persists the result in PostgreSQL with TypeORM.

## Features

- Accepts a `name` and validates it with Zod
- Fetches gender, age, and country data from external APIs
- Stores the computed profile in PostgreSQL
- Returns the existing record when the same name is submitted again
- Supports advanced query filtering for profile listing
- Supports pagination and sorting on listing endpoints
- Supports natural-language search query parsing (for example: "female adults in nigeria")
- Uses structured JSON success and error responses

## Tech Stack

- Node.js
- Express
- TypeScript
- TypeORM
- PostgreSQL
- Zod
- Pino / pino-http

## Requirements

- Node.js 18+
- PostgreSQL database
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

## Available Scripts

- `npm run dev` - start the app with `nodemon` and `ts-node`
- `npm run build` - compile TypeScript to `dist/`
- `npm start` - run the compiled app from `dist/app.js`
- `npm run lint` - run ESLint

## API

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
- `page` (default `1`)
- `limit` (default `10`, max `50`)

**Examples**

- `GET /api/profiles/search?q=female adults in nigeria`
- `GET /api/profiles/search?q=male above 30&page=1&limit=20`
- `GET /api/profiles/search?q=teenagers under 18 in canada`

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

## Validation and Errors

The request body is validated before classification runs.

- `400 Bad Request` - missing body, missing `name`, or empty `name`
- `400 Bad Request` - natural search query cannot be interpreted
- `422 Unprocessable Entity` - `name` is not a string
- `502 Bad Gateway` - one of the external classification APIs fails
- `500 Internal Server Error` - unexpected server or database error

## Notes

- The app uses TypeORM with PostgreSQL for persistence.
- Duplicate names are handled idempotently: the existing profile is returned instead of creating a new row.
- The database schema is configured for local development with TypeORM synchronization.
