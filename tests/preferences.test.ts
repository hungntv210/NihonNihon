import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_PREFERENCES,
  newLessonsLocked,
  parseSrsSettingsInput,
  parseStoredPreferences,
  validatePreferences,
} from '../src/core/preferences.ts';
test('settings validate defaults, NFC, ranges, dates and timezone',()=>{
 assert.deepEqual(validatePreferences({}),DEFAULT_PREFERENCES);
 assert.equal(validatePreferences({ttsVoice:'ho\u0300a'}).ttsVoice,'hòa');
 assert.equal(validatePreferences({newCardsPerDay:0,fsrsRetention:0.8}).fsrsRetention,0.8);
 assert.equal(validatePreferences({newCardsPerDay:100,fsrsRetention:0.97}).fsrsRetention,0.97);
 assert.equal(validatePreferences({fsrsRetention:0.85}).fsrsRetention,0.85);
 for(const invalid of [{fsrsRetention:1},{fsrsRetention:0.79},{fsrsRetention:0.98},{fsrsRetention:0.905},{fsrsRetention:Number.NaN},{newCardsPerDay:-1},{newCardsPerDay:101},{newCardsPerDay:5.5},{studyMinutes:0},{startDate:'2026-02-30'},{timeZone:'Invalid/zone'},{theme:'bad'},{shadowingDays:[2,2]},{shadowingDays:[2]},{constructor:1},{extra:1}]) assert.throws(()=>validatePreferences(invalid));
});
test('stored preferences fall back safely for missing or legacy SRS values while client parser rejects invalid input',()=>{
 assert.deepEqual(parseStoredPreferences({fsrsRetention:0.75,newCardsPerDay:-5}),DEFAULT_PREFERENCES);
 assert.deepEqual(parseStoredPreferences({fsrsRetention:0.99}),DEFAULT_PREFERENCES);
 assert.equal(parseStoredPreferences({fsrsRetention:0.86,newCardsPerDay:15}).fsrsRetention,0.86);
 assert.equal(parseStoredPreferences({fsrsRetention:0.86,newCardsPerDay:15}).newCardsPerDay,15);
 assert.deepEqual(parseSrsSettingsInput('12','0.92'),{ok:true,newCardsPerDay:12,fsrsRetention:0.92});
 assert.equal(parseSrsSettingsInput('101','0.90').ok,false);
 assert.equal(parseSrsSettingsInput('10.5','0.90').ok,false);
 assert.equal(parseSrsSettingsInput('10','0.79').ok,false);
 assert.equal(parseSrsSettingsInput('10','0.98').ok,false);
 assert.equal(parseSrsSettingsInput('10','0.905').ok,false);
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
