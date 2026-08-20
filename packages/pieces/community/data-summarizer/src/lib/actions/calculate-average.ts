import { createAction, Property } from '@activepieces/pieces-framework';
import { common } from '../common';

export const calculateAverage = createAction({
  name: 'calculateAverage',
  displayName: 'Calculate Average',
  description: 'Calculates the average of a list of values.',
  props: {
    note: common.note,
    values: Property.Array({
      displayName: "Values",
      required: true,
    })
  },
  async run({ propsValue }) {
    const result = common.validateArray(propsValue.values);
    if (result.hasError) {
      throw new Error(JSON.stringify(result.error));
    }
    const safeResult = result as any;
    const sum = safeResult.values.reduce((acc: number, value: number) => acc + value, 0);
    return {
      average: sum / safeResult.values.length
    };
  },
});
