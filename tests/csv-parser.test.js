const test = require('node:test');
const assert = require('node:assert/strict');
const { Readable } = require('node:stream');
const jiti = require('jiti')(__filename);

const { streamCSVChunks } = jiti('../src/utils/csv-parser.ts');

test('streamCSVChunks yields parsed rows in batches and skips malformed rows', async () => {
  const csv = [
    'name,gender,age',
    'Alice,female,20',
    'Bob,male,25',
    'bad,row',
    'Charlie,female,30',
  ].join('\n');

  const stream = Readable.from([csv]);
  const chunks = [];

  for await (const chunk of streamCSVChunks(stream, 2)) {
    chunks.push(chunk);
  }

  assert.equal(chunks.length, 2);
  assert.deepEqual(chunks[0], [
    { name: 'Alice', gender: 'female', age: '20' },
    { name: 'Bob', gender: 'male', age: '25' },
  ]);
  assert.deepEqual(chunks[1], [
    { name: 'Charlie', gender: 'female', age: '30' },
  ]);
});

test('streamCSVChunks handles quoted values with commas', async () => {
  const csv = ['name,city', '"Ada, Lovelace",London'].join('\n');

  const stream = Readable.from([csv]);
  const chunks = [];

  for await (const chunk of streamCSVChunks(stream, 10)) {
    chunks.push(chunk);
  }

  assert.deepEqual(chunks, [[{ name: 'Ada, Lovelace', city: 'London' }]]);
});
