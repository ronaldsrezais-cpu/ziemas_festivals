type Category = {
  id: number;
  gender: "F" | "M" | "X";
  minBirthYear: number;
  maxBirthYear: number;
};

// A unique age/gender match is automatic. Multiple disciplines or levels
// need an explicit choice; their order must never decide the registration.
export function resolveParticipantCategory<T extends Category>(
  categories: T[], birthYear: string, gender: "F" | "M", selectedId = "",
) {
  const year = Number(birthYear);
  const validYear = /^\d{4}$/.test(birthYear) && Number.isInteger(year) && year >= 2000 && year <= 2030;
  const options = validYear ? categories.filter(category => year >= category.minBirthYear && year <= category.maxBirthYear &&
    (category.gender === "X" || category.gender === gender)) : [];
  const selected = options.find(category => String(category.id) === selectedId) ?? (options.length === 1 ? options[0] : null);
  return { options, selected, automatic: options.length === 1 };
}
