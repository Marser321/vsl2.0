const URL = /https?:\/\/\S+|www\.\S+/gi;
const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE = /(?:\+?\d[\d\s().-]{7,}\d)/g;
const MONEY = /(?:USD|US\$|\$|€|EUR)\s?\d[\d.,]*/gi;

export function anonymizeLearning(value: string) {
  return value
    .replace(URL, "[URL omitida]")
    .replace(EMAIL, "[email omitido]")
    .replace(PHONE, "[teléfono omitido]")
    .replace(MONEY, "[precio omitido]")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function hasObviousSensitiveData(value: string) {
  for (const pattern of [URL, EMAIL, PHONE, MONEY]) {
    pattern.lastIndex = 0;
    if (pattern.test(value)) return true;
  }
  return false;
}
