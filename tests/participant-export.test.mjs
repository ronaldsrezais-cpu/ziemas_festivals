import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import ExcelJS from 'exceljs';
import { filterParticipants } from '../lib/participant-list.ts';
registerHooks({ resolve(specifier, context, next) {
  return next(specifier === './participant-list' ? './participant-list.ts' : specifier, context);
} });
const { participantWorkbook } = await import('../lib/participant-workbook.ts');
const people = [
  {id:1,firstName:'Jānis',lastName:'Bērziņš',birthYear:2010,gender:'M',schoolId:1,schoolName:'Testa skola',municipality:'Cēsis',schoolStatus:'approved',registrations:[
    {id:10,sportId:1,sportName:'Slēpošana',categoryId:11,categoryName:'Zēni',discipline:'Distance',teamName:null},
    {id:20,sportId:2,sportName:'Slidošana',categoryId:22,categoryName:'Zēni',discipline:'Ātrums',teamName:'Testa komanda'}]},
  {id:2,firstName:'=1+1',lastName:'Kalniņa',birthYear:2012,gender:'F',schoolId:2,schoolName:'Otra skola',municipality:'Rīga',schoolStatus:'pending',registrations:[]}
];
test('participant filters also restrict exported registrations', () => {
  const rows = filterParticipants(people,{sport:'1'});
  assert.equal(rows.length,1); assert.equal(rows[0].registrations.length,1);
  assert.equal(rows[0].registrations[0].sportId,1);
  assert.equal(filterParticipants(people,{school:'2',sport:'1'}).length,0);
  assert.equal(filterParticipants(people,{search:'cēsis'}).length,1);
  assert.equal(filterParticipants(people,{category:'999'}).length,0);
});
test('xlsx round trip preserves unique people, registrations, Latvian text and typed values', async () => {
  const bytes=await participantWorkbook(people).xlsx.writeBuffer();
  const wb=new ExcelJS.Workbook();await wb.xlsx.load(bytes);
  assert.deepEqual(wb.worksheets.map(s=>s.name),['Dalībnieki','Pieteikumi']);
  const list=wb.getWorksheet('Dalībnieki');const entries=wb.getWorksheet('Pieteikumi');
  assert.equal(list.rowCount,3);assert.equal(entries.rowCount,3);
  assert.equal(list.getCell('B2').value,'Jānis');assert.equal(list.getCell('D2').value,2010);
  assert.equal(list.getCell('I2').value,2);assert.equal(list.getCell('I3').value,0);
  assert.equal(list.getCell('B3').value,'=1+1');assert.equal(list.getCell('B3').type,ExcelJS.ValueType.String);
  assert.equal(list.views[0].ySplit,1);assert.ok(list.autoFilter);
});
test('empty export retains headers and no invented participants', () => {
  const wb=participantWorkbook([]);
  assert.equal(wb.getWorksheet('Dalībnieki').rowCount,1);
  assert.equal(wb.getWorksheet('Pieteikumi').rowCount,1);
});
