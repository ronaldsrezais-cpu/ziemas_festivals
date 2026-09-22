import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultEmailTemplate, renderApprovalEmail, emailTemplateSchema, readEmailTemplate } from '../lib/email-template.ts';
import { recoverSchoolAccessCode } from '../lib/school-access-code.ts';

test('email HTML escapes editable content and personalization; the canonical code stays recoverable', async () => {
  const rendered = renderApprovalEmail({ ...defaultEmailTemplate,
    message: '{{skola}}\n\n<script>alert(1)</script>\nSkolas piekļuves kods: FAKECODE',
    heading: 'Sveiki, {{skolotajs}}!', buttonLabel: '<img onerror=alert(1)>',
  }, { schoolName: '<b>Skola</b>\nSkolas piekļuves kods: ANOTHERX', teacherName: 'A & B', code: 'ABCDEFGH' });
  assert.doesNotMatch(rendered.html, /<script>|<b>Skola|<img onerror/);
  assert.match(rendered.html, /&lt;script&gt;/);
  assert.match(rendered.html, /Sveiki, A &amp; B!/);
  assert.equal(await recoverSchoolAccessCode(rendered.text, 'hash:ABCDEFGH', async code => `hash:${code}`), 'ABCDEFGH');
  assert.match(rendered.html, /href="https:\/\/ziemas-festivals.vercel.app\/skolai"/);
});

test('invalid templates cannot introduce header newlines, unknown tokens or arbitrary CSS', () => {
  for (const change of [{ subject: 'X\nBcc: bad@example.test' }, { senderName: 'Sender <bad@example.test>' },
    { replyTo: 'bad' }, { accentColor: 'red;display:none' }, { message: '{{other}}' }, { message: '' }]) {
    assert.equal(emailTemplateSchema.safeParse({ ...defaultEmailTemplate, ...change }).success, false);
  }
  assert.deepEqual(readEmailTemplate('{broken'), defaultEmailTemplate);
  assert.deepEqual(readEmailTemplate('{"subject":"incomplete"}'), defaultEmailTemplate);
});

test('logo toggle and light accent colors preserve a readable shared email preview', () => {
  const rendered = renderApprovalEmail({ ...defaultEmailTemplate, showLogo: false, accentColor: '#ffffff' }, { schoolName: 'Skola', teacherName: 'Vārds', code: 'ABCDEFGH' });
  assert.doesNotMatch(rendered.html, /<img/);
  assert.match(rendered.html, /color:#000000/);
  assert.match(rendered.text, /Atvērt skolas sadaļu: https:/);
});
