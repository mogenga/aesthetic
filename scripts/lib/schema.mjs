// schema.mjs — a small JSON Schema (draft 2020-12 subset) validator.
// Deliberately minimal: supports the keywords this project actually uses.
// Zero dependencies. No `$ref` resolution beyond local "#/$defs/x".

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const typeOf = (v) => {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  if (Number.isInteger(v)) return 'integer';
  return typeof v;
};

const DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

/**
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validate(schema, data) {
  const errors = [];
  run(schema, data, '', schema, errors);
  return { valid: errors.length === 0, errors };
}

function resolveLocal(schema, ref) {
  if (!ref.startsWith('#/')) throw new Error(`only local refs are supported: ${ref}`);
  let node = schema;
  for (const part of ref.slice(2).split('/')) {
    node = node?.[part];
    if (node === undefined) throw new Error(`unresolvable ref: ${ref}`);
  }
  return node;
}

function run(node, value, at, root, errors) {
  if (node === true || node === undefined) return;
  if (node === false) { errors.push(`${at || '/'}: schema forbids any value`); return; }

  if (node.$ref) {
    run(resolveLocal(root, node.$ref), value, at, root, errors);
  }

  if ('const' in node && JSON.stringify(value) !== JSON.stringify(node.const)) {
    errors.push(`${at || '/'}: 期望常量 ${JSON.stringify(node.const)}，实际 ${JSON.stringify(value)}`);
  }

  if (Array.isArray(node.enum) && !node.enum.some((e) => JSON.stringify(e) === JSON.stringify(value))) {
    errors.push(`${at || '/'}: 值 ${JSON.stringify(value)} 不在枚举 ${JSON.stringify(node.enum)} 内`);
  }

  if (node.type) {
    const want = Array.isArray(node.type) ? node.type : [node.type];
    const actual = typeOf(value);
    const ok = want.some((t) => (t === 'number' ? actual === 'number' || actual === 'integer' : t === actual));
    if (!ok) {
      errors.push(`${at || '/'}: 类型应为 ${want.join('|')}，实际 ${actual}`);
      return;
    }
  }

  if (typeof value === 'number') {
    if (typeof node.minimum === 'number' && value < node.minimum) {
      errors.push(`${at}: ${value} 小于最小值 ${node.minimum}`);
    }
    if (typeof node.maximum === 'number' && value > node.maximum) {
      errors.push(`${at}: ${value} 大于最大值 ${node.maximum}`);
    }
  }

  if (typeof value === 'string') {
    if (typeof node.minLength === 'number' && value.length < node.minLength) {
      errors.push(`${at}: 长度 ${value.length} 小于 minLength ${node.minLength}`);
    }
    if (node.pattern && !new RegExp(node.pattern).test(value)) {
      errors.push(`${at}: "${value}" 不匹配 pattern ${node.pattern}`);
    }
    if (node.format === 'date-time' && !DATE_TIME.test(value)) {
      errors.push(`${at}: "${value}" 不是 ISO-8601 date-time`);
    }
  }

  if (Array.isArray(value)) {
    if (typeof node.minItems === 'number' && value.length < node.minItems) {
      errors.push(`${at}: 数组长度 ${value.length} < minItems ${node.minItems}`);
    }
    if (typeof node.maxItems === 'number' && value.length > node.maxItems) {
      errors.push(`${at}: 数组长度 ${value.length} > maxItems ${node.maxItems}`);
    }
    if (node.items) {
      value.forEach((v, i) => run(node.items, v, `${at}/${i}`, root, errors));
    }
  }

  if (isObj(value)) {
    for (const key of node.required || []) {
      if (!(key in value)) errors.push(`${at || '/'}: 缺少必填字段 \`${key}\``);
    }
    const props = node.properties || {};
    for (const [key, v] of Object.entries(value)) {
      if (props[key]) {
        run(props[key], v, `${at}/${key}`, root, errors);
      } else if (node.additionalProperties === false) {
        errors.push(`${at || '/'}: 不允许的字段 \`${key}\``);
      } else if (isObj(node.additionalProperties)) {
        run(node.additionalProperties, v, `${at}/${key}`, root, errors);
      }
      if (node.propertyNames) {
        run(node.propertyNames, key, `${at}/<key:${key}>`, root, errors);
      }
    }
  }
}
