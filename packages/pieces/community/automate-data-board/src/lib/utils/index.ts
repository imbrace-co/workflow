import { countries } from '../../constants/contryData';

type JsonObject = Record<string, any>;

export function getSortedOptions(
  data: JsonObject[],
  nameKey: string,
  valueKey: string | ((item: JsonObject) => string),
  descriptionKey?: string,
) {
  return data
    .map((item) => {
      const option: { label: string; value: string; description?: string } = {
        label: item[nameKey] as string,
        value: typeof valueKey === 'function' ? valueKey(item) : (item[valueKey] as string),
      };

      if (descriptionKey && item[descriptionKey]) {
        option.description = item[descriptionKey] as string;
      }
      return option;
    })
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
}

export function formatPhoneNumberWithCountryCallingCode(defaultPhoneNumber: string) {
	if (defaultPhoneNumber.charAt(0) !== '+') {
		let country_calling_code = '';
		countries.find((country) => {
			if ('root' in country.idd) {
				const country_calling_codes = country.idd.suffixes.map(
					(suffix: string) => `${country.idd.root.split('+')[1]}${suffix}`,
				);

				country_calling_codes.forEach((callingCode: string) => {
					if (defaultPhoneNumber.startsWith(callingCode)) {
						country_calling_code = callingCode;
					}
				});
			}
		});

		if (country_calling_code) {
			// ex: '84 934177324' => '+84934177324'
			return `+${defaultPhoneNumber.replace(' ', '')}`;
		}
	}

	return defaultPhoneNumber;
}
