export const serverSentenceOf = async (res: Response): Promise<string> => {
  const body = await res.json().catch(() => undefined);
  return typeof body?.error === "string" ? body.error.trim() : "";
};
