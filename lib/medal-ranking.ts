type MedalRow = { gold: number; silver: number; bronze: number };
export function sharedMedalPlaces(rows: MedalRow[]) {
  let place = 0;
  return rows.map((row, index) => {
    const previous = rows[index - 1];
    if (!previous || row.gold !== previous.gold || row.silver !== previous.silver || row.bronze !== previous.bronze) place = index + 1;
    return place;
  });
}
