import assert from 'node:assert/strict';
import test from 'node:test';
import { generateCopy } from '../src/content-generator.mjs';

test('content generator uses Codex structured output', async () => {
  const result = await generateCopy({}, 'תרגול מתנדבים בשוהם', { runModel: async () => JSON.stringify({
    facebook: 'תרגול מתנדבים בשוהם.',
    instagram: 'בשוהם מתרגלים המתנדבים.\n#איחודהצלה #שוהם #קהילה',
    clarification: null,
  }) });
  assert.equal(result.generator, 'codex');
  assert.match(result.facebook, /תרגול מתנדבים בשוהם/);
});

test('content generator requires verification for sensitive claims', async () => {
  const result = await generateCopy({}, 'ילד נפצע באירוע', { runModel: async () => JSON.stringify({
    facebook: 'ילד נפצע באירוע.',
    instagram: 'באירוע נפצע ילד.\n#איחודהצלה #שוהם #קהילה',
    clarification: null,
  }) });
  assert.match(result.clarification, /לאמת/);
});

test('content generator rejects an ungrounded model response', async () => {
  await assert.rejects(() => generateCopy({}, 'מתנדבי הסניף קיימו תרגול ציוד.', { runModel: async () => JSON.stringify({
    facebook: 'התרגול נועד להכין את הקהילה לדרישות החורף ולהציל חיים.',
    instagram: 'הכנה חשובה לחורף שמבטיחה ביטחון לכולם.',
    clarification: null,
  }) }), /not_grounded/);
});

test('content generator requires image-specific copy when an image is attached', async () => {
  const result = await generateCopy({}, 'הכן פוסט לפי התמונה.', {
    imagePaths: ['/approved.jpg'],
    runModel: async () => JSON.stringify({
      facebook: 'שורה של תיקים כתומים מוכנים על השולחן. ציוד שמחכה לרגע שבו יצטרכו אותו.',
      instagram: 'תיקים כתומים, מסודרים ומוכנים 🧡\n\n#איחודהצלה #שוהם #ציוד #קהילה',
      clarification: null,
      visualFacts: ['שורה של תיקים כתומים', 'התיקים מסודרים על שולחן', 'שלט של סניף שוהם'],
    }),
  });
  assert.match(result.facebook, /תיקים כתומים/);
  assert.equal(result.visualFacts.length, 3);
});

test('content generator rejects long dashes in generated copy', async () => {
  for (const longDash of ['\u2013', '\u2014']) {
    await assert.rejects(() => generateCopy({}, 'תרגול מתנדבים בשוהם', {
      runModel: async () => JSON.stringify({
        facebook: `תרגול מתנדבים בשוהם ${longDash} הקהילה מוכנה.`,
        instagram: 'תרגול מתנדבים בשוהם.\n#איחודהצלה #שוהם #קהילה',
        clarification: null,
      }),
    }), /long_dash_forbidden/);
  }
});

test('content generator rejects generic copy for an attached image', async () => {
  await assert.rejects(() => generateCopy({}, 'הכן פוסט לפי התמונה.', {
    imagePaths: ['/approved.jpg'],
    runModel: async () => JSON.stringify({
      facebook: 'אנחנו כאן למען הקהילה.',
      instagram: 'כאן למען הקהילה 🧡\n#איחודהצלה #שוהם #קהילה',
      clarification: null,
      visualFacts: ['שורה של תיקים כתומים', 'התיקים מסודרים על שולחן'],
    }),
  }), /(?:too_generic|not_image_specific)/);
});

test('content generator rejects known AI-like community boilerplate', async () => {
  await assert.rejects(() => generateCopy({}, 'פעילות מתנדבים בשוהם', {
    runModel: async () => JSON.stringify({
      facebook: 'אנחנו כאן, מוכנים למען הקהילה. פעילות מתנדבים בשוהם.',
      instagram: 'כאן בשביל הקהילה. פעילות מתנדבים בשוהם.\n#איחודהצלה #שוהם #קהילה',
      clarification: null,
      visualFacts: [],
    }),
  }), /too_generic/);
});

test('content generator retries once after an editorial quality rejection', async () => {
  let calls = 0;
  const result = await generateCopy({}, 'בדיקת ציוד של צוות הסניף לפני סגירת התיק', {
    runModel: async () => {
      calls += 1;
      if (calls === 1) return JSON.stringify({
        facebook: 'אנחנו כאן, מוכנים למען הקהילה. בדיקת ציוד של צוות הסניף לפני סגירת התיק.',
        instagram: 'כאן בשביל הקהילה. בדיקת ציוד של צוות הסניף לפני סגירת התיק.\n#איחודהצלה #שוהם #קהילה',
        clarification: null,
        visualFacts: [],
      });
      return JSON.stringify({
        facebook: 'לפני סגירת התיק, צוות הסניף מסיים בדיקת ציוד.',
        instagram: 'בדיקת ציוד של צוות הסניף, רגע לפני סגירת התיק. 🧡\n#איחודהצלה #שוהם #מוכנות',
        clarification: null,
        visualFacts: [],
      });
    },
  });
  assert.equal(calls, 2);
  assert.match(result.facebook, /סגירת התיק/);
});

test('content generator produces distinct platform edits', async () => {
  await assert.rejects(() => generateCopy({}, 'בדיקת ציוד בשוהם', {
    runModel: async () => JSON.stringify({
      facebook: 'הרוכסן נסגר אחרי בדיקת ציוד בשוהם.',
      instagram: 'הרוכסן נסגר אחרי בדיקת ציוד בשוהם. #איחודהצלה',
      clarification: null,
      visualFacts: [],
    }),
  }), /platform_copy_identical/);
});

test('content generator accepts a clarification-only response without inventing copy', async () => {
  const result = await generateCopy({}, 'הכן פוסט לפי התמונה', {
    imagePaths: ['/approved.jpg'],
    runModel: async () => JSON.stringify({
      facebook: '',
      instagram: '',
      clarification: 'מה ההקשר של התמונה?',
      visualFacts: ['שלושה אנשים עומדים בחדר', 'על הקיר תלוי שלט'],
    }),
  });
  assert.equal(result.facebook, null);
  assert.equal(result.clarification, 'מה ההקשר של התמונה?');
});

test('content generator strips internal vault reporting from model fields', async () => {
  const result = await generateCopy({}, 'בדיקת ציוד בשוהם, כל פריט נבדק', {
    runModel: async () => JSON.stringify({
      facebook: 'בדיקת ציוד בשוהם, כל פריט נבדק.\n\nVault Activity: internal report',
      instagram: 'בשוהם כל פריט בציוד נבדק. 🧡\n#איחודהצלה #שוהם #מוכנות\n\nVault Protocol Violation: internal report',
      clarification: null,
      visualFacts: [],
    }),
  });
  assert.doesNotMatch(`${result.facebook}\n${result.instagram}`, /Vault/u);
});

test('content generator rejects description-only morning filler', async () => {
  await assert.rejects(() => generateCopy({}, 'נגרר כתום בתמונה', {
    runModel: async () => JSON.stringify({
      facebook: 'הנגרר הכתום נראה בתמונה. היום אנחנו פותחים את החלון עם מבט מקרוב על התמונה.',
      instagram: 'פותחים את הבוקר עם תמונה של נגרר כתום. 🟠\n#איחודהצלה #שוהם #קהילה',
      clarification: null,
      visualFacts: [],
    }),
  }), /too_generic/);
});

test('content generator rejects non-orange hearts', async () => {
  await assert.rejects(() => generateCopy({}, 'בדיקת ציוד בשוהם', {
    runModel: async () => JSON.stringify({
      facebook: 'בדיקת ציוד בשוהם מתחילה בפריט הראשון. 💚',
      instagram: 'בשוהם מתחילה בדיקת הציוד. 💚\n#איחודהצלה #שוהם #מוכנות',
      clarification: null,
      visualFacts: [],
    }),
  }), /non_orange_heart/);
});
