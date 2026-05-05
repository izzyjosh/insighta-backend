1. Implement cache:
   Most of the queries performed are repeated, hence the need for cache.
   - this help to reduce load that gets to the database
   - data is returned from cache if the key exist
   - if cache miss, query is processed and stored in cache

   Trade Off:
   - returning stale data for a short period of time

2. Implement Indexing:
   Indexing is just like making columns that are frequently used to be easily queried so that the database does not perform full row scan

   Trade Off:
   - Slower write which is allowable as the system is more of read queries

3. Increase Connection pooling:
   - increase pool value from 10 to 25 so that it scales properly based on traffic

4. Move export profiles to worker since profile data increases time for xporting will take longer

5. Implement Bulk Upload
   - Add uploaded file to a path
   - Add upload to queue
   - worker consumes queue and handle upload
   - Exposed an endpoint for checking upload status

6. Caching of the total profiles from a query so that large data queries doesn't execute multiple times

7. Only admin can upload profiles

8. Add an endpoint for batch upload status to get the status of uploads as it is handled by a separate worker
   - I use redis to store progrs per batch upload.

9. Streaming CSV with Chunked Processing:
   - Parse CSV in 500-row chunks instead of loading entire file to memory
   - Each chunk validated and inserted in batch via queryBuilder.orIgnore()

   Trade Offs:
   - Slightly slower for small files (<1000 rows) due to chunking overhead
   - Memory efficient for large files (500k rows) - constant O(1) memory usage
   - Better UX: live progress updates instead of opaque delay
   - Risk: incomplete uploads if worker crashes (mitigated by checkpoint/resume)

10. Deterministic Query Normalization for Cache Keys:
    - Convert all query filters to canonical form before hashing (sorted JSON, normalized values)
    - Ensures "women in Nigeria age 20-45" and "age 20 to 45 in nigeria where gender=female" produce same cache key

    Trade Offs:
    - Tiny overhead per query to normalize (microseconds)
    - Massive cache hit rate improvement (semantically equivalent queries share cache)
    - More predictable performance for natural language queries
    - Requires careful design of normalizer (gender synonyms, country codes, age range formats)

## Query performance — before / after (brief)

| Scenario                               |    Before (ms) |          After (ms) |
| -------------------------------------- | -------------: | ------------------: |
| Cold search (no cache)                 |    4000 - 5000 |         1000 - 2000 |
| Warm search (cache hit)                |      400 - 800 |               < 200 |
| Bulk CSV ingestion (per 500-row chunk) | N/A (streamed) | 300 - 600 per chunk |

Notes: numbers are illustrative based on hosted Redis/Postgres network latencies; "After" reflects optimizations: deterministic cache keys, cached counts, streaming uploads, and avoiding per-profile expensive parsing where possible.

## Ingestion failures and edge cases

- Validation failures: invalid rows are skipped and counted in the upload summary.
- Duplicate rows: detected per-batch (pre-query existing names) and skipped; DB unique constraint acts as a last-resort guard.
- Partial failures: worker writes intermediate status to Redis; failed chunks are reported and retried per job policy.

- Row validation: each CSV row is validated against schema; malformed rows increment `skipped` with a reason logged. The worker continues processing remaining chunks.
- Column mismatch / malformed CSV: line skipped, warning emitted, row excluded from batch insert.
- Duplicate detection: before inserting a 500-row chunk the worker runs a short query to fetch existing names for that chunk; duplicates are filtered in-memory to avoid constraint violations and reduce retries.
- Constraint collisions: inserts use `orIgnore(true)` where supported; if a unique constraint still triggers, the worker records the error and continues.
- Network failures (DB/Redis): the worker implements retry/backoff for transient network errors and persists the last-known progress to Redis so processing can resume or be inspected.
- Transactional boundaries: each chunk is processed in its own transaction to limit rollback scope; failures affect only that chunk.
- Worker crash / restart: job progress (processed rows, inserted/skipped counts) is stored in Redis periodically; on restart the worker can resume based on last checkpoint or retry the job depending on job metadata.
- Large-file safety: streaming parser never loads full file into memory; temp files are cleaned up after processing; long-running jobs are monitored and can be split if necessary.
- Observability: worker logs include per-chunk summaries and errors; final upload summary is written to Redis for client retrieval.

---
