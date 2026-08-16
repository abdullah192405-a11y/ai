/** Platform-specific embed snippets and step-by-step install guides. */

export const EMBED_PLATFORMS = [
  {
    id: 'custom-html',
    label: 'موقع HTML',
    emoji: '🔧',
    group: 'general',
    blurb: 'أي موقع عادي',
    difficulty: 'easy',
    aliases: ['html', 'موقع', 'مخصص', 'كود'],
  },
  {
    id: 'salla',
    label: 'سلة',
    emoji: '🛍️',
    group: 'sa-ecommerce',
    blurb: 'بدون مبرمج',
    difficulty: 'easy',
    aliases: ['سلة', 'salla', 'salla.sa', 'متجر سلة'],
  },
  {
    id: 'zid',
    label: 'زد',
    emoji: '🏬',
    group: 'sa-ecommerce',
    blurb: 'بدون مبرمج',
    difficulty: 'easy',
    aliases: ['زد', 'zid', 'zid.sa', 'متجر زد'],
  },
  {
    id: 'shopify',
    label: 'Shopify',
    emoji: '🛒',
    group: 'ecommerce',
    blurb: 'من لوحة الثيم',
    difficulty: 'easy',
    aliases: ['شوبيفاي', 'shopify'],
  },
  {
    id: 'wordpress',
    label: 'WordPress',
    emoji: '📝',
    group: 'cms',
    blurb: 'إضافة أو الثيم',
    difficulty: 'easy',
    aliases: ['ووردبريس', 'wordpress', 'wp'],
  },
  {
    id: 'wix',
    label: 'Wix',
    emoji: '🌐',
    group: 'cms',
    blurb: 'كود مخصص',
    difficulty: 'easy',
    aliases: ['ويكس', 'wix'],
  },
  {
    id: 'squarespace',
    label: 'Squarespace',
    emoji: '📦',
    group: 'cms',
    blurb: 'حقن في التذييل',
    difficulty: 'easy',
    aliases: ['سكوير سبيس', 'squarespace'],
  },
  {
    id: 'webflow',
    label: 'Webflow',
    emoji: '🎨',
    group: 'cms',
    blurb: 'كود التذييل',
    difficulty: 'easy',
    aliases: ['ويب فلو', 'webflow'],
  },
  {
    id: 'react',
    label: 'React',
    emoji: '⚛️',
    group: 'framework',
    blurb: 'للمطوّرين',
    difficulty: 'dev',
    aliases: ['رياكت', 'react'],
  },
  {
    id: 'nextjs',
    label: 'Next.js',
    emoji: '▲',
    group: 'framework',
    blurb: 'للمطوّرين',
    difficulty: 'dev',
    aliases: ['نكست', 'next', 'nextjs'],
  },
  {
    id: 'vue',
    label: 'Vue.js',
    emoji: '🔷',
    group: 'framework',
    blurb: 'للمطوّرين',
    difficulty: 'dev',
    aliases: ['فيو', 'vue'],
  },
  {
    id: 'angular',
    label: 'Angular',
    emoji: '🅰️',
    group: 'framework',
    blurb: 'للمطوّرين',
    difficulty: 'dev',
    aliases: ['انجولار', 'angular'],
  },
  {
    id: 'rails',
    label: 'Ruby on Rails',
    emoji: '💎',
    group: 'framework',
    blurb: 'للمطوّرين',
    difficulty: 'dev',
    aliases: ['ريلز', 'rails', 'ruby'],
  },
  {
    id: 'django',
    label: 'Django',
    emoji: '🐍',
    group: 'framework',
    blurb: 'للمطوّرين',
    difficulty: 'dev',
    aliases: ['جانغو', 'django', 'python'],
  },
];

export const EMBED_GROUPS = [
  { id: 'general', label: 'موقع عادي' },
  { id: 'sa-ecommerce', label: 'متاجر سعودية' },
  { id: 'ecommerce', label: 'متاجر عالمية' },
  { id: 'cms', label: 'منصات المواقع' },
  { id: 'framework', label: 'للمطوّرين' },
];

export const DIFFICULTY_LABELS = {
  easy: 'سهل — بدون برمجة',
  medium: 'متوسط',
  dev: 'للمطوّرين',
};

export function getEmbedPlatform(platformId) {
  return EMBED_PLATFORMS.find((p) => p.id === platformId) || EMBED_PLATFORMS[0];
}

function scriptTag(baseUrl, apiKey) {
  return `<script src="${baseUrl}/embed.js" data-key="${apiKey}" async></script>`;
}

/**
 * Pure-JS loader used by platforms whose code field strips <script> tags
 * (e.g. Salla / Zid theme JS customizers).
 */
function jsLoader(baseUrl, apiKey) {
  return `(function () {
  var s = document.createElement('script');
  s.src = '${baseUrl}/embed.js';
  s.async = true;
  s.setAttribute('data-key', '${apiKey}');
  document.body.appendChild(s);
})();`;
}

function pack(meta, extra) {
  const steps = extra.steps || [];
  return {
    ...meta,
    ...extra,
    instructions: steps
      .map((s, i) => `${i + 1}. ${s.title}${s.detail ? ` — ${s.detail}` : ''}`)
      .join(' '),
  };
}

/**
 * @param {{ platformId: string, baseUrl: string, apiKey?: string }} opts
 * @returns {object}
 */
export function getEmbedSnippet({ platformId, baseUrl, apiKey = 'YOUR_API_KEY' }) {
  const platform = getEmbedPlatform(platformId);
  const script = scriptTag(baseUrl, apiKey);
  const keyNote = apiKey || 'YOUR_API_KEY';
  const needsKey = !keyNote || keyNote === 'YOUR_API_KEY';
  const meta = {
    platformId: platform.id,
    title: platform.label,
    emoji: platform.emoji,
    blurb: platform.blurb,
    difficulty: platform.difficulty,
    difficultyLabel: DIFFICULTY_LABELS[platform.difficulty] || DIFFICULTY_LABELS.easy,
    needsKey,
  };

  const afterCommon = [
    'افتح موقعك في نافذة جديدة (كزائر وليس من لوحة التحكم).',
    'ابحث عن أيقونة المحادثة في زاوية الصفحة — قد تحتاج ثانية أو اثنتين.',
    'اكتب سؤالاً تجريبياً مثل «مرحبا» للتأكد أن المساعد يرد.',
  ];

  switch (platform.id) {
    case 'salla':
      return pack(meta, {
        summary: 'ثبّت المساعد على متجر سلة بلصق كود جاهز داخل تخصيص الثيم. لا تحتاج مبرمجاً.',
        audience: 'مناسب لصاحب المتجر — الخطوات من لوحة سلة مباشرة.',
        time: 'حوالي ٣ دقائق',
        loginUrl: 'https://s.salla.sa',
        loginLabel: 'فتح لوحة سلة',
        codeLabel: 'كود سلة — الصقه كما هو بدون تعديل',
        codeNote:
          'سلة ترفض وسوم <script> داخل خانة الـ JS. لذلك هذا الكود بلغة JavaScript فقط — لا تضف أي شيء قبله أو بعده.',
        warning: 'لا تلصق هذا الكود في خانة CSS أو HTML. المكان الصحيح فقط: «تخصيص عن طريق الـ JS».',
        steps: [
          {
            title: 'ادخل إلى لوحة تحكم سلة',
            detail:
              'افتح salla.sa وسجّل الدخول بحساب التاجر (حساب المتجر)، وليس حساب العميل. من الموبايل استخدم متصفح الكمبيوتر إن أمكن لأن تخصيص الثيم أوضح على الشاشة الكبيرة.',
          },
          {
            title: 'افتح تصميم المتجر',
            detail:
              'من القائمة الجانبية اختر «المظهر» ثم «تصميم المتجر»، أو ادخل إلى «ثيماتي». ستظهر الثيمات المثبّتة والمتجر الحالي عليه شارة «مفعّل».',
          },
          {
            title: 'خصّص الثيم المفعّل',
            detail:
              'بجانب الثيم الحالي اضغط «خيارات الثيم» ثم «تخصيص الثيم»، أو زر «تخصيص» مباشرة. لا تغيّر الثيم نفسه — نحتاج فقط صفحة التخصيص.',
          },
          {
            title: 'افتح خانة تخصيص JavaScript',
            detail:
              'من تبويبات التخصيص اختر «تخصيص التصميم». انزل حتى تجد «تخصيص عن طريق الـ JS» (قد يظهر باسم Custom JS). إذا لم تجده: جرّب «خيارات متقدمة» أو «أكواد مخصصة» داخل نفس الصفحة.',
          },
          {
            title: 'الصق الكود ثم احفظ',
            detail:
              'انسخ الكود أدناه والصقه في المربع كما هو. لا تضف وسوم <script> ولا تحذف أي سطر. اضغط «حفظ التغييرات» وانتظر رسالة النجاح. بعدها اضغط «عرض المتجر» أو افتح رابط متجرك.',
          },
        ],
        after: [
          'افتح متجرك كزائر (رابط المتجر العام، وليس معاينة التخصيص فقط).',
          'ستظهر أيقونة المحادثة في الزاوية خلال ثوانٍ.',
          'إذا لم تظهر: حدّث الصفحة بـ Ctrl+Shift+R أو افتح نافذة خاصة (Incognito).',
        ],
        troubleshooting: [
          {
            q: 'لم تظهر أيقونة المحادثة',
            a: 'تأكد أنك حفظت في سلة، وأن الكود داخل خانة JS وليس CSS. امسح كاش المتصفح أو جرّب جوالاً آخر. تأكد أيضاً أن الويدجت مفعّل لهذا الموقع من صفحة «مواقعي».',
          },
          {
            q: 'ظهرت رسالة خطأ بعد الحفظ',
            a: 'غالباً تم لصق وسوم <script> مع الكود. احذف كل شيء من خانة JS والصق الكود أدناه فقط من أول سطر إلى آخره.',
          },
          {
            q: 'المساعد يظهر لكن لا يرد',
            a: 'تحقق أن مفتاح الربط داخل الكود صحيح (يبدأ عادة بـ pk_). أنشئ مفتاحاً جديداً من صفحة «مفاتيح الربط» والصقه في الخانة أعلاه ثم انسخ الكود من جديد.',
          },
        ],
        code: `/* مساعد WBA — الصق داخل «تخصيص عن طريق الـ JS» في سلة */
${jsLoader(baseUrl, keyNote)}`,
      });

    case 'zid':
      return pack(meta, {
        summary: 'ثبّت المساعد على متجر زد من أكواد الثيم المخصصة. الخطوات من لوحة زد مباشرة.',
        audience: 'مناسب لصاحب المتجر — بدون تعديل ملفات.',
        time: 'حوالي ٣ دقائق',
        loginUrl: 'https://web.zid.sa',
        loginLabel: 'فتح لوحة زد',
        codeLabel: 'كود زد — الصقه كما هو بدون تعديل',
        codeNote: 'زد أيضاً تفضّل كود JavaScript بدون وسوم <script>. الصق الكود كما هو ثم انشر التصميم.',
        warning: 'بعد الحفظ اضغط «نشر» حتى يظهر المساعد للزوار وليس في المعاينة فقط.',
        steps: [
          {
            title: 'ادخل إلى لوحة تحكم زد',
            detail: 'سجّل الدخول من web.zid.sa بحساب مالك المتجر.',
          },
          {
            title: 'افتح تصاميم المتجر',
            detail: 'من القائمة اختر «المتجر» ثم «التصاميم» (أو المظهر). ستجد الثيم المفعّل في الأعلى.',
          },
          {
            title: 'عدّل الثيم الحالي',
            detail: 'اضغط «تعديل» أو «تخصيص» بجانب الثيم المفعّل. لا تثبّت ثيماً جديداً لهذه الخطوة.',
          },
          {
            title: 'ابحث عن الأكواد المخصصة',
            detail:
              'من إعدادات الثيم افتح قسم «الأكواد المخصصة» أو Custom JS / Footer scripts. هذا هو المكان الصحيح — ليس خانة الألوان أو CSS.',
          },
          {
            title: 'الصق الكود ثم انشر',
            detail: 'الصق الكود أدناه كما هو، احفظ، ثم اضغط «نشر» حتى يصل التغيير إلى المتجر الحي.',
          },
        ],
        after: afterCommon,
        troubleshooting: [
          {
            q: 'الحفظ نجح لكن الزوار لا يرون المساعد',
            a: 'غالباً بقي التغيير في المعاينة. ارجع للتصميم واضغط «نشر» أو «حفظ ونشر».',
          },
          {
            q: 'لا أجد خانة الأكواد المخصصة',
            a: 'بعض الثيمات تضعها تحت «إعدادات متقدمة» أو «تذييل الصفحة». يمكنك أيضاً لصق الكود عبر تطبيق «أكواد مخصصة» من متجر تطبيقات زد إن وُجد.',
          },
        ],
        code: `/* مساعد WBA — الصق داخل قسم الأكواد المخصصة في زد */
${jsLoader(baseUrl, keyNote)}`,
      });

    case 'shopify':
      return pack(meta, {
        summary: 'أضف المساعد لكل صفحات متجر Shopify بلصق سطر واحد في ملف theme.liquid.',
        audience: 'من لوحة Shopify — لا تحتاج تطبيقاً خارجياً.',
        time: 'حوالي ٤ دقائق',
        loginUrl: 'https://admin.shopify.com',
        loginLabel: 'فتح Shopify Admin',
        codeLabel: 'كود Shopify — قبل وسم </body>',
        codeNote: 'الصق الكود في theme.liquid قبل آخر سطر </body> حتى يظهر المساعد في كل الصفحات.',
        steps: [
          {
            title: 'ادخل إلى لوحة Shopify',
            detail: 'افتح admin.shopify.com واختر المتجر المطلوب.',
          },
          {
            title: 'افتح الثيم الحالي',
            detail: 'من القائمة: Online Store → Themes. بجانب الثيم المفعّل اضغط ⋮ ثم Edit code (تعديل الكود).',
          },
          {
            title: 'افتح ملف theme.liquid',
            detail: 'من المجلد Layout اضغط theme.liquid. هذا الملف يغلّف كل صفحات المتجر.',
          },
          {
            title: 'الصق الكود قبل </body>',
            detail:
              'انزل إلى نهاية الملف. قبل وسم </body> الصق الكود أدناه. احفظ الملف (Save). التغيير يظهر فوراً على المتجر.',
          },
        ],
        after: afterCommon,
        troubleshooting: [
          {
            q: 'لا أجد Edit code',
            a: 'اضغط «Customize» ثم من القائمة العلوية «⋯» واختر Edit code. أو من Themes اضغط «Edit code» مباشرة بجانب الثيم.',
          },
        ],
        code: `{%- comment -%} WBA Chat Widget {%- endcomment -%}
${script}`,
      });

    case 'wordpress':
      return pack(meta, {
        summary: 'أسهل طريقة: إضافة Insert Headers and Footers. البديل: سطر في functions.php.',
        audience: 'أصحاب مواقع ووردبريس — الطريقة الأولى لا تحتاج تعديلاً على الملفات.',
        time: 'حوالي ٥ دقائق',
        codeLabel: 'كود ووردبريس',
        codeNote:
          'إذا استخدمت إضافة الهيدر/الفوتر: الصق سطر الـ script فقط في خانة Footer. إذا عدّلت functions.php استخدم المقطع كاملاً.',
        warning: 'لا تعدّل functions.php إلا إذا أخذت نسخة احتياطية من الثيم. الإضافة أأمن للمبتدئين.',
        steps: [
          {
            title: 'الطريقة الأسهل — تثبيت إضافة',
            detail:
              'من لوحة ووردبريس: إضافات → أضف جديداً. ابحث عن «Insert Headers and Footers» أو «WPCode». ثبّت الإضافة وفعّلها.',
          },
          {
            title: 'الصق الكود في تذييل الموقع',
            detail:
              'من الإعدادات افتح الإضافة ثم خانة Footer / قبل </body>. الصق سطر السكربت (السطر الذي يبدأ بـ <script) واحفظ.',
          },
          {
            title: 'بديل للمطوّرين — functions.php',
            detail:
              'المظهر → محرر ملفات الثيم → functions.php. الصق مقطع PHP أدناه في نهاية الملف واحفظ. استخدم ثيماً ابناً (child theme) حتى لا يضيع التعديل عند التحديث.',
          },
        ],
        after: afterCommon,
        troubleshooting: [
          {
            q: 'الموقع تعطل بعد تعديل functions.php',
            a: 'أزل المقطع الذي أضفته عبر FTP أو مدير الملفات. استخدم طريقة الإضافة بدلاً منه.',
          },
        ],
        code: `<!-- الصق هذا السطر في تذييل الموقع عبر الإضافة -->
${script}

/* أو أضف هذا في functions.php */
add_action('wp_footer', function () {
?>
${script}
<?php
});`,
      });

    case 'wix':
      return pack(meta, {
        summary: 'من إعدادات ويكس أضف كوداً مخصصاً على كل الصفحات في نهاية الـ Body.',
        audience: 'أصحاب مواقع Wix — من الإعدادات وليس محرر الصفحة.',
        time: 'حوالي ٤ دقائق',
        loginUrl: 'https://manage.wix.com',
        loginLabel: 'فتح Wix',
        codeLabel: 'كود Wix',
        codeNote: 'اختر Body - end و All pages حتى يظهر المساعد في كل الموقع وليس صفحة واحدة.',
        steps: [
          {
            title: 'افتح إعدادات الموقع',
            detail: 'من لوحة Wix ادخل إلى Settings (الإعدادات).',
          },
          {
            title: 'أضف كوداً مخصصاً',
            detail: 'اختر Custom Code (كود مخصص) ثم Add Code.',
          },
          {
            title: 'ضع الكود في نهاية الصفحة',
            detail:
              'الصق الكود، اختر «Body - end»، ونطاق العرض «All pages». سمّه مثلاً «WBA Chat» ثم Apply.',
          },
        ],
        after: afterCommon,
        troubleshooting: [
          {
            q: 'الخيار Custom Code غير ظاهر',
            a: 'يتوفر على الخطط المدفوعة في Wix. إن لم يظهر، انشر الموقع أولاً أو ترقَّ للخطة التي تدعم الكود المخصص.',
          },
        ],
        code: script,
      });

    case 'squarespace':
      return pack(meta, {
        summary: 'من Code Injection الصق الكود في خانة Footer ليظهر على كل الصفحات.',
        time: 'حوالي ٣ دقائق',
        codeLabel: 'كود Squarespace',
        steps: [
          {
            title: 'افتح الإعدادات المتقدمة',
            detail: 'Settings → Advanced → Code Injection.',
          },
          {
            title: 'الصق في التذييل',
            detail: 'الصق الكود في خانة Footer ثم Save. يحتاج الموقع خطة تدعم Code Injection.',
          },
        ],
        after: afterCommon,
        troubleshooting: [
          {
            q: 'لا أجد Code Injection',
            a: 'هذه الميزة على خطط Business وأعلى. بدونها لن يقبل Squarespace السكربت الخارجي.',
          },
        ],
        code: script,
      });

    case 'webflow':
      return pack(meta, {
        summary: 'أضف السكربت في Footer Code من إعدادات المشروع ثم انشر الموقع.',
        time: 'حوالي ٣ دقائق',
        codeLabel: 'كود Webflow',
        warning: 'الحفظ وحده لا يكفي — اضغط Publish حتى يراه الزوار.',
        steps: [
          {
            title: 'افتح إعدادات المشروع',
            detail: 'Project Settings → Custom Code.',
          },
          {
            title: 'الصق في Footer Code',
            detail: 'الصق الكود في Footer Code واحفظ.',
          },
          {
            title: 'انشر الموقع',
            detail: 'من Designer أو لوحة المشروع اضغط Publish واختر النطاق.',
          },
        ],
        after: afterCommon,
        troubleshooting: [],
        code: script,
      });

    case 'react':
      return pack(meta, {
        summary: 'حمّل سكربت التضمين مرة واحدة من index.html أو عبر useEffect في الجذر.',
        audience: 'لمطوّر الواجهة — لا تضف السكربت داخل كل مكوّن.',
        time: 'حوالي ٥ دقائق',
        codeLabel: 'كود React',
        steps: [
          {
            title: 'الطريقة الموصى بها — index.html',
            detail: 'افتح public/index.html والصق سطر السكربت قبل </body>. هذا يكفي لمعظم تطبيقات CRA وVite.',
          },
          {
            title: 'بديل — تحميل ديناميكي',
            detail: 'إذا لم يكن لديك index.html (بعض أدوات البناء)، استخدم useEffect في App.jsx كما في المثال الثاني. أزل السكربت عند إلغاء التثبيت حتى لا يتكرر.',
          },
        ],
        after: afterCommon,
        troubleshooting: [
          {
            q: 'ظهرت أيقونتان',
            a: 'السكربت أُضيف مرتين (في HTML وفي React). اترك طريقة واحدة فقط.',
          },
        ],
        code: `<!-- public/index.html قبل </body> -->
${script}

/* أو ديناميكياً في App.jsx */
useEffect(() => {
  const s = document.createElement('script');
  s.src = '${baseUrl}/embed.js';
  s.dataset.key = '${keyNote}';
  s.async = true;
  document.body.appendChild(s);
  return () => s.remove();
}, []);`,
      });

    case 'nextjs':
      return pack(meta, {
        summary: 'استخدم next/script في التخطيط الجذر حتى يُحمَّل المساعد بعد تفاعل الصفحة.',
        time: 'حوالي ٥ دقائق',
        codeLabel: 'كود Next.js',
        steps: [
          {
            title: 'App Router',
            detail: 'افتح app/layout.tsx (أو layout.js) وأضف مكوّن Script من next/script قبل إغلاق body كما في المثال.',
          },
          {
            title: 'Pages Router',
            detail: 'إن كان مشروعك يستخدم صفحات pages/ ضع السكربت في pages/_document.tsx داخل <body>.',
          },
        ],
        after: afterCommon,
        troubleshooting: [],
        code: `// app/layout.tsx
import Script from 'next/script';

export default function RootLayout({ children }) {
  return (
    <html lang="ar">
      <body>
        {children}
        <Script
          src="${baseUrl}/embed.js"
          data-key="${keyNote}"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}`,
      });

    case 'vue':
      return pack(meta, {
        summary: 'أضف السكربت في index.html أو حمّله مرة واحدة من App.vue.',
        time: 'حوالي ٥ دقائق',
        codeLabel: 'كود Vue',
        steps: [
          {
            title: 'index.html',
            detail: 'الصق سطر السكربت قبل </body> في الملف الجذر.',
          },
          {
            title: 'أو من App.vue',
            detail: 'استخدم onMounted لإضافة السكربت إن لم يكن index.html متاحاً للتعديل.',
          },
        ],
        after: afterCommon,
        troubleshooting: [],
        code: `<!-- index.html قبل </body> -->
${script}

<!-- أو في App.vue -->
<script setup>
import { onMounted } from 'vue';

onMounted(() => {
  const s = document.createElement('script');
  s.src = '${baseUrl}/embed.js';
  s.dataset.key = '${keyNote}';
  s.async = true;
  document.body.appendChild(s);
});
</script>`,
      });

    case 'angular':
      return pack(meta, {
        summary: 'أسهل خيار: سطر في src/index.html. يمكن أيضاً تحميله من APP_INITIALIZER.',
        time: 'حوالي ٥ دقائق',
        codeLabel: 'كود Angular',
        steps: [
          {
            title: 'أضفه في index.html',
            detail: 'افتح src/index.html والصق السكربت قبل </body>.',
          },
        ],
        after: afterCommon,
        troubleshooting: [],
        code: `<!-- src/index.html قبل </body> -->
${script}`,
      });

    case 'rails':
      return pack(meta, {
        summary: 'أضف السكربت في التخطيط الرئيسي ليظهر في كل الصفحات.',
        time: 'حوالي ٤ دقائق',
        codeLabel: 'كود Rails',
        steps: [
          {
            title: 'افتح التخطيط الرئيسي',
            detail: 'الملف عادة app/views/layouts/application.html.erb.',
          },
          {
            title: 'الصق قبل </body>',
            detail: 'الصق سطر السكربت واحفظ ثم أعد تشغيل الصفحة.',
          },
        ],
        after: afterCommon,
        troubleshooting: [],
        code: `<%# app/views/layouts/application.html.erb — before </body> %>
<script src="${baseUrl}/embed.js" data-key="${keyNote}" async></script>`,
      });

    case 'django':
      return pack(meta, {
        summary: 'أضف السكربت في القالب الأساسي الذي ترثه كل الصفحات.',
        time: 'حوالي ٤ دقائق',
        codeLabel: 'كود Django',
        steps: [
          {
            title: 'افتح القالب الأساسي',
            detail: 'عادة templates/base.html أو ما يعادله في مشروعك.',
          },
          {
            title: 'الصق قبل </body>',
            detail: 'الصق السكربت داخل القالب الأساسي حتى يظهر في كل الصفحات.',
          },
        ],
        after: afterCommon,
        troubleshooting: [],
        code: `{# templates/base.html #}
<script src="${baseUrl}/embed.js" data-key="${keyNote}" async></script>`,
      });

    case 'custom-html':
    default:
      return pack(meta, {
        summary: 'أضف سطراً واحداً قبل نهاية كل صفحة. يعمل على أي موقع HTML.',
        audience: 'إن لم يكن متجرك على سلة أو زد أو ووردبريس — هذه الطريقة العامة.',
        time: 'حوالي دقيقتين',
        codeLabel: 'كود HTML',
        codeNote: 'ضع السطر مرة واحدة في القالب المشترك (الهيدر أو الفوتر) حتى لا تكرره في كل صفحة يدوياً.',
        steps: [
          {
            title: 'افتح ملف القالب',
            detail:
              'افتح الملف الذي يظهر في كل الصفحات — غالباً footer.html أو index.html أو القالب الرئيسي لموقعك.',
          },
          {
            title: 'الصق قبل </body>',
            detail:
              'انزل إلى آخر الصفحة. قبل وسم </body> الصق السطر أدناه. احفظ الملف وارفعه إن كان الموقع على استضافة.',
          },
          {
            title: 'افتح الموقع للتأكد',
            detail: 'حدّث الصفحة. أيقونة المحادثة تظهر في الزاوية التي اخترتها من «شكل المساعد».',
          },
        ],
        after: afterCommon,
        troubleshooting: [
          {
            q: 'لا أرى </body> في ملفي',
            a: 'بعض المنصات تخفيه. ابحث عن «كود مخصص» أو «تذييل الصفحة» أو «Header/Footer scripts» والصق السطر هناك.',
          },
        ],
        code: script,
      });
  }
}
