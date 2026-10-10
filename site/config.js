/* ZERO ONE interaction redesign release — 0 to 1.
   ZERO ONE content source.
   Empty values are intentional: no demo clients, stats, or portfolio work are published. */
window.ZERO_ONE_CONFIG = {
  brand: {
    name: "ZERO ONE",
    tagline: "From 0 to 1.",
    email: "zeroone.creative.01@gmail.com",
    whatsapp: "https://wa.me/201556764804",
    canonical: "https://zero-one9.vercel.app/"
  },
  assets: {
    /* Replace with approved local assets. Keep empty until supplied. */
    logo: "/zero-one-mark.png",
    /* Optional approved image used only when a case has no dedicated image/poster. */
    caseStudyPosterFallback: ""
  },
  stats: [],
  /* Add only approved case studies. Images/videos should be local, compressed, and have descriptive alt text.
     Field template:
     { id, title, client, category, year, summary, challenge, approach, outcome,
       image, imageAlt, video, poster }
     Do not add illustrative clients, outcomes, or metrics as if they were real.
  */
  caseStudies: [],
  /* Optional service preview images, keyed by service id. Empty values hide the floating image preview. */
  servicePreviews: {
    strategy: "",
    branding: "",
    social: "",
    ads: "",
    production: ""
  },
  services: {
    strategy: {
      title: { en: "Strategy", ar: "الاستراتيجية" },
      kicker: { en: "SERVICE / 01", ar: "الخدمة / ٠١" },
      description: {
        en: "Positioning, research, and direction that give your next move a clear purpose.",
        ar: "نحدد مكانة علامتك، ونفهم السوق، ونبني اتجاهًا واضحًا يساعدك على اتخاذ الخطوة التالية بثقة."
      }
    },
    branding: {
      title: { en: "Branding", ar: "بناء العلامة التجارية" },
      kicker: { en: "SERVICE / 02", ar: "الخدمة / ٠٢" },
      description: {
        en: "A distinct identity system—visuals, voice, and guidelines built to stay consistent as you grow.",
        ar: "هوية متكاملة تشمل الشكل البصري ونبرة التواصل والإرشادات التي تحافظ على اتساق علامتك مع نموها."
      }
    },
    social: {
      title: { en: "Social media", ar: "التواصل الاجتماعي" },
      kicker: { en: "SERVICE / 03", ar: "الخدمة / ٠٣" },
      description: {
        en: "Content direction and publishing systems designed around your audience, brand, and business goals.",
        ar: "اتجاه إبداعي ونظام محتوى مبنيان على جمهورك وهوية علامتك وأهداف نشاطك التجاري."
      }
    },
    ads: {
      title: { en: "Performance ads", ar: "إعلانات الأداء" },
      kicker: { en: "SERVICE / 04", ar: "الخدمة / ٠٤" },
      description: {
        en: "Structured campaigns, testing, and optimisation focused on measurable business outcomes.",
        ar: "حملات منظمة واختبارات وتحسين مستمر يركز على نتائج تجارية قابلة للقياس."
      }
    },
    production: {
      title: { en: "Content production", ar: "إنتاج المحتوى" },
      kicker: { en: "SERVICE / 05", ar: "الخدمة / ٠٥" },
      description: {
        en: "Art direction, video, photography, and motion that turn strategy into tangible creative.",
        ar: "إخراج فني وفيديو وتصوير وموشن يحول الاستراتيجية إلى محتوى إبداعي ملموس."
      }
    }
  }
};