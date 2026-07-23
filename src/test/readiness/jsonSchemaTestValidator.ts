type SchemaObject = Record<string, unknown>;

function isSchemaObject(value: unknown): value is SchemaObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function jsonEquals(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function resolveLocalReference(rootSchema: SchemaObject, reference: string): unknown {
  if (!reference.startsWith("#/")) {
    throw new Error(`The contract test validator supports local JSON Schema references only: ${reference}`);
  }

  return reference.slice(2).split("/").reduce<unknown>((current, encodedSegment) => {
    const segment = encodedSegment.replace(/~1/g, "/").replace(/~0/g, "~");
    if (!isSchemaObject(current) || !(segment in current)) {
      throw new Error(`JSON Schema reference does not resolve: ${reference}`);
    }
    return current[segment];
  }, rootSchema);
}

function matchesType(value: unknown, expectedType: string): boolean {
  switch (expectedType) {
    case "null":
      return value === null;
    case "array":
      return Array.isArray(value);
    case "object":
      return isSchemaObject(value);
    case "number":
      return typeof value === "number" && Number.isFinite(value);
    default:
      return typeof value === expectedType;
  }
}

function validateValue(
  rootSchema: SchemaObject,
  schemaValue: unknown,
  value: unknown,
  instancePath: string
): string[] {
  if (schemaValue === true) {
    return [];
  }
  if (schemaValue === false) {
    return [`${instancePath} is rejected by the schema.`];
  }
  if (!isSchemaObject(schemaValue)) {
    throw new Error(`Invalid JSON Schema node at ${instancePath}.`);
  }

  if (typeof schemaValue.$ref === "string") {
    return validateValue(rootSchema, resolveLocalReference(rootSchema, schemaValue.$ref), value, instancePath);
  }

  if (Array.isArray(schemaValue.oneOf)) {
    const matches = schemaValue.oneOf.filter((candidate) =>
      validateValue(rootSchema, candidate, value, instancePath).length === 0
    ).length;
    return matches === 1 ? [] : [`${instancePath} must match exactly one oneOf branch; matched ${matches}.`];
  }

  if (Array.isArray(schemaValue.anyOf)) {
    const matches = schemaValue.anyOf.some((candidate) =>
      validateValue(rootSchema, candidate, value, instancePath).length === 0
    );
    return matches ? [] : [`${instancePath} does not match an anyOf branch.`];
  }

  const errors: string[] = [];
  if ("const" in schemaValue && !jsonEquals(value, schemaValue.const)) {
    errors.push(`${instancePath} does not equal the required constant.`);
  }
  if (Array.isArray(schemaValue.enum) && !schemaValue.enum.some((candidate) => jsonEquals(value, candidate))) {
    errors.push(`${instancePath} is not in the closed enum.`);
  }

  if (typeof schemaValue.type === "string" && !matchesType(value, schemaValue.type)) {
    errors.push(`${instancePath} must be of type ${schemaValue.type}.`);
    return errors;
  }

  if (typeof value === "string") {
    if (typeof schemaValue.minLength === "number" && value.length < schemaValue.minLength) {
      errors.push(`${instancePath} is shorter than minLength ${schemaValue.minLength}.`);
    }
    if (typeof schemaValue.pattern === "string" && !new RegExp(schemaValue.pattern).test(value)) {
      errors.push(`${instancePath} does not match pattern ${schemaValue.pattern}.`);
    }
  }

  if (Array.isArray(value)) {
    if (typeof schemaValue.minItems === "number" && value.length < schemaValue.minItems) {
      errors.push(`${instancePath} has fewer than ${schemaValue.minItems} items.`);
    }
    if (schemaValue.items !== undefined) {
      value.forEach((item, index) => {
        errors.push(...validateValue(rootSchema, schemaValue.items, item, `${instancePath}/${index}`));
      });
    }
  }

  if (isSchemaObject(value)) {
    if (Array.isArray(schemaValue.required)) {
      for (const requiredProperty of schemaValue.required) {
        if (typeof requiredProperty === "string" && !Object.prototype.hasOwnProperty.call(value, requiredProperty)) {
          errors.push(`${instancePath}/${requiredProperty} is required.`);
        }
      }
    }

    const properties = isSchemaObject(schemaValue.properties) ? schemaValue.properties : {};
    for (const [propertyName, propertyValue] of Object.entries(value)) {
      const propertyPath = `${instancePath}/${propertyName}`;
      if (Object.prototype.hasOwnProperty.call(properties, propertyName)) {
        errors.push(...validateValue(rootSchema, properties[propertyName], propertyValue, propertyPath));
      } else if (schemaValue.additionalProperties === false) {
        errors.push(`${propertyPath} is not an allowed property.`);
      } else if (isSchemaObject(schemaValue.additionalProperties) || typeof schemaValue.additionalProperties === "boolean") {
        errors.push(...validateValue(rootSchema, schemaValue.additionalProperties, propertyValue, propertyPath));
      }
    }
  }

  return errors;
}

export type JsonSchemaTestValidator = (value: unknown) => string[];

export function createJsonSchemaTestValidator(rootSchemaValue: unknown, fragment?: string): JsonSchemaTestValidator {
  if (!isSchemaObject(rootSchemaValue)) {
    throw new Error("The root JSON Schema must be an object.");
  }

  const schema = fragment
    ? resolveLocalReference(rootSchemaValue, `#/$defs/${fragment}`)
    : rootSchemaValue;
  return (value: unknown): string[] => validateValue(rootSchemaValue, schema, value, "$");
}
