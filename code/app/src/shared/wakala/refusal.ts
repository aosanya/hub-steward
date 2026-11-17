const instanceNotFoundWords = /instance not found/i;

const permissionRefusalWords = /you need (?:the|a) permission\b.*\bin this agency\b/i;

const messageOf = (reason: unknown) => (reason instanceof Error ? reason.message : "");

export const instanceNotFound = (reason: unknown) => instanceNotFoundWords.test(messageOf(reason));

export const permissionRefused = (reason: unknown) => permissionRefusalWords.test(messageOf(reason));

export const accessRefused = (reason: unknown) => instanceNotFound(reason) || permissionRefused(reason);
