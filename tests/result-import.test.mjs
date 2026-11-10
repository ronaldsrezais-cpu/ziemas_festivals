import test from 'node:test';
import assert from 'node:assert/strict';
import { previewResultMatches, previewTeamResultMatches } from '../lib/result-import.ts';
import { recoverSchoolAccessCode } from '../lib/school-access-code.ts';
const entry = { entryId: 1, firstName: 'Jānis', lastName: 'Bērziņš', schoolName: 'Testa skola' };
test('school alone does not identify a participant', () => {
  const [r] = previewResultMatches('Vieta;Vārds;Skola\n1;Anna Kalniņa;Testa skola', [entry]);
  assert.equal(r.placement, ''); assert.equal(r.sourceLine, '');
});
test('uses the place column, not a bib number', () => {
  const [r] = previewResultMatches('Numurs;Vieta;Vārds;Skola\n35;2;Jānis Bērziņš;Testa skola', [entry]);
  assert.equal(r.placement, '2'); assert.match(r.sourceLine, /35;2/);
});
test('does not guess place from an unlabelled number or previous row', () => {
  const [r] = previewResultMatches('1 Anna Kalniņa\n25 Jānis Bērziņš 2010 01:23', [entry]);
  assert.equal(r.placement, ''); assert.match(r.sourceLine, /Jānis/);
});
test('handles reverse name order, accents and places above 50', () => {
  const [r] = previewResultMatches('Rank\tName\n87\tBerzins Janis', [entry]);
  assert.equal(r.placement, '87');
});
test('repeated participant across categories requires review', () => {
  const [r] = previewResultMatches('Vieta;Vārds\n1;Jānis Bērziņš\n3;Jānis Bērziņš', [entry]);
  assert.equal(r.placement, ''); assert.match(r.matchNote, /Vairākas/);
});
test('identical names require school identification', () => {
  const entries = [entry, {...entry, entryId: 2, schoolName: 'Cita skola'}];
  assert.equal(previewResultMatches('Vieta;Vārds\n1;Jānis Bērziņš', entries)[0].placement, '');
  const rows = previewResultMatches('Vieta;Vārds;Skola\n1;Jānis Bērziņš;Testa skola\n2;Jānis Bērziņš;Cita skola', entries);
  assert.deepEqual(rows.map(r=>r.placement), ['1','2']);
});
test('name substring is not an exact name match', () => {
  const [r] = previewResultMatches('Vieta;Vārds\n1;Jānis Bērziņškalns', [entry]);
  assert.equal(r.sourceLine, '');
});
test('only recovers a current access code', async () => {
  const hash = async value => `hash:${value}`;
  const body = 'Labdien!\nSkolas piekļuves kods: ABCD2345\n';
  assert.equal(await recoverSchoolAccessCode(body, 'hash:ABCD2345', hash), 'ABCD2345');
  assert.equal(await recoverSchoolAccessCode(body, 'hash:OTHER', hash), null);
  assert.equal(await recoverSchoolAccessCode(undefined, 'hash:ABCD2345', hash), null);
  assert.equal(await recoverSchoolAccessCode(body, null, hash), null);
});

test('OE orienteering PDF Pl header and non-finish statuses are recognized without mistaking birth years for places', () => {
  const entries = [
    { entryId: 1, firstName: 'Rūta', lastName: 'Irbe', schoolName: '[TESTS 2026] Madonas Valsts ģimnāzija' },
    { entryId: 2, firstName: 'Madara', lastName: 'Miķelsone', schoolName: 'Rīgas Āgenskalna Valsts ģimnāzija' },
    { entryId: 3, firstName: 'Rūdolfs Emīls', lastName: 'Melbergs', schoolName: 'Rīgas Valsts 2.ģimnāzija' },
  ];
  const text = 'Pl\tName\tYB Club\tText1\tTime\tDiff.\n1\tRūta Irbe\t09 Madonas Valsts ģimnāzija\tMadonas novads\t17:34\t0:00\nMadara Miķelsone\t09 Rīgas Āgenskalna Valsts ģim.\tRīga\tdns\nRūdolfs Emīls Melbergs\t07 Rīgas Valsts 2.ģimnāzija\tRīga\tdnf';
  const matches = previewResultMatches(text, entries);
  assert.equal(matches[0].placement, '1');
  assert.equal(matches[1].placement, ''); assert.equal(matches[1].status, 'dns');
  assert.equal(matches[2].placement, ''); assert.equal(matches[2].status, 'dnf');
});

const team = {
  teamName: '1. komanda',
  schoolName: 'Testa skola',
  categoryName: '1. grupa',
  discipline: 'Sniega volejbols',
  members: [entry, { ...entry, entryId: 2, firstName: 'Anna', lastName: 'Kalniņa' }],
};

test('team preview merges named team members into one result, even on a shared source row', () => {
  const [result] = previewTeamResultMatches('Vieta;Dalībnieki;Skola\n2;Jānis Bērziņš un Anna Kalniņa;Testa skola\n2;Anna Kalniņa;Testa skola', [team]);
  assert.equal(result.placement, '2');
  assert.equal(result.sourceLine.split('\n').length, 2);
});

test('team preview recognizes school-only rows and distinguishes teams and groups', () => {
  const teams = [team, { ...team, teamName: '2. komanda', members: [] }, { ...team, categoryName: '2. grupa' }];
  const file = 'Vieta;Skola;Komanda;Grupa\n1;Testa skola;2. komanda;1. grupa\n2;Testa skola;1. komanda;2. grupa\nDNF;Testa skola;1. komanda;1. grupa';
  const matches = previewTeamResultMatches(file, teams);
  assert.deepEqual(matches.map(result => [result.placement, result.status]), [['', 'dnf'], ['1', 'ranked'], ['2', 'ranked']]);
  const [single] = previewTeamResultMatches('Vieta;Skola\n1;Testa skola', [team]);
  assert.equal(single.placement, '1');
});

test('ambiguous school, conflicting member placements and unknown participants need manual review', () => {
  const ambiguous = previewTeamResultMatches('Vieta;Skola\n1;Testa skola', [team, { ...team, categoryName: '2. grupa' }]);
  assert.ok(ambiguous.every(result => !result.placement && /vairākām komandām/.test(result.matchNote)));
  const [conflict] = previewTeamResultMatches('Vieta;Vārds\n1;Jānis Bērziņš\n2;Anna Kalniņa', [team]);
  assert.equal(conflict.placement, '');
  assert.match(conflict.matchNote, /atšķirīgas vietas/);
  const [unknown] = previewTeamResultMatches('Vieta;Vārds;Skola\n1;Nezināms Dalībnieks;Testa skola', [team]);
  assert.equal(unknown.placement, '');
});

test('team preview uses exact group headings to separate school-only rows', () => {
  const second = { ...team, categoryName: '2. grupa' };
  const file = '1. grupa\nVieta;Skola\n3;Testa skola\n2. grupa\nVieta;Skola\n1;Testa skola';
  assert.deepEqual(previewTeamResultMatches(file, [team, second]).map(result => result.placement), ['3', '1']);
  assert.equal(previewTeamResultMatches(file, [team], [
    { name: '1. grupa', discipline: team.discipline },
    { name: '2. grupa', discipline: team.discipline },
  ])[0].placement, '3');
});
