export function formatPersonName(value: string) {
  return value.normalize("NFC").trim().replace(/\s+/gu, " ").toLocaleLowerCase("lv-LV")
    .replace(/(^|[\s\p{Pd}'’])(\p{L})/gu, (_, boundary: string, letter: string) => boundary + letter.toLocaleUpperCase("lv-LV"));
}
