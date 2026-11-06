const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const parsed = (iso: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return match ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))) : null;
};

export const dayName = (iso: string) => {
  const date = parsed(iso);
  return date ? days[date.getUTCDay()] : iso;
};
