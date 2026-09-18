// Registration choices supplied by the festival organiser.
export const stateCities = [
  "Daugavpils", "Jelgava", "Jūrmala", "Liepāja", "Rēzekne", "Rīga", "Ventspils",
] as const;

export const municipalities = [
  "Ādažu novads", "Aizkraukles novads", "Alūksnes novads", "Augšdaugavas novads",
  "Balvu novads", "Bauskas novads", "Cēsu novads", "Dienvidkurzemes novads",
  "Dobeles novads", "Gulbenes novads", "Jelgavas novads", "Jēkabpils novads",
  "Krāslavas novads", "Kuldīgas novads", "Ķekavas novads", "Limbažu novads",
  "Līvānu novads", "Ludzas novads", "Madonas novads", "Mārupes novads",
  "Ogres novads", "Olaines novads", "Preiļu novads", "Rēzeknes novads",
  "Ropažu novads", "Salaspils novads", "Saldus novads", "Saulkrastu novads",
  "Siguldas novads", "Smiltenes novads", "Talsu novads", "Tukuma novads",
  "Valkas novads", "Valmieras novads", "Ventspils novads",
] as const;

export const municipalityOptions = [...stateCities, ...municipalities] as const;
