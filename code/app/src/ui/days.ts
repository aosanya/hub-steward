const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const isoDatePrefix = /^\d{4}-\d{2}-\d{2}/;

export const isoDay = (iso: string) => (iso ? iso.slice(0, 10) : "");

const dayOf = (value: string) => {
  if (value === "") return null;
  const date = isoDatePrefix.test(value) ? new Date(`${value.slice(0, 10)}T00:00:00Z`) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const dayWords = (value: string) => {
  const date = dayOf(value);
  return date ? `${dayNames[date.getUTCDay()]}, ${date.getUTCDate()} ${monthNames[date.getUTCMonth()]}` : value;
};
