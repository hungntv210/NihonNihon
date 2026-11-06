import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PREFERENCES, validatePreferences } from '../src/core/preferences.ts';
test('settings validate defaults, NFC, ranges, dates and timezone',()=>{
 assert.deepEqual(validatePreferences({}),DEFAULT_PREFERENCES);
 assert.equal(validatePreferences({ttsVoice:'ho\u0300a'}).ttsVoice,'hòa');
 for(const invalid of [{fsrsRetention:1},{studyMinutes:0},{startDate:'2026-02-30'},{timeZone:'Invalid/zone'},{theme:'bad'},{shadowingDays:[2,2]},{extra:1}]) assert.throws(()=>validatePreferences(invalid));
});
