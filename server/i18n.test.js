import test from 'node:test';
import assert from 'node:assert/strict';
import { translateMatchReason, translateUi } from '../src/i18n.js';

test('fair pricing copy follows the selected language', () => {
  const title = 'A price that shows its work.';
  assert.equal(translateUi('en', title), title);
  assert.equal(translateUi('hi', title), 'हर लागत को समझाने वाली कीमत।');
  assert.equal(translateUi('mr', title), 'प्रत्येक खर्च स्पष्ट करणारी किंमत.');
  assert.equal(translateUi('hi', 'Cost-based price'), 'लागत आधारित मूल्य');
});

test('dynamic match explanations are localized', () => {
  assert.equal(translateMatchReason('hi', 'Capacity for 100 units'), '100 वस्तुओं की क्षमता है');
  assert.equal(translateMatchReason('mr', '₹290 exceeds unit budget'), '₹290 प्रति वस्तू बजेटपेक्षा जास्त आहे');
  assert.equal(translateMatchReason('en', 'Material fits'), 'Material fits');
});
