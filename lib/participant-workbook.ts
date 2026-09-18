import ExcelJS from "exceljs";
import { genderLabel, schoolStatusLabel, type ListedParticipant } from "./participant-list";

export function participantWorkbook(people: ListedParticipant[]) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Latvijas skolu Ziemas festivāls";
  const base = [
    { header: "Dalībnieka ID", key: "id", width: 16 },
    { header: "Vārds", key: "firstName", width: 22 },
    { header: "Uzvārds", key: "lastName", width: 25 },
    { header: "Dzimšanas gads", key: "birthYear", width: 18 },
    { header: "Dzimums", key: "gender", width: 14 },
    { header: "Skola", key: "schoolName", width: 42 },
    { header: "Novads / pilsēta", key: "municipality", width: 28 },
    { header: "Skolas statuss", key: "schoolStatus", width: 26 },
  ];
  const summary = workbook.addWorksheet("Dalībnieki", { views: [{ state: "frozen", ySplit: 1 }] });
  summary.columns = [...base, { header: "Pieteikumu skaits", key: "count", width: 20 }];
  const detail = workbook.addWorksheet("Pieteikumi", { views: [{ state: "frozen", ySplit: 1 }] });
  detail.columns = [...base,
    { header: "Pieteikuma ID", key: "entryId", width: 17 },
    { header: "Sporta veids", key: "sportName", width: 28 },
    { header: "Disciplīna", key: "discipline", width: 32 },
    { header: "Kategorija", key: "categoryName", width: 36 },
    { header: "Komanda", key: "teamName", width: 28 },
  ];
  for (const person of people) {
    const row = { id: person.id, firstName: person.firstName, lastName: person.lastName,
      birthYear: person.birthYear, gender: genderLabel(person.gender), schoolName: person.schoolName,
      municipality: person.municipality, schoolStatus: schoolStatusLabel(person.schoolStatus) };
    summary.addRow({ ...row, count: person.registrations.length });
    for (const entry of person.registrations) {
      detail.addRow({ ...row, entryId: entry.id, sportName: entry.sportName,
        discipline: entry.discipline, categoryName: entry.categoryName, teamName: entry.teamName ?? "" });
    }
  }
  for (const sheet of [summary, detail]) {
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, sheet.rowCount), column: sheet.columnCount } };
    sheet.eachRow((row, index) => {
      row.font = { name: "Calibri", size: 11 };
      row.alignment = { vertical: "middle", wrapText: true };
      row.height = index === 1 ? 32 : 30;
      if (index === 1) {
        row.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
        row.eachCell((cell) => { cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0C0942" } }; });
      }
    });
  }
  return workbook;
}
