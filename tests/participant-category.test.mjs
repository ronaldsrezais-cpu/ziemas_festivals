import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveParticipantCategory } from '../lib/participant-category.ts';

const biathlon = [
  { id: 13, gender: 'F', minBirthYear: 2010, maxBirthYear: 2011 },
  { id: 14, gender: 'M', minBirthYear: 2010, maxBirthYear: 2011 },
  { id: 15, gender: 'F', minBirthYear: 2012, maxBirthYear: 2013 },
  { id: 16, gender: 'M', minBirthYear: 2012, maxBirthYear: 2013 },
];

test('birth-year boundaries and gender automatically assign the correct biathlon group', () => {
  for (const year of ['2010', '2011']) {
    assert.equal(resolveParticipantCategory(biathlon, year, 'F').selected.id, 13);
    assert.equal(resolveParticipantCategory(biathlon, year, 'M').selected.id, 14);
  }
  for (const year of ['2012', '2013']) {
    assert.equal(resolveParticipantCategory(biathlon, year, 'F').selected.id, 15);
    assert.equal(resolveParticipantCategory(biathlon, year, 'M').selected.id, 16);
  }
});

test('correcting year or gender recalculates a previously selected group without retaining an invalid ID', () => {
  assert.equal(resolveParticipantCategory(biathlon, '2012', 'F', '13').selected.id, 15);
  assert.equal(resolveParticipantCategory(biathlon, '2012', 'M', '15').selected.id, 16);
  assert.equal(resolveParticipantCategory(biathlon, '2012', 'M', '16').selected.id, 16);
});

test('mixed team categories work for both genders; incomplete and ineligible years cannot be submitted', () => {
  const mixed = [{ id: 1, gender: 'X', minBirthYear: 2008, maxBirthYear: 2014 }];
  for (const gender of ['F', 'M']) {
    assert.equal(resolveParticipantCategory(mixed, '2011', gender).selected.id, 1);
    for (const year of ['', '201', '2011.5', '2007', '2015', 'NaN'])
      assert.equal(resolveParticipantCategory(mixed, year, gender, '1').selected, null);
  }
  assert.equal(resolveParticipantCategory([], '2011', 'F').selected, null);
});

test('hockey skill levels require a choice; editing retains the school choice regardless of category order', () => {
  const hockey = [
    { id: 4, gender: 'X', minBirthYear: 2010, maxBirthYear: 2013, name: 'Elite' },
    { id: 5, gender: 'X', minBirthYear: 2010, maxBirthYear: 2013, name: 'Meistarība' },
  ];
  assert.equal(resolveParticipantCategory(hockey, '2011', 'M').selected, null);
  assert.equal(resolveParticipantCategory(hockey, '2011', 'M', '14').selected, null);
  assert.equal(resolveParticipantCategory(hockey, '2011', 'M', '5').selected.name, 'Meistarība');
  assert.equal(resolveParticipantCategory([...hockey].reverse(), '2011', 'M', '5').selected.name, 'Meistarība');
  assert.equal(resolveParticipantCategory(hockey, '2014', 'M', '5').selected, null);
});

test('several eligible disciplines remain an explicit choice instead of silently choosing the first', () => {
  const categories = [
    { id: 101, gender: 'F', minBirthYear: 2010, maxBirthYear: 2012, discipline: 'Sprints' },
    { id: 102, gender: 'F', minBirthYear: 2010, maxBirthYear: 2012, discipline: 'Distance' },
  ];
  assert.equal(resolveParticipantCategory(categories, '2011', 'F').selected, null);
  assert.equal(resolveParticipantCategory(categories, '2011', 'F', '102').selected.discipline, 'Distance');
});
