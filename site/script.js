/* ZERO ONE — accessible motion, bilingual UI, and progressive enhancement. */
(() => {
  'use strict';

  const doc = document;
  const root = doc.documentElement;
  const body = doc.body;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(pointer: fine)').matches;
  const aborter = new AbortController();
  const { signal } = aborter;
  const $ = (selector, scope = doc) => scope.querySelector(selector);
  const $$ = (selector, scope = doc) => [...scope.querySelectorAll(selector)];
  const config = {
    stats: [],
    caseStudies: [],
    contact: { endpoint: '/api/contact' }
  };

  root.classList.add('js');
  const preloader = $('.preloader');
  preloader?.remove(); // Content is never held behind an animation.
  const progress = $('.scroll-progress span');
  let progressFrame = 0;

  function updateProgress() {
    progressFrame = 0;
    const maxScroll = doc.documentElement.scrollHeight - window.innerHeight;
    if (progress) progress.style.width = (maxScroll > 0 ? Math.min(1, window.scrollY / maxScroll) * 100 : 0) + '%';
  }
  function scheduleProgress() {
    if (!progressFrame) progressFrame = requestAnimationFrame(updateProgress);
  }
  window.addEventListener('scroll', scheduleProgress, { passive: true, signal });
  window.addEventListener('resize', scheduleProgress, { passive: true, signal });
  window.addEventListener('orientationchange', scheduleProgress, { passive: true, signal });
  updateProgress();

  // Data-driven sections stay hidden until verified content is supplied.
  const statsHost = $('#verified-stats');
  if (statsHost && config.stats.length) {
    statsHost.hidden = false;
    statsHost.innerHTML = config.stats.map(item =>
      '<div class="stat"><strong>' + escapeHTML(String(item.value)) + '</strong><span>' + escapeHTML(item.label) + '</span></div>'
    ).join('');
  }
  const workSection = $('#work');
  if (workSection && config.caseStudies.length) {
    workSection.hidden = false;
    // Add approved case-study cards here; empty configuration intentionally renders no cards.
  }
  function escapeHTML(value) {
    return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  }

  const services = {
    strategy: {
      en: ['Strategy', 'SERVICE / 01', 'Positioning, research, and direction that give your next move a clear purpose.'],
      ar: ['الاستراتيجية', 'الخدمة / ٠١', 'نحدد مكانة علامتك، ونفهم السوق، ونبني اتجاهًا واضحًا يساعدك على اتخاذ الخطوة التالية بثقة.']
    },
    branding: {
      en: ['Branding', 'SERVICE / 02', 'A distinct identity system—visuals, voice, and guidelines built to stay consistent as you grow.'],
      ar: ['بناء العلامة التجارية', 'الخدمة / ٠٢', 'هوية متكاملة ومميزة تشمل الشكل البصري ونبرة التواصل والإرشادات التي تحافظ على اتساق علامتك مع نموها.']
    },
    social: {
      en: ['Social media', 'SERVICE / 03', 'Content direction and publishing systems designed around your audience, brand, and business goals.'],
      ar: ['إدارة التواصل الاجتماعي', 'الخدمة / ٠٣', 'اتجاه إبداعي ونظام محتوى مبنيان على جمهورك وهوية علامتك وأهداف نشاطك التجاري.']
    },
    ads: {
      en: ['Performance ads', 'SERVICE / 04', 'Structured campaigns, testing, and optimisation focused on measurable business outcomes.'],
      ar: ['الإعلانات والأداء', 'الخدمة / ٠٤', 'حملات منظمة واختبارات وتحسين مستمر يركز على نتائج تجارية قابلة للقياس.']
    },
    production: {
      en: ['Content production', 'SERVICE / 05', 'Art direction, video, photography, and motion that turn the strategy into tangible creative.'],
      ar: ['إنتاج المحتوى', 'الخدمة / ٠٥', 'إخراج فني وفيديو وتصوير وموشن يحول الاستراتيجية إلى محتوى إبداعي ملموس.']
    }
  };
  const servicePanel = $('#service-detail');
  const serviceTitle = $('.detail-title', servicePanel || doc);
  const serviceKicker = $('.detail-kicker', servicePanel || doc);
  const serviceCopy = $('.detail-copy', servicePanel || doc);
  let activeService = null;

  function selectService(key, language = root.lang === 'ar' ? 'ar' : 'en') {
    const data = services[key];
    if (!data || !servicePanel) return;
    const item = data[language];
    activeService = key;
    serviceTitle.textContent = item[0];
    serviceKicker.textContent = item[1];
    serviceCopy.textContent = item[2];
    servicePanel.hidden = false;
    $$('.service-row').forEach(button => {
      const selected = button.dataset.service === key;
      button.setAttribute('aria-expanded', String(selected));
      button.classList.toggle('is-selected', selected);
    });
  }
  $$('[data-service]').forEach(button => {
    button.addEventListener('click', () => {
      const key = button.dataset.service;
      if (activeService === key && servicePanel && !servicePanel.hidden) {
        servicePanel.hidden = true;
        activeService = null;
        button.setAttribute('aria-expanded', 'false');
        button.classList.remove('is-selected');
        return;
      }
      selectService(key);
    }, { signal });
  });

  const translations = {
    ar: {
      '.header-note': 'شريك إبداعي مستقل<br>للمرحلة القادمة.',
      '.menu-toggle-label': 'القائمة',
      '.menu-top span': 'ZERO ONE / القائمة',
      '.menu-close': 'إغلاق <b>×</b>',
      '.menu-links a:nth-child(1) span:nth-child(2)': 'من نحن',
      '.menu-links a:nth-child(2) span:nth-child(2)': 'خدماتنا',
      '.menu-links a:nth-child(3) span:nth-child(2)': 'الأعمال',
      '.menu-links a:nth-child(4) span:nth-child(2)': 'منهجيتنا',
      '.menu-links a:nth-child(5) span:nth-child(2)': 'ابدأ مشروعك',
      '.menu-bottom > span': 'استراتيجية / هوية / نمو',
      '.hero-topline > span:first-child': 'تفكير إبداعي. أثر تجاري.',
      '.hero-edition': 'للطموحين <b>© 2026</b>',
      '.hero-side-note p': 'نحوّل الأفكار الواضحة<br>إلى علامات تتحرك للأمام.',
      '.hero-stamp span:first-child': 'من الصفر',
      '.hero-stamp span:last-child': 'إلى شيء أكبر',
      '.hero-bottom p': 'استراتيجية. هوية. محتوى. نمو.<br>فريق واحد يرافقك من أول فكرة.',
      '.text-link': 'اكتشف أعمالنا <span aria-hidden="true">↘</span>',
      '.scroll-cue span:first-child': 'مرّر للاستكشاف',
      '.about .section-kicker span:first-child': '01 / ما نؤمن به',
      '.about .section-kicker span:last-child': 'بلا اختصارات. بلا ضجيج.',
      '.about-copy p': 'كل شيء كبير يبدأ <span>بفكرة</span>. نمنحها <span>اتجاهًا</span>، ونبني علامة يتذكرها الناس، ونصنع زخمًا يحوّل الاهتمام إلى <span>فعل</span>. لا تخمين ولا وصفات مستعارة؛ فقط خطوات مدروسة.',
      '.aside-copy': 'لا نجمّل العلامات فقط.<br><span>بل نبدأها.</span>',
      '.services .section-kicker span:first-child': '02 / ماذا نقدم',
      '.services .section-kicker span:last-child': 'فكّر أولًا. اصنع أثرًا.',
      '.services-heading h2': 'اجعل كل<br>خطوة <span class="orange">مؤثرة.</span>',
      '.services-heading p': 'من الفكرة الأولى إلى النتيجة، نبني ما يدفع نشاطك إلى الأمام.',
      '.service-row:nth-child(1) .service-desc': 'تموضع / بحث / اتجاه',
      '.service-row:nth-child(2) .service-desc': 'هوية / صوت / إرشادات',
      '.service-row:nth-child(3) .service-desc': 'أنظمة محتوى / مجتمع',
      '.service-row:nth-child(4) .service-desc': 'إعلانات / اختبارات / نمو',
      '.service-row:nth-child(5) .service-desc': 'إخراج فني / فيديو / موشن',
      '.detail-contact': 'ناقش هذه الخدمة <span aria-hidden="true">↘</span>',
      '.process .section-kicker span:first-child': '04 / كيف نتحرك',
      '.process .section-kicker span:last-child': 'وضوح في كل خطوة.',
      '.process-heading h2': 'طريق واضح.<br><span class="orange">زخم حقيقي.</span>',
      '.process-heading p': 'العمل الجيد ليس لغزًا. نوضح الطريق، ونتخذ قرارات مدروسة، ونحدد الخطوة التالية.',
      '.process-card:nth-child(1) .process-card-top span:last-child': 'الاكتشاف',
      '.process-card:nth-child(1) h3': 'اكتشف الإشارة.',
      '.process-card:nth-child(1) p': 'نطرح الأسئلة الصحيحة، ونراجع الافتراضات، ونحدد المشكلة التي تستحق الحل.',
      '.process-card:nth-child(2) .process-card-top span:last-child': 'الاتجاه',
      '.process-card:nth-child(2) h3': 'اختر الخطوة.',
      '.process-card:nth-child(2) p': 'نحوّل الفهم إلى تموضع واضح وفكرة واثقة وخطة يستطيع الجميع اتباعها.',
      '.process-card:nth-child(3) .process-card-top span:last-child': 'البناء',
      '.process-card:nth-child(3) h3': 'حوّلها إلى واقع.',
      '.process-card:nth-child(3) p': 'هوية ومحتوى وحملات وتجارب تعمل معًا بدلًا من التنافس على الانتباه.',
      '.process-card:nth-child(4) .process-card-top span:last-child': 'التحسين',
      '.process-card:nth-child(4) h3': 'واصل التقدم.',
      '.process-card:nth-child(4) p': 'نتابع ما يهم، ونتعلم بسرعة، ونستخدم البيانات الحقيقية لاكتشاف الفرصة التالية.',
      '.contact .section-kicker span:first-child': '05 / خطوتك التالية',
      '.contact .section-kicker span:last-child': 'الخطوة الجيدة التالية تبدأ هنا.',
      '.contact-side': 'لديك فكرة كبيرة؟<br>لنمنحها اتجاهًا.',
      '.contact-action-row > p': 'لا تحتاج إلى عرض تقديمي.<br>أخبرنا فقط بما تبنيه.',
      '.form-heading h3': 'أخبرنا عمّا تعمل عليه.',
      '.form-heading p': 'شاركنا بعض التفاصيل وسنرد عليك عبر البريد الإلكتروني.',
      '.contact-form label:nth-of-type(1) .field-label': 'الاسم',
      '.contact-form label:nth-of-type(2) .field-label': 'البريد الإلكتروني',
      '.contact-form label:nth-of-type(3) .field-label': 'الشركة / العلامة <span class="optional">(اختياري)</span>',
      '.contact-form label:nth-of-type(4) .field-label': 'ما الخدمة التي تحتاجها؟',
      '.contact-form label:nth-of-type(5) .field-label': 'تفاصيل المشروع',
      '.form-submit': 'إرسال طلب المشروع <span aria-hidden="true">↗</span>',
      '.contact-links > .underlink': 'zeroone.creative.01@gmail.com <span aria-hidden="true">↗</span>',
      '.back-top': 'العودة للأعلى <span aria-hidden="true">↑</span>',
      '.whatsapp-float b': 'واتساب'
    },
    en: {}
  };

  function setLanguage(language) {
    const lang = language === 'ar' ? 'ar' : 'en';
    root.lang = lang;
    root.dir = lang === 'ar' ? 'rtl' : 'ltr';
    const toggle = $('.lang-toggle');
    if (toggle) {
      toggle.textContent = lang === 'ar' ? 'EN' : 'AR';
      toggle.setAttribute('aria-pressed', String(lang === 'ar'));
      toggle.setAttribute('aria-label', lang === 'ar' ? 'Switch language to English' : 'التبديل إلى العربية');
    }
    const dictionary = translations[lang];
    Object.entries(dictionary).forEach(([selector, html]) => {
      const el = $(selector);
      if (el) el.innerHTML = html;
    });
    if (lang === 'en') {
      // Reloading is not needed; keep the original English markup as the source of truth.
      if (!originalEnglish) return;
      Object.entries(originalEnglish).forEach(([selector, html]) => {
        const el = $(selector);
        if (el) el.innerHTML = html;
      });
    }
    $$('[data-service]').forEach(button => {
      const key = button.dataset.service;
      const data = services[key]?.[lang];
      if (data) {
        $('h3', button).textContent = data[0];
        if (activeService === key) selectService(key, lang);
      }
    });
    $('.marquee-group').forEach(group => { group.innerHTML = lang === 'ar' ? '<span>الفكرة</span><b aria-hidden="true">→</b><span>الاستراتيجية</span><b aria-hidden="true">→</b><span>المحتوى</span><b aria-hidden="true">→</b><span>الإعلانات</span><b aria-hidden="true">→</b><span>النمو</span><i aria-hidden="true">✳</i>' : '<span>IDEA</span><b aria-hidden="true">→</b><span>STRATEGY</span><b aria-hidden="true">→</b><span>CONTENT</span><b aria-hidden="true">→</b><span>ADS</span><b aria-hidden="true">→</b><span>GROWTH</span><i aria-hidden="true">✳</i>'; });
    if (lang === 'ar') {
      const optionTexts = ['اختر خدمة', 'الاستراتيجية', 'بناء العلامة التجارية', 'التواصل الاجتماعي', 'الإعلانات والأداء', 'إنتاج المحتوى', 'موقع إلكتروني', 'أخرى'];
      const options = $$('#contact-form select option');
      options.forEach((option, index) => { if (optionTexts[index]) option.textContent = optionTexts[index]; });
    } else {
      const optionTexts = ['Choose a service', 'Strategy', 'Branding', 'Social media', 'Performance ads', 'Content production', 'Website', 'Other'];
      $$('#contact-form select option').forEach((option, index) => { if (optionTexts[index]) option.textContent = optionTexts[index]; });
    }
    try { localStorage.setItem('zero-one-language', lang); } catch (_) {}
  }

  // Save the original English strings for a lossless toggle back.
  const originalEnglish = {};
  Object.keys(translations.ar).forEach(selector => {
    const el = $(selector);
    if (el) originalEnglish[selector] = el.innerHTML;
  });
  $('.lang-toggle')?.addEventListener('click', () => setLanguage(root.lang === 'ar' ? 'en' : 'ar'), { signal });
  try {
    const savedLanguage = localStorage.getItem('zero-one-language');
    if (savedLanguage === 'ar') setLanguage('ar');
  } catch (_) {}

  // Accessible navigation: move focus into the menu, trap it, support Escape, restore focus.
  const menu = $('#menu-overlay');
  const menuToggle = $('.menu-toggle');
  const menuClose = $('.menu-close');
  let menuOpen = false;
  let previousFocus = null;
  const focusableInMenu = () => $$('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])', menu).filter(el => !el.hidden);
  function closeMenu() {
    if (!menuOpen || !menu) return;
    menuOpen = false;
    menu.setAttribute('aria-hidden', 'true');
    menu.inert = true;
    body.classList.remove('menu-open');
    menuToggle?.setAttribute('aria-expanded', 'false');
    if (window.gsap && !reducedMotion) {
      window.gsap.to(menu, { yPercent: -105, duration: 0.45, ease: 'power3.inOut', onComplete: () => { menu.style.visibility = 'hidden'; } });
    } else {
      menu.style.transform = 'translateY(-105%)';
      menu.style.visibility = 'hidden';
    }
    (previousFocus || menuToggle)?.focus();
  }
  function openMenu() {
    if (!menu || menuOpen) return;
    previousFocus = doc.activeElement;
    menuOpen = true;
    menu.inert = false;
    menu.setAttribute('aria-hidden', 'false');
    menu.style.visibility = 'visible';
    body.classList.add('menu-open');
    menuToggle?.setAttribute('aria-expanded', 'true');
    if (window.gsap && !reducedMotion) {
      window.gsap.to(menu, { yPercent: 0, duration: 0.55, ease: 'power4.out' });
    } else {
      menu.style.transform = 'translateY(0)';
    }
    requestAnimationFrame(() => focusableInMenu()[0]?.focus());
  }
  menuToggle?.addEventListener('click', openMenu, { signal });
  menuClose?.addEventListener('click', closeMenu, { signal });
  $$('.menu-links a').forEach(link => link.addEventListener('click', closeMenu, { signal }));
  doc.addEventListener('keydown', event => {
    if (!menuOpen) return;
    if (event.key === 'Escape') { event.preventDefault(); closeMenu(); return; }
    if (event.key !== 'Tab') return;
    const items = focusableInMenu();
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (event.shiftKey && doc.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && doc.activeElement === last) { event.preventDefault(); first.focus(); }
  }, { signal });

  // Form: client validation plus a real server endpoint; no success state without server confirmation.
  const form = $('#contact-form');
  const formStatus = $('#form-status');
  form?.addEventListener('submit', async event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const submitButton = $('.form-submit', form);
    const payload = Object.fromEntries(new FormData(form).entries());
    if (payload.website) return; // Honeypot.
    submitButton.disabled = true;
    formStatus.textContent = root.lang === 'ar' ? 'جارٍ إرسال طلبك…' : 'Sending your inquiry…';
    formStatus.dataset.state = 'pending';
    try {
      const response = await fetch(config.contact.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) throw new Error(result.error || 'Unable to send');
      form.reset();
      formStatus.textContent = root.lang === 'ar' ? 'وصل طلبك بنجاح. شكرًا لتواصلك معنا.' : 'Your inquiry has been sent. Thank you.';
      formStatus.dataset.state = 'success';
    } catch (error) {
      formStatus.textContent = root.lang === 'ar'
        ? 'تعذر الإرسال الآن. راسلنا على zeroone.creative.01@gmail.com أو واتساب.'
        : 'We could not send this right now. Email zeroone.creative.01@gmail.com or contact us on WhatsApp.';
      formStatus.dataset.state = 'error';
    } finally {
      submitButton.disabled = false;
    }
  }, { signal });

  // Motion is optional. All meaningful content remains visible without GSAP.
  const gsap = window.gsap;
  const ScrollTrigger = window.ScrollTrigger;
  if (!reducedMotion && gsap && ScrollTrigger) {
    gsap.registerPlugin(ScrollTrigger);
    const context = gsap.context(() => {
      gsap.from('.hero-title .mask-word', { yPercent: 110, opacity: 0, duration: 1.05, stagger: 0.08, ease: 'power4.out' });
      gsap.from('.hero-side-note, .hero-bottom, .scroll-cue', { y: 18, opacity: 0, duration: 0.7, stagger: 0.1, delay: 0.2, ease: 'power3.out' });
      $$('.reveal').forEach(el => {
        if (el.closest('.hero')) return;
        gsap.from(el, { y: 22, opacity: 0, duration: 0.8, ease: 'power3.out',
          scrollTrigger: { trigger: el, start: 'top 90%', once: true } });
      });
      gsap.to('.hero-zero', { y: 38, opacity: 0.22, scale: 0.86, ease: 'none',
        scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 1 } });
      gsap.to('.hero-one', { y: -25, scale: 1.06, ease: 'none',
        scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 1 } });
      gsap.to('.hero-graphic', { yPercent: -15, rotation: 8, ease: 'none',
        scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 1 } });
      $$('.project-card .project-visual').forEach(visual => {
        gsap.from(visual, { clipPath: 'inset(5% 5% 5% 5%)', duration: 0.9, ease: 'power3.out',
          scrollTrigger: { trigger: visual, start: 'top 88%', once: true } });
      });
      gsap.to('.contact-zero', { rotate: 180, ease: 'none',
        scrollTrigger: { trigger: '.contact', start: 'top bottom', end: 'top 25%', scrub: 1 } });
    }, doc);
    const refresh = () => ScrollTrigger.refresh();
    window.addEventListener('resize', refresh, { passive: true, signal });
    window.addEventListener('orientationchange', refresh, { passive: true, signal });
    if (doc.fonts?.ready) doc.fonts.ready.then(() => { if (!signal.aborted) ScrollTrigger.refresh(); });
    // A one-page static document has one lifecycle; abort listeners and revert GSAP on page teardown.
    window.addEventListener('pagehide', () => { aborter.abort(); context.revert(); ScrollTrigger.getAll().forEach(trigger => trigger.kill()); }, { once: true });
  } else {
    $$('.reveal, .hero-title .mask-word').forEach(el => { el.style.opacity = '1'; el.style.transform = 'none'; });
  }

  window.addEventListener('pagehide', () => aborter.abort(), { once: true });
})();