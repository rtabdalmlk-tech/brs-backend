// server.js

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.warn('⚠️ متغير البيئة GEMINI_API_KEY غير موجود.');
}

app.use(cors());
app.use(express.json({ limit: '25mb' }));

// برومبت شرح الدروس
function getLessonPrompt() {
  return `
أنت مدرس لمادة محاسبة 1 لطلاب الجامعة.

أمامك ملف PDF يحتوي على دروس المادة. ركّز على الموضوعات التالية إن وجدت:
1- القيود اليومية.
2- دفتر الأستاذ العام.
3- ميزان المراجعة بالمجاميع والأرصدة.
4- مذكرة تسوية البنك.
5- الكمبيالة والأوراق التجارية.
6- قائمة الربح والخسارة (قائمة الدخل).
7- قائمة المركز المالي / الميزانية العمومية.

المطلوب:
- شرح كل موضوع باللغة العربية البسيطة.
- تنظيم الشرح في عناوين ونقاط واضحة.
- إعطاء مثال رقمي صغير لكل موضوع مع الحل خطوة بخطوة.
- في النهاية اكتب "ملخص سريع" لكل موضوع في سطرين.

إذا لم يوجد موضوع من هذه الموضوعات في الملف، تجاهله.
  `.trim();
}

// برومبت حل الاختبار
function getExamPrompt() {
  return `
أنت مدرس لمادة محاسبة 1 وخبير في إعداد الاختبارات.

أمامك ملف PDF يحتوي على نموذج اختبار لمادة محاسبة 1.

المطلوب:
1- قراءة جميع أسئلة الاختبار.
2- كتابة الحل الكامل لكل سؤال، خطوة بخطوة.
3- في أسئلة الصح والخطأ: اذكر الإجابة ثم السبب.
4- في الاختيار من متعدد: اذكر الاختيار الصحيح مع التفسير.
5- في أسئلة أذكر/عدد/عرّف: اجعل الإجابة في نقاط واضحة.
6- في المسائل والقيود اليومية: اكتب الحل المحاسبي خطوة بخطوة.

نظم الإجابة بهذا الشكل:
سؤال 1:
الحل: ...

لا تخمّن في الأسئلة غير الواضحة، فقط اذكر أنها غير واضحة في الملف.
  `.trim();
}

// استدعاء Gemini API
async function callGemini(promptText, fileBase64) {
  if (!GEMINI_API_KEY) {
    throw new Error('مفتاح GEMINI_API_KEY غير موجود في السيرفر.');
  }
  if (!fileBase64) {
    throw new Error('لم يتم إرسال ملف PDF.');
  }

  const url =
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=' +
    encodeURIComponent(GEMINI_API_KEY);

  const body = {
    contents: [
      {
        role: 'user',
        parts: [
          { text: promptText },
          {
            inline_data: {
              mime_type: 'application/pdf',
              data: fileBase64,
            },
          },
        ],
      },
    ],
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const txt = await response.text();
    throw new Error('خطأ من Gemini: ' + response.status + ' - ' + txt);
  }

  const data = await response.json();
  const candidate = data.candidates?.[0]?.content?.parts;
  if (!candidate || !candidate.length) {
    throw new Error('لم يتم استلام نص من النموذج.');
  }

  return candidate.map((p) => p.text || '').join('\n');
}

// مسار شرح الدروس
app.post('/api/lessons', async (req, res) => {
  try {
    const { fileBase64 } = req.body;
    const text = await callGemini(getLessonPrompt(), fileBase64);
    res.json({ ok: true, text });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// مسار حل الاختبار
app.post('/api/exam', async (req, res) => {
  try {
    const { fileBase64 } = req.body;
    const text = await callGemini(getExamPrompt(), fileBase64);
    res.json({ ok: true, text });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/', (req, res) => {
  res.send('BRS backend يعمل بنجاح ✔️');
});

app.listen(PORT, () => {
  console.log('🚀 Server running on port ' + PORT);
});
