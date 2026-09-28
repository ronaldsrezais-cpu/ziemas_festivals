import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import ExcelJS from 'exceljs';
import { filterTeamLeaders } from '../lib/team-leader-list.ts';
import { state } from './team-leader-export-fixtures.mjs';

registerHooks({ resolve(specifier, context, next) {
  if (['@/db', '@/lib/security'].includes(specifier))
    return { url: new URL('./team-leader-export-fixtures.mjs', import.meta.url).href, shortCircuit: true };
  if (specifier.startsWith('@/'))
    return { url: new URL(`../${specifier.slice(2)}.ts`, import.meta.url).href, shortCircuit: true };
  return next(specifier === './participant-list' ? './participant-list.ts' : specifier, context);
} });
const { teamLeaderWorkbook } = await import('../lib/team-leader-workbook.ts');
const { GET } = await import('../app/api/team-leaders/route.ts');

const leaders = [
  { id: 1, fullName: 'Jānis Bērziņš', role: 'Sporta skolotājs', email: 'janis@example.test', phone: '+37120000001',
    schoolId: 1, schoolName: 'Pirmā testa skola', municipality: 'Cēsu novads', schoolStatus: 'approved' },
  { id: 2, fullName: '=1+1', role: '@SUM(1,2)', email: 'otra@example.test', phone: '0012345678',
    schoolId: 2, schoolName: 'Otrā testa skola', municipality: 'Rīga', schoolStatus: 'pending' },
  { id: 3, fullName: 'Anna Kalniņa', role: 'Komandas vadītāja', email: null, phone: null,
    schoolId: 1, schoolName: 'Pirmā testa skola', municipality: 'Cēsu novads', schoolStatus: 'approved' },
];

beforeEach(() => { Object.assign(state, { session: null, rows: structuredClone(leaders), reads: 0 }); });

test('leader filters combine school and Latvian search, including role and contact details', () => {
  assert.equal(filterTeamLeaders(leaders).length, 3);
  assert.deepEqual(filterTeamLeaders(leaders, { search: '  CĒSU  ' }).map(row => row.id), [1, 3]);
  assert.deepEqual(filterTeamLeaders(leaders, { school: '1', search: 'KALNIŅA' }).map(row => row.id), [3]);
  assert.equal(filterTeamLeaders(leaders, { school: '2', search: 'Bērziņš' }).length, 0);
  for (const search of ['Sporta skolotājs', 'janis@example.test', '+37120000001'])
    assert.deepEqual(filterTeamLeaders(leaders, { search }).map(row => row.id), [1]);
  assert.equal(filterTeamLeaders(leaders, { school: '999' }).length, 0);
});

test('leader XLSX round trip preserves Latvian names, phone strings, missing contacts and literal formulas', async () => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await teamLeaderWorkbook(leaders).xlsx.writeBuffer());
  assert.deepEqual(workbook.worksheets.map(sheet => sheet.name), ['Komandu vadītāji']);
  const sheet = workbook.getWorksheet('Komandu vadītāji');
  assert.equal(sheet.rowCount, 4);
  assert.equal(sheet.columnCount, 8);
  assert.equal(sheet.getCell('B2').value, 'Jānis Bērziņš');
  assert.equal(sheet.getCell('D2').value, 'Pirmā testa skola');
  assert.equal(sheet.getCell('E2').value, 'Cēsu novads');
  assert.equal(sheet.getCell('F2').value, 'Apstiprināta');
  assert.equal(sheet.getCell('F3').value, 'Gaida apstiprinājumu');
  assert.equal(sheet.getCell('G2').value, 'janis@example.test');
  assert.equal(sheet.getCell('H2').value, '+37120000001');
  assert.equal(sheet.getCell('H3').value, '0012345678');
  assert.equal(sheet.getCell('H3').type, ExcelJS.ValueType.String);
  assert.equal(sheet.getCell('H3').numFmt, '@');
  assert.equal(sheet.getCell('B3').value, '=1+1');
  assert.equal(sheet.getCell('B3').type, ExcelJS.ValueType.String);
  assert.equal(sheet.getCell('C3').type, ExcelJS.ValueType.String);
  assert.equal(sheet.getCell('G4').value ?? '', '');
  assert.equal(sheet.getCell('H4').value ?? '', '');
  assert.equal(sheet.views[0].ySplit, 1);
  assert.ok(sheet.autoFilter);
});

test('empty leader export retains column headers without inventing records', () => {
  const sheet = teamLeaderWorkbook([]).getWorksheet('Komandu vadītāji');
  assert.equal(sheet.rowCount, 1);
  assert.equal(sheet.getCell('B1').value, 'Vārds, uzvārds');
  assert.equal(sheet.getCell('H1').value, 'Tālrunis');
});

for (const role of [null, 'school', 'judge']) {
  test(`leader export denies ${role ?? 'anonymous'} access before reading contacts`, async () => {
    state.session = role ? { role, subjectId: 1 } : null;
    const response = await GET(new Request('https://example.test/api/team-leaders?role=admin'));
    assert.equal(response.status, 401);
    assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
    assert.equal(state.reads, 0);
    assert.deepEqual(await response.json(), { error: 'Nepieciešama administratora piekļuve.' });
  });
}

test('admin downloads an XLSX containing only selected leaders and current school names', async () => {
  state.session = { role: 'admin', subjectId: 0 };
  state.rows[2].schoolName = 'Precizētā testa skola';
  const response = await GET(new Request('https://example.test/api/team-leaders?school=1&search=Kalni%C5%86a'));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
  assert.equal(response.headers.get('Content-Type'), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  assert.match(response.headers.get('Content-Disposition'), /^attachment; filename="komandu-vaditaji-\d{4}-\d{2}-\d{2}\.xlsx"$/);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(await response.arrayBuffer()));
  const sheet = workbook.getWorksheet('Komandu vadītāji');
  assert.equal(sheet.rowCount, 2);
  assert.equal(sheet.getCell('A2').value, 1);
  assert.equal(sheet.getCell('B2').value, 'Anna Kalniņa');
  assert.equal(sheet.getCell('D2').value, 'Precizētā testa skola');
});

test('admin without filters can export all leaders, including pending schools', async () => {
  state.session = { role: 'admin', subjectId: 0 };
  const response = await GET(new Request('https://example.test/api/team-leaders'));
  assert.equal(response.status, 200);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(await response.arrayBuffer()));
  assert.equal(workbook.getWorksheet('Komandu vadītāji').rowCount, leaders.length + 1);
});
