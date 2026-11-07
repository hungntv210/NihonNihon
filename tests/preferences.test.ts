import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PREFERENCES, newLessonsLocked, validatePreferences } from '../src/core/preferences.ts';
test('settings validate defaults, NFC, ranges, dates and timezone',()=>{
 assert.deepEqual(validatePreferences({}),DEFAULT_PREFERENCES);
 assert.equal(validatePreferences({ttsVoice:'ho\u0300a'}).ttsVoice,'hòa');
 for(const invalid of [{fsrsRetention:1},{studyMinutes:0},{startDate:'2026-02-30'},{timeZone:'Invalid/zone'},{theme:'bad'},{shadowingDays:[2,2]},{shadowingDays:[2]},{constructor:1},{extra:1}]) assert.throws(()=>validatePreferences(invalid));
});
test('new lesson gate requires two previous-week dates or a current-week makeup; SRS has no gate',()=>{
 const now=new Date('2026-11-09T12:00:00Z'),p=DEFAULT_PREFERENCES;
 assert.equal(newLessonsLocked(p,[],new Date('2026-11-07T12:00:00Z')),false);
 assert.equal(newLessonsLocked(p,[],now),true);
 assert.equal(newLessonsLocked(p,[{date:'2026-11-03',kind:'regular'},{date:'2026-11-03',kind:'regular'}],now),true);
 assert.equal(newLessonsLocked(p,[{date:'2026-11-03',kind:'regular'},{date:'2026-11-05',kind:'regular'}],now),false);
 assert.equal(newLessonsLocked(p,[{date:'2026-11-09',kind:'makeup'}],now),false);
 assert.equal(newLessonsLocked(p,[{date:'2026-11-10',kind:'makeup'}],now),true);
});
