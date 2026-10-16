import test from 'node:test';
import assert from 'node:assert/strict';
import { createGratitudePrompt } from '../src/integrations/gratitude-prompt.js';

test('idle hints rotate without replacing progress or the completion blessing', () => {
  const element = { textContent: '' };
  const prompt = createGratitudePrompt(element, { matches: true });
  prompt.show({ phase: 'collecting', count: 0, total: 12 });
  prompt.update(6); assert.equal(element.textContent, '用歌聲來點亮聖誕樹');
  prompt.update(6); assert.match(element.textContent, /輕觸/);
  prompt.show({ phase: 'collecting', count: 4, total: 12 });
  prompt.update(12); assert.match(element.textContent, /4 \/ 12/);
  prompt.show({ phase: 'blooming', count: 12, total: 12 });
  prompt.update(12); assert.match(element.textContent, /謝謝你/);
  prompt.dispose();
});
