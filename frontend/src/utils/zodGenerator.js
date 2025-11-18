// Simple Zod schema generator from ontology-derived rules
// Input format (example):
// {
//   formId: "PersonalDetailsForm",
//   fields: [
//     {
//       fieldId: "q_first_name",
//       label: "First name",
//       required: true,
//       type: "text",
//       validation: { min_length: 2, max_length: 50, pattern: "^[A-Za-z-' ]+$" },
//       mapping: { transformation_type: "word-to-format", rules: [{ spoken: "oh", formatted: "o" }] }
//     }
//   ]
// }

import { z } from "zod";

export function applyMappingTransform(schema, mapping) {
  if (!mapping || mapping.transformation_type !== "word-to-format" || !Array.isArray(mapping.rules)) {
    return schema;
  }
  const rules = mapping.rules.reduce((acc, r) => {
    if (r.spoken && typeof r.formatted === "string") acc[r.spoken.toLowerCase()] = r.formatted;
    return acc;
  }, {});

  return z
    .string()
    .transform((val) => {
      if (typeof val !== "string") return val;
      // tokenize by whitespace and map
      const tokens = val.split(/\s+/).map((t) => {
        const mapped = rules[t.toLowerCase()];
        return typeof mapped === "string" ? mapped : t;
      });
      return tokens.join("");
    })
    .pipe(schema);
}

export function fieldToZod(field) {
  // base type
  let s = z.string();

  // validation rules
  const v = field.validation || {};
  if (typeof v.min_length === "number") s = s.min(v.min_length);
  if (typeof v.max_length === "number") s = s.max(v.max_length);
  if (typeof v.pattern === "string") {
    try {
      s = s.regex(new RegExp(v.pattern));
    } catch {
      // ignore invalid regex from ontology
    }
  }
  if (v.is_email) s = z.string().email();

  // mapping/transformers
  if (field.mapping && field.mapping.transformation_type === "word-to-format") {
    s = applyMappingTransform(s, field.mapping);
  }

  // required/optional
  if (!field.required) {
    s = s.optional();
  }

  return s;
}

export function generateZodSchema(ontologyFormSpec) {
  const shape = {};
  for (const f of ontologyFormSpec.fields || []) {
    const key = f.fieldId || f.internal_key || f.slot || f.label || "field";
    shape[key] = fieldToZod(f);
  }
  return z.object(shape);
}

export default generateZodSchema;


