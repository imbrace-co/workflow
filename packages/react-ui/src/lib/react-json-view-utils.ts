const IDENTIFIER_RE = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const NUMERIC_RE = /^\d+$/;

export function safeJsonStringify(value: unknown): string {
  const str = JSON.stringify(value, null, 2);
  return typeof str === 'string' ? str : String(value);
}

export function rjvBuildKeys(
  namespace: Array<string | null | undefined> | undefined,
  name: string | null | undefined,
): string[] {
  const namespaceKeys = (namespace ?? []).filter(
    (k): k is string => typeof k === 'string' && k.length > 0,
  );
  const nameKey = typeof name === 'string' && name.length > 0 ? name : null;
  if (nameKey && namespaceKeys[namespaceKeys.length - 1] !== nameKey) {
    return [...namespaceKeys, nameKey];
  }
  return namespaceKeys;
}

export function getValueAtPath(src: unknown, keys: string[]): unknown {
  if (keys.length === 0) {
    return src;
  }
  let current: any = src;
  let pathKeys = keys;

  // react-json-view sometimes includes a "root" namespace segment, even when name={false}.
  if (
    pathKeys[0] === 'root' &&
    current != null &&
    typeof current === 'object' &&
    !(pathKeys[0] in (current as any))
  ) {
    pathKeys = pathKeys.slice(1);
  }

  for (const rawKey of pathKeys) {
    if (current == null) {
      return undefined;
    }
    const key: any = NUMERIC_RE.test(rawKey) ? Number(rawKey) : rawKey;
    current = current[key];
  }
  return current;
}

export function jsonPathFromKeys(keys: string[]): string {
  let path = '$';
  for (const key of keys) {
    if (NUMERIC_RE.test(key)) {
      path += `[${key}]`;
    } else if (IDENTIFIER_RE.test(key)) {
      path += `.${key}`;
    } else {
      const escaped = key.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      path += `["${escaped}"]`;
    }
  }
  return path;
}

export function valueToClipboardText(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  switch (typeof value) {
    case 'string':
      return value;
    case 'number':
    case 'boolean':
      return String(value);
    default:
      return safeJsonStringify(value);
  }
}


