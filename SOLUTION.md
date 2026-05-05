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

4. Total rows:
   - As data increases, counting all rows to return the total profiles is expensive
   - I initialize the project to store the total in redis cache and increment or decrement it when there is a add or delete.
