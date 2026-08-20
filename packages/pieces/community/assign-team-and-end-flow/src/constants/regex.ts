export const emailRegex =
	/^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
export const nameRegex = /^[A-Z][a-z]*(([,.] |[ '-])[A-Za-z][a-z]*)*(\.?)$/;
export const lastNameRegex = /(^[a-z一-龯A-Z.\][a-z一-龯A-Z\s]{0,20}[a-z一-龯A-Z]$)/;
export const firstNameRegex = /(^[a-z一-龯A-Z.\][a-z一-龯A-Z\s]{0,27}[a-z一-龯A-Z]$)/;
export const phoneNumberRegex = /^[0-9 -+]+$/;
export const ticketRegex = /\[TICKET\:[a-z0-9A-Z]{6}\]/;
export const linkRegex =
	/(https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|www\.[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9]+\.[^\s]{2,}|www\.[a-zA-Z0-9]+\.[^\s]{2,})/;
export const timeRegex = /^([0-1]?[0-9]|2[0-4]):([0-5][0-9])(:[0-5][0-9])?$/;

// Align the validation rules in 'Data Board'
export const phoneFieldRegex = /^(\+\d{1,2}\s?)?1?\.?\s?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}$/;
export const emailFieldRegex = /^[a-zA-Z\d._%-]+@[[a-zA-Z\d.\-@]+\.[a-zA-Z]{2,4}$/;
