/* eslint-disable no-undef */
const fs = require('fs');
const path = require('path');

// Import ESM default via dynamic import to avoid CJS/ESM friction in Jest without transpilers
async function importGenerator() {
  const modulePath = path.resolve(__dirname, '..', 'src', 'utils', 'zodGenerator.js');
  return await import(modulePath);
}

describe('zodGenerator', () => {
  const fixturesDir = path.resolve(__dirname, '..', 'tests', 'fixtures');
  const ttlPath = path.join(fixturesDir, 'personal_details.ttl');
  const schemaPath = path.join(fixturesDir, 'personal_details.schema.json');

  it('has ttl fixture and schema fixture present', () => {
    expect(fs.existsSync(ttlPath)).toBe(true);
    expect(fs.existsSync(schemaPath)).toBe(true);
  });

  it('generates a zod schema that validates correct values', async () => {
    const { generateZodSchema } = await importGenerator();
    const spec = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));
    const schema = generateZodSchema(spec);

    const ok = schema.safeParse({ q_first_name: 'Alice' });
    expect(ok.success).toBe(true);
  });

  it('rejects invalid values per ontology rules', async () => {
    const { generateZodSchema } = await importGenerator();
    const spec = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));
    const schema = generateZodSchema(spec);

    // too short
    let res = schema.safeParse({ q_first_name: 'A' });
    expect(res.success).toBe(false);

    // invalid chars
    res = schema.safeParse({ q_first_name: 'Alice123' });
    expect(res.success).toBe(false);
  });

  it('applies word-to-format mapping before validation', async () => {
    const { generateZodSchema } = await importGenerator();
    const spec = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));
    const schema = generateZodSchema(spec);

    // "oh" -> "o", then pattern still matches letters/dash/apostrophe/space
    const res = schema.safeParse({ q_first_name: 'oh live' }); // -> "olive"
    expect(res.success).toBe(true);
    // transformed result should be accessible on data if using .parse; we re-parse to assert transform
    const transformed = schema.parse({ q_first_name: 'oh live' });
    expect(transformed.q_first_name).toBe('olive');
  });
});


