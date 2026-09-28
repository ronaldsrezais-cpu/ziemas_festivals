import ExcelJS from "exceljs";
import { schoolStatusLabel } from "./participant-list";
import type { ListedLeader } from "./team-leader-list";

export function teamLeaderWorkbook(leaders: ListedLeader[]) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Latvijas skolu Ziemas festivāls";
  const sheet = workbook.addWorksheet("Komandu vadītāji", { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = [
    { header: "Nr.", key: "number", width: 8 },
    { header: "Vārds, uzvārds", key: "fullName", width: 30 },
    { header: "Amats / loma", key: "role", width: 28 },
    { header: "Skola", key: "schoolName", width: 42 },
    { header: "Novads / valstspilsēta", key: "municipality", width: 28 },
    { header: "Skolas statuss", key: "schoolStatus", width: 26 },
    { header: "E-pasts", key: "email", width: 36 },
    { header: "Tālrunis", key: "phone", width: 22, style: { numFmt: "@" } },
  ];
  leaders.forEach((leader, index) => {
    sheet.addRow({
      number: index + 1,
      fullName: leader.fullName,
      role: leader.role,
      schoolName: leader.schoolName,
      municipality: leader.municipality,
      schoolStatus: schoolStatusLabel(leader.schoolStatus),
      email: leader.email ?? "",
      phone: leader.phone ?? "",
    });
  });
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: sheet.rowCount, column: sheet.columnCount } };
  sheet.eachRow((row, index) => {
    row.font = { name: "Calibri", size: 11 };
    row.alignment = { vertical: "middle", wrapText: true };
    row.height = index === 1 ? 32 : 30;
    if (index === 1) {
      row.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
      row.eachCell((cell) => { cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0C0942" } }; });
    }
  });
  return workbook;
}
