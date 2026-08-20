/**
 * Utility to manage special piece properties that require custom handling
 * like being hidden in the UI or flattened in the saved payload.
 */

const HIDDEN_FLATTENED_PROPERTIES = ['testing_organization_id'] as const;

/**
 * Checks if a property should be handled specially (hidden/flattened).
 */
const isSpecialProperty = (propertyName: string): boolean => {
  return HIDDEN_FLATTENED_PROPERTIES.includes(
    propertyName as (typeof HIDDEN_FLATTENED_PROPERTIES)[number],
  );
};

/**
 * Checks if a property should be hidden from the user in the piece settings forms.
 */
export const isHiddenProperty = isSpecialProperty;

/**
 * Checks if a DynamicProperty should allow string values in its schema
 * (usually because it will be flattened to its internal value on save).
 */
export const isFlattenedProperty = isSpecialProperty;
