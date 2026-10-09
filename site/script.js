/* ZERO ONE — From 0 to 1. Vanilla JS + GSAP + ScrollTrigger + Lenis + SplitType. */
(() => {
  'use strict';

  const doc = document;
  const html = doc.documentElement;
  const body = doc.body;
  const config = window.ZERO_ONE_CONFIG || {};
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(pointer: fine)');
  const mobileQuery = window.matchMedia('(max-width: 700px)');
  const aborter = new AbortController();
  const { signal } = aborter;
  const $ = (selector, scope = doc) => scope.querySelector(selector);
  const $$ = (selector, scope = doc) => [...scope.querySelectorAll(selector)];
  const gsap = window.gsap;
  const ST = window.ScrollTrigger;
  const SplitType = window.SplitType;
  let lenis = null;
  let mm = null;
  let cursorFrame = 0;
  let progressFrame = 0;
  let canvasFrame = 0;
  let splitInstances = [];
  let menuOpen = false;
  let modalOpen = false;
  let previousFocus = null;
  let activeService = null;
  let activeCase = null;
  let originalMarkup = new Map();
  let refreshFrame = 0;

  const services = config.services || {};
  const caseStudies = Array.isArray(config.caseStudies) ? config.caseStudies.filter(item => item && item.title) : [];
  const stats = Array.isArray(config.stats) ? config.stats.filter(item => item && item.label && Number.isFinite(Number(item.value))) : [];
  const email = config.brand?.email || 'zeroone.creative.01@gmail.com';

  /* ---------- Progressive enhancement / loader ---------- */
  const preloader = $('.preloader');
  const curtain = $('.page-curtain');
  function runIntro() {
    let seen = true;
    try { seen = sessionStorage.getItem('zero-one-intro-seen') === '1'; } catch (_) {}
    if (!html.classList.contains('intro-pending') || seen || prefersReduced.matches || !gsap || !preloader) {
      html.classList.remove('intro-pending');
      preloader?.remove();
      if (curtain && gsap) gsap.set(curtain, { scaleY: 0, transformOrigin: 'top' });
      return;
    }
    const counter = $('.preloader-count');
    const zero = $('.loader-zero');
    const one = $('.loader-one');
    const timeline = gsap.timeline({
      defaults: { ease: 'power3.inOut' },
      onComplete: () => {
        html.classList.remove('intro-pending');
        try { sessionStorage.setItem('zero-one-intro-seen', '1'); } catch (_) {}
        preloader.remove();
        gsap.set(curtain, { scaleY: 1, transformOrigin: 'top' });
        gsap.to(curtain, { scaleY: 0, transformOrigin: 'bottom', duration: 0.48, ease: 'power4.inOut', onComplete: () => gsap.set(curtain, { clearProps: 'transform' }) });
      }
    });
    const count = { value: 0 };
    timeline.to(count, { value: 100, duration: 1.05, ease: 'power2.out', onUpdate: () => { if (counter) counter.textContent = String(Math.round(count.value)).padStart(2, '0'); } }, 0);
    timeline.to(zero, { scaleX: 0.035, opacity: 0, duration: 0.45, transformOrigin: 'center', ease: 'power3.inOut' }, 0.95);
    timeline.to(one, { scaleX: 1, opacity: 1, duration: 0.42, transformOrigin: 'center', ease: 'power3.inOut' }, 1.02);
    timeline.to(preloader, { yPercent: -100, duration: 0.45, ease: 'power4.inOut' }, 1.38);
    timeline.call(() => gsap.set(curtain, { scaleY: 1, transformOrigin: 'top' }), [], 1.38);
    timeline.duration(1.85);
  }
  runIntro();

  /* ---------- Utilities ---------- */
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const safeText = value => String(value == null ? '' : value);
  function addText(element, value) { if (element) element.textContent = safeText(value); }
  function setHidden(element, hidden) {
    if (!element) return;
    element.hidden = !!hidden;
    element.setAttribute('aria-hidden', String(!!hidden));
    if ('inert' in element) element.inert = !!hidden;
  }
  function escapeHTML(value) {
    return safeText(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  }

  /* ---------- Lenis: only one ticker, removed on teardown ---------- */
  if (!prefersReduced.matches && window.Lenis && gsap) {
    try {
      lenis = new window.Lenis({ lerp: 0.085, smoothWheel: true, wheelMultiplier: 0.9, touchMultiplier: 1.1 });
      const lenisTicker = time => lenis && lenis.raf(time * 1000);
      gsap.ticker.add(lenisTicker);
      gsap.ticker.lagSmoothing(0);
      if (ST) lenis.on('scroll', ST.update);
      window.addEventListener('pagehide', () => {
        gsap.ticker.remove(lenisTicker);
        lenis?.destroy();
        lenis = null;
      }, { once: true });
    } catch (_) { lenis = null; }
  }

  /* ---------- Config-driven stats: empty means hidden ---------- */
  const statsHost = $('#verified-stats');
  if (statsHost) {
    statsHost.replaceChildren();
    if (stats.length) {
      statsHost.hidden = false;
      stats.forEach(item => {
        const block = doc.createElement('div'); block.className = 'stat';
        const number = doc.createElement('strong'); number.dataset.statValue = String(Number(item.value)); number.dataset.statPrefix = safeText(item.prefix || ''); number.dataset.statSuffix = safeText(item.suffix || ''); number.textContent = number.dataset.statPrefix + '0' + number.dataset.statSuffix;
        const label = doc.createElement('span'); label.textContent = safeText(item.label);
        block.append(number, label); statsHost.append(block);
      });
    } else statsHost.hidden = true;
  }

  /* ---------- Case studies: only approved config entries render ---------- */
  const workSection = $('#work');
  const workTrack = $('#work-track');
  const workLink = $('[data-work-link]');
  const workCounter = $('.work-counter');
  const workProgress = $('.work-progress-line i');
  const caseModal = $('#case-modal');
  const caseMedia = $('.case-modal-media');
  const caseTitle = $('#case-title');
  const caseCategory = $('.case-modal-category');
  const caseSummary = $('.case-modal-summary');
  const caseDetails = $('.case-modal-details');
  const caseClose = $('.case-modal-close');
  const processCards = $$('.process-card');

  function renderCaseStudies() {
    if (!workSection || !workTrack) return;
    workTrack.replaceChildren();
    if (!caseStudies.length) {
      workSection.hidden = true;
      workLink?.setAttribute('hidden', '');
      return;
    }
    workSection.hidden = false;
    workLink?.removeAttribute('hidden');
    workCounter && (workCounter.textContent = '01 / ' + String(caseStudies.length).padStart(2, '0'));
    caseStudies.forEach((item, index) => {
      const button = doc.createElement('button');
      button.type = 'button';
      button.className = 'project-card';
      button.dataset.caseIndex = String(index);
      button.setAttribute('aria-label', 'View case study: ' + item.title);
      button.dataset.cursor = 'VIEW';
      const visual = doc.createElement('span'); visual.className = 'project-visual';
      const imageUrl = item.image || item.poster || '';
      if (imageUrl) {
        const image = doc.createElement('img');
        image.src = imageUrl;
        image.alt = item.imageAlt || item.title;
        image.loading = 'lazy';
        image.decoding = 'async';
        image.sizes = '(max-width: 700px) 82vw, 62vw';
        visual.append(image);
      } else {
        visual.classList.add('project-visual-empty');
        const mark = doc.createElement('span'); mark.className = 'project-empty-mark'; mark.textContent = '0/1';
        visual.append(mark);
      }
      const indexLabel = doc.createElement('span'); indexLabel.className = 'project-index'; indexLabel.textContent = String(index + 1).padStart(2, '0') + ' / ' + String(caseStudies.length).padStart(2, '0');
      const open = doc.createElement('span'); open.className = 'project-open'; open.setAttribute('aria-hidden', 'true'); open.textContent = '↗';
      visual.append(indexLabel, open);
      const meta = doc.createElement('span'); meta.className = 'project-meta';
      const titleBlock = doc.createElement('span');
      const category = doc.createElement('span'); category.className = 'project-category'; category.textContent = safeText(item.category || 'CASE STUDY');
      const title = doc.createElement('span'); title.className = 'project-title'; title.textContent = item.title;
      titleBlock.append(category, title);
      const year = doc.createElement('span'); year.className = 'project-year'; year.textContent = safeText(item.year || '');
      meta.append(titleBlock, year);
      const summary = doc.createElement('span'); summary.className = 'project-summary'; summary.textContent = safeText(item.summary || '');
      button.append(visual, meta, summary);
      workTrack.append(button);
    });
  }
  renderCaseStudies();

  function openCase(index, trigger) {
    const item = caseStudies[index];
    if (!item || !caseModal) return;
    activeCase = item;
    previousFocus = trigger || doc.activeElement;
    body.classList.add('modal-open');
    caseModal.hidden = false; caseModal.inert = false; caseModal.setAttribute('aria-hidden', 'false');
    caseMedia.replaceChildren();
    const source = item.image || item.poster || '';
    if (item.video) {
      const video = doc.createElement('video'); video.src = item.video; video.controls = true; video.playsInline = true; video.preload = 'metadata';
      if (source) video.poster = source;
      caseMedia.append(video);
    } else if (source) {
      const image = doc.createElement('img'); image.src = source; image.alt = item.imageAlt || item.title; image.loading = 'eager'; image.decoding = 'async'; caseMedia.append(image);
    } else {
      const mark = doc.createElement('span'); mark.className = 'project-empty-mark'; mark.textContent = '0/1'; caseMedia.append(mark);
    }
    addText(caseTitle, item.title);
    addText(caseCategory, [item.category, item.client, item.year].filter(Boolean).join(' / '));
    addText(caseSummary, item.summary || '');
    caseDetails.replaceChildren();
    [['CHALLENGE', item.challenge], ['APPROACH', item.approach], ['OUTCOME', item.outcome]].forEach(([label, value]) => {
      if (!value) return;
      const section = doc.createElement('section'); section.className = 'case-detail-item';
      const heading = doc.createElement('h3'); heading.textContent = label;
      const paragraph = doc.createElement('p'); paragraph.textContent = value;
      section.append(heading, paragraph); caseDetails.append(section);
    });
    if (gsap && !prefersReduced.matches) {
      gsap.set(caseModal, { autoAlpha: 1 });
      gsap.fromTo(caseModal, { yPercent: 8, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.65, ease: 'power4.inOut' });
      gsap.fromTo(caseMedia, { scale: 0.96, opacity: 0.6 }, { scale: 1, opacity: 1, duration: 0.7, ease: 'power3.out', delay: 0.12 });
    }
    modalOpen = true;
    caseClose?.focus();
  }
  function closeCase() {
    if (!modalOpen || !caseModal) return;
    modalOpen = false; body.classList.remove('modal-open');
    const finish = () => { caseModal.hidden = true; caseModal.inert = true; caseModal.setAttribute('aria-hidden', 'true'); (previousFocus || workLink)?.focus?.(); };
    if (gsap && !prefersReduced.matches) gsap.to(caseModal, { yPercent: -4, opacity: 0, duration: 0.35, ease: 'power3.inOut', onComplete: finish });
    else finish();
  }
  workTrack?.addEventListener('click', event => {
    const card = event.target.closest('[data-case-index]');
    if (card) openCase(Number(card.dataset.caseIndex), card);
  }, { signal });
  caseClose?.addEventListener('click', closeCase, { signal });

  /* ---------- Service detail + optional image previews ---------- */
  const servicePanel = $('#service-detail');
  const serviceTitle = $('.detail-title', servicePanel || doc);
  const serviceKicker = $('.detail-kicker', servicePanel || doc);
  const serviceCopy = $('.detail-copy', servicePanel || doc);
  const servicePreview = $('.service-preview');
  const servicePreviewImage = $('.service-preview-image');
  const serviceRows = $$('[data-service]');

  function selectService(key) {
    const item = services[key];
    if (!item || !servicePanel) return;
    const language = html.lang === 'ar' ? 'ar' : 'en';
    addText(serviceTitle, item.title?.[language] || item.title?.en || key);
    addText(serviceKicker, item.kicker?.[language] || item.kicker?.en || 'SERVICE');
    addText(serviceCopy, item.description?.[language] || item.description?.en || '');
    servicePanel.hidden = false;
    serviceRows.forEach(row => {
      const selected = row.dataset.service === key;
      row.setAttribute('aria-expanded', String(selected));
      row.classList.toggle('is-selected', selected);
    });
    activeService = key;
    const previewSrc = config.servicePreviews?.[key] || '';
    if (servicePreview && servicePreviewImage) {
      if (previewSrc && !mobileQuery.matches && finePointer.matches) {
        servicePreviewImage.src = previewSrc;
        servicePreview.classList.add('has-image');
      } else {
        servicePreviewImage.removeAttribute('src');
        servicePreview.classList.remove('has-image');
        servicePreview.style.opacity = '0';
      }
    }
  }
  function closeService() {
    if (!servicePanel) return;
    servicePanel.hidden = true; activeService = null;
    serviceRows.forEach(row => { row.setAttribute('aria-expanded', 'false'); row.classList.remove('is-selected'); });
    serviceRows.find(row => row.dataset.service === activeService)?.focus();
  }
  serviceRows.forEach(row => {
    row.addEventListener('click', () => {
      if (activeService === row.dataset.service && servicePanel && !servicePanel.hidden) {
        servicePanel.hidden = true; activeService = null;
        serviceRows.forEach(button => { button.setAttribute('aria-expanded', 'false'); button.classList.remove('is-selected'); });
      } else selectService(row.dataset.service);
    }, { signal });
    row.addEventListener('pointerenter', () => {
      if (!servicePreview || !servicePreviewImage || mobileQuery.matches || !finePointer.matches) return;
      const src = config.servicePreviews?.[row.dataset.service] || '';
      if (!src) return;
      servicePreviewImage.src = src;
      servicePreview.classList.add('has-image');
      if (gsap) gsap.to(servicePreview, { opacity: 1, scale: 1, duration: 0.3, ease: 'power2.out', overwrite: true });
    }, { signal });
    row.addEventListener('pointerleave', () => {
      if (servicePreview && gsap) gsap.to(servicePreview, { opacity: 0, scale: 0.94, duration: 0.25, overwrite: true });
    }, { signal });
  });
  $('.detail-close')?.addEventListener('click', () => {
    const key = activeService;
    servicePanel.hidden = true; activeService = null;
    serviceRows.forEach(row => { row.setAttribute('aria-expanded', 'false'); row.classList.remove('is-selected'); });
    serviceRows.find(row => row.dataset.service === key)?.focus();
  }, { signal });
  if (servicePreview && finePointer.matches && !mobileQuery.matches) {
    let previewX = 0, previewY = 0;
    const movePreview = event => {
      previewX = event.clientX + 28; previewY = event.clientY + 24;
      if (gsap) gsap.to(servicePreview, { x: previewX, y: previewY, duration: 0.45, ease: 'power3.out', overwrite: 'auto' });
      else servicePreview.style.transform = 'translate3d(' + previewX + 'px,' + previewY + 'px,0)';
    };
    doc.addEventListener('pointermove', movePreview, { passive: true, signal });
  }

  /* ---------- SplitType: line reveals, per-character hero, word highlight ---------- */
  const splitSelectors = ['#hero-title', '.services-heading h2', '.work-intro h2', '.process-heading h2', '.contact-title'];
  function revertSplits() {
    splitInstances.forEach(instance => { try { instance.revert(); } catch (_) {} });
    splitInstances = [];
  }
  function splitText() {
    revertSplits();
    if (!SplitType) return;
    splitSelectors.forEach(selector => {
      const el = $(selector);
      if (!el || el.hidden) return;
      try { splitInstances.push(new SplitType(el, { types: 'lines,words,chars', tagName: 'span' })); } catch (_) {}
    });
    const statement = $('[data-highlight-words]');
    if (statement) {
      statement.dataset.splitDone = '';
      const words = statement.textContent.trim().split(/\s+/);
      statement.textContent = '';
      words.forEach((word, index) => {
        const span = doc.createElement('span'); span.className = 'highlight-word'; span.textContent = word;
        statement.append(span);
        if (index < words.length - 1) statement.append(doc.createTextNode(' '));
      });
      statement.dataset.splitDone = 'true';
    }
  }
  /* ---------- Bilingual toggle with RTL and exact restoration ---------- */
  const translationTargets = {
    '.header-note': { ar: 'شريك إبداعي مستقل<br>للمرحلة القادمة.' },
    '.menu-toggle-label': { ar: 'القائمة' },
    '.menu-top > span': { ar: 'ZERO ONE / القائمة' },
    '.menu-links a:nth-child(1) .menu-link-label': { ar: 'من نحن' },
    '.menu-links a:nth-child(2) .menu-link-label': { ar: 'خدماتنا' },
    '.menu-links a:nth-child(3) .menu-link-label': { ar: 'أعمال مختارة' },
    '.menu-links a:nth-child(4) .menu-link-label': { ar: 'منهجيتنا' },
    '.menu-links a:nth-child(5) .menu-link-label': { ar: 'ابدأ مشروعك' },
    '.hero-topline > span:first-child': { ar: 'تفكير إبداعي. أثر تجاري.' },
    '.hero-side-note p': { ar: 'نحوّل الأفكار الواضحة<br>إلى علامات تتحرك للأمام.' },
    '.hero-bottom > p': { ar: 'استراتيجية. هوية. محتوى. نمو.<br>فريق واحد يرافقك من أول فكرة.' },
    '.hero-bottom .text-link': { ar: 'استكشف خدماتنا <span aria-hidden="true">↘</span>' },
    '.about .section-kicker span:first-child': { ar: '01 / ما نؤمن به' },
    '.about .section-kicker span:last-child': { ar: 'بلا اختصارات. بلا ضجيج.' },
    '.about-copy p': { ar: 'كل شيء كبير يبدأ كـ <span>فكرة</span>. نمنحها <span>اتجاهًا</span>، ونبني علامة يتذكرها الناس، ونصنع زخمًا يحوّل الاهتمام إلى <span>فعل</span>. لا تخمين ولا وصفات مستعارة؛ فقط خطوات مدروسة.' },
    '.aside-copy': { ar: 'لا نجمّل العلامات. <span>نبدأها.</span>' },
    '.services .section-kicker span:first-child': { ar: '02 / ماذا نقدم' },
    '.services .section-kicker span:last-child': { ar: 'فكّر أولًا. اصنع أثرًا.' },
    '.services-heading h2': { ar: 'اجعل كل<br>خطوة <span class="orange">مؤثرة.</span>' },
    '.services-heading p': { ar: 'من الفكرة الأولى إلى النتيجة، نبني ما يدفع نشاطك إلى الأمام.' },
    '.service-row:nth-child(1) .service-desc': { ar: 'تموضع / بحث / اتجاه' },
    '.service-row:nth-child(2) .service-desc': { ar: 'هوية / صوت / إرشادات' },
    '.service-row:nth-child(3) .service-desc': { ar: 'أنظمة محتوى / مجتمع' },
    '.service-row:nth-child(4) .service-desc': { ar: 'إعلانات / اختبارات / نمو' },
    '.service-row:nth-child(5) .service-desc': { ar: 'إخراج فني / فيديو / موشن' },
    '.process .section-kicker span:first-child': { ar: '04 / كيف نتحرك' },
    '.process .section-kicker span:last-child': { ar: 'وضوح في كل خطوة.' },
    '.process-heading h2': { ar: 'طريق واضح.<br><span class="orange">زخم حقيقي.</span>' },
    '.process-heading p': { ar: 'العمل الجيد ليس لغزًا. نوضح الطريق، ونتخذ قرارات مدروسة، ونحدد الخطوة التالية.' },
    '.process-card:nth-child(1) h3': { ar: 'اكتشف الإشارة.' },
    '.process-card:nth-child(1) p': { ar: 'نطرح الأسئلة الصحيحة، ونراجع الافتراضات، ونحدد المشكلة التي تستحق الحل.' },
    '.process-card:nth-child(2) h3': { ar: 'اختر الخطوة.' },
    '.process-card:nth-child(2) p': { ar: 'نحوّل الفهم إلى تموضع واضح وفكرة واثقة وخطة يستطيع الجميع اتباعها.' },
    '.process-card:nth-child(3) h3': { ar: 'حوّلها إلى واقع.' },
    '.process-card:nth-child(3) p': { ar: 'هوية ومحتوى وحملات وتجارب تعمل معًا بدلًا من التنافس على الانتباه.' },
    '.process-card:nth-child(4) h3': { ar: 'واصل التقدم.' },
    '.process-card:nth-child(4) p': { ar: 'نتابع ما يهم، ونتعلم بسرعة، ونستخدم البيانات الحقيقية لاكتشاف الفرصة التالية.' },
    '.contact .section-kicker span:first-child': { ar: '05 / خطوتك التالية' },
    '.contact .section-kicker span:last-child': { ar: 'الخطوة الجيدة التالية تبدأ هنا.' },
    '.contact-title': { ar: 'لنبدأ<br>من <span class="contact-zero">0</span><span class="contact-period">.</span>' },
    '.contact-side': { ar: 'لديك فكرة كبيرة؟<br>لنمنحها اتجاهًا.' },
    '.form-heading h3': { ar: 'أخبرنا عمّا تعمل عليه.' },
    '.form-heading p': { ar: 'شاركنا بعض التفاصيل وسنرد عليك عبر البريد الإلكتروني.' },
    '.form-submit': { ar: 'إرسال طلب المشروع <span aria-hidden="true">↗</span>' },
    '.contact-orb > span': { ar: 'لنتحدث<br><b aria-hidden="true">↗</b>' },
    '.footer-note': { ar: 'من 0 إلى 1.<br>وكل خطوة بعدها.' },
    '.back-top': { ar: 'العودة للأعلى <span aria-hidden="true">↑</span>' },
    '.footer-statement': { ar: '<span>لنبدأ</span><span>من <i>0</i><b>.</b></span>' },
    '.whatsapp-float b': { ar: 'واتساب' }
  };
  Object.keys(translationTargets).forEach(selector => {
    const element = $(selector);
    if (element) originalMarkup.set(selector, element.innerHTML);
  });
  $$('.contact-form .field-label').forEach((el, index) => originalMarkup.set('field-' + index, el.innerHTML));
  const select = $('#contact-form select');
  const originalOptions = select ? [...select.options].map(option => option.textContent) : [];
  function setLanguage(language) {
    revertSplits();
    const lang = language === 'ar' ? 'ar' : 'en';
    html.lang = lang; html.dir = lang === 'ar' ? 'rtl' : 'ltr';
    const toggle = $('.lang-toggle');
    if (toggle) {
      toggle.textContent = lang === 'ar' ? 'EN' : 'AR';
      toggle.setAttribute('aria-pressed', String(lang === 'ar'));
      toggle.setAttribute('aria-label', lang === 'ar' ? 'Switch language to English' : 'التبديل إلى العربية');
    }
    Object.entries(translationTargets).forEach(([selector, translations]) => {
      const element = $(selector);
      if (!element) return;
      element.innerHTML = lang === 'ar' ? (translations.ar || originalMarkup.get(selector) || element.innerHTML) : (originalMarkup.get(selector) || element.innerHTML);
    });
    const fieldLabels = lang === 'ar' ? ['الاسم', 'البريد الإلكتروني', 'الشركة / العلامة <span class="optional">(اختياري)</span>', 'ما الخدمة التي تحتاجها؟', 'تفاصيل المشروع'] : null;
    $$('.contact-form .field-label').forEach((el, index) => {
      const original = originalMarkup.get('field-' + index);
      el.innerHTML = lang === 'ar' ? (fieldLabels[index] || original) : original;
    });
    if (select) {
      const arOptions = ['اختر خدمة', 'الاستراتيجية', 'بناء العلامة التجارية', 'التواصل الاجتماعي', 'إعلانات الأداء', 'إنتاج المحتوى', 'موقع إلكتروني', 'أخرى'];
      [...select.options].forEach((option, index) => { option.textContent = lang === 'ar' ? (arOptions[index] || originalOptions[index]) : originalOptions[index]; });
    }
    const marqueeGroups = $$('.marquee-group');
    marqueeGroups.forEach(group => {
      group.innerHTML = lang === 'ar'
        ? '<span>الفكرة</span><b aria-hidden="true">→</b><span>الاستراتيجية</span><b aria-hidden="true">→</b><span>المحتوى</span><b aria-hidden="true">→</b><span>الإعلانات</span><b aria-hidden="true">→</b><span>النمو</span><i aria-hidden="true">✳</i>'
        : '<span>IDEA</span><b aria-hidden="true">→</b><span>STRATEGY</span><b aria-hidden="true">→</b><span>CONTENT</span><b aria-hidden="true">→</b><span>ADS</span><b aria-hidden="true">→</b><span>GROWTH</span><i aria-hidden="true">✳</i>';
    });
    serviceRows.forEach(row => {
      const item = services[row.dataset.service];
      if (item) addText($('h3', row), item.title?.[lang] || item.title?.en);
    });
    if (activeService) selectService(activeService);
    const highlightStatement = $('[data-highlight-words]');
    if (highlightStatement) highlightStatement.dataset.splitDone = '';
    try { localStorage.setItem('zero-one-language', lang); } catch (_) {}
    $('[data-roll]').forEach(element => { element.dataset.rollReady = ''; });
    initTextRoll();
    splitText();
    if (ST) requestAnimationFrame(() => ST.refresh());
  }
  $('.lang-toggle')?.addEventListener('click', () => setLanguage(html.lang === 'ar' ? 'en' : 'ar'), { signal });
  try { if (localStorage.getItem('zero-one-language') === 'ar') setLanguage('ar'); } catch (_) {}
  if (!splitInstances.length) splitText();

  /* ---------- Menu: stagger, focus trap, Escape, restore focus ---------- */
  const menu = $('#menu-overlay');
  const menuToggle = $('.menu-toggle');
  const menuClose = $('.menu-close');
  const menuLinks = $$('.menu-links a');
  const menuFocusables = () => $$('a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"])', menu).filter(el => !el.hidden);
  function openMenu() {
    if (!menu || menuOpen) return;
    previousFocus = doc.activeElement; menuOpen = true;
    menu.inert = false; menu.setAttribute('aria-hidden', 'false'); menu.style.visibility = 'visible';
    body.classList.add('menu-open'); menuToggle?.setAttribute('aria-expanded', 'true');
    if (gsap && !prefersReduced.matches) {
      gsap.to(menu, { yPercent: 0, duration: 0.58, ease: 'power4.out', overwrite: true });
      gsap.fromTo(menuLinks.filter(link => !link.hidden), { yPercent: 35, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.62, stagger: 0.065, delay: 0.08, ease: 'power4.out', clearProps: 'transform' });
    } else menu.style.transform = 'translateY(0)';
    requestAnimationFrame(() => menuFocusables()[0]?.focus());
  }
  function closeMenu(options = {}) {
    if (!menu || !menuOpen) return;
    menuOpen = false; body.classList.remove('menu-open');
    menuToggle?.setAttribute('aria-expanded', 'false');
    const finish = () => { menu.inert = true; menu.setAttribute('aria-hidden', 'true'); menu.style.visibility = 'hidden'; };
    if (!options.immediate && gsap && !prefersReduced.matches) gsap.to(menu, { yPercent: -102, duration: 0.38, ease: 'power3.inOut', onComplete: finish, overwrite: true });
    else { menu.style.transform = 'translateY(-102%)'; finish(); }
    if (options.restore !== false) (previousFocus || menuToggle)?.focus?.();
  }
  menuToggle?.addEventListener('click', openMenu, { signal });
  menuClose?.addEventListener('click', () => closeMenu(), { signal });
  menuLinks.forEach(link => link.addEventListener('click', () => closeMenu({ immediate: true, restore: false }), { signal }));

  /* ---------- Curtain navigation ---------- */
  function navigateToHash(hash, push = true) {
    const target = $(hash);
    if (!target) return;
    if (menuOpen) closeMenu({ immediate: true, restore: false });
    if (push && location.hash !== hash) history.pushState(null, '', hash);
    const move = () => {
      if (lenis) lenis.scrollTo(target, { duration: prefersReduced.matches ? 0 : 0.8, offset: 0 });
      else target.scrollIntoView({ behavior: prefersReduced.matches ? 'auto' : 'smooth', block: 'start' });
    };
    if (gsap && curtain && !prefersReduced.matches) {
      gsap.killTweensOf(curtain);
      gsap.set(curtain, { scaleY: 0, transformOrigin: 'bottom' });
      gsap.to(curtain, { scaleY: 1, duration: 0.34, ease: 'power3.inOut', onComplete: () => {
        move();
        gsap.fromTo(curtain, { scaleY: 1, transformOrigin: 'top' }, { scaleY: 0, duration: 0.5, ease: 'power4.inOut', delay: 0.06, onComplete: () => gsap.set(curtain, { clearProps: 'transform' }) });
      }});
    } else move();
  }
  doc.addEventListener('click', event => {
    const anchor = event.target.closest('a[href^="#"]');
    if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('data-no-transition')) return;
    const hash = anchor.getAttribute('href');
    if (!hash || hash === '#') return;
    if (!$(hash)) return;
    event.preventDefault();
    navigateToHash(hash, true);
  }, { signal });

  /* ---------- Keyboard state ---------- */
  window.addEventListener('popstate', () => {
    const hash = location.hash && $(location.hash) ? location.hash : '#top';
    navigateToHash(hash, false);
  }, { signal });
  doc.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      if (modalOpen) { event.preventDefault(); closeCase(); return; }
      if (menuOpen) { event.preventDefault(); closeMenu(); return; }
      if (activeService && servicePanel && !servicePanel.hidden) {
        const key = activeService; servicePanel.hidden = true; activeService = null;
        serviceRows.forEach(row => { row.setAttribute('aria-expanded', 'false'); row.classList.remove('is-selected'); });
        serviceRows.find(row => row.dataset.service === key)?.focus();
      }
    }
    if (menuOpen && event.key === 'Tab') {
      const items = menuFocusables(); if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && doc.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && doc.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    if (modalOpen && event.key === 'Tab') {
      const items = $$('button:not([disabled]),a[href],video[controls]', caseModal).filter(el => !el.hidden);
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && doc.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && doc.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  }, { signal });

  /* ---------- Copy email with feedback ---------- */
  const toast = $('#copy-toast');
  let toastTween = null;
  async function copyEmail(value) {
    try {
      if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(value);
      else {
        const input = doc.createElement('textarea'); input.value = value; input.style.position = 'fixed'; input.style.opacity = '0'; body.append(input); input.select();
        const ok = doc.execCommand('copy'); input.remove(); if (!ok) throw new Error('Clipboard unavailable');
      }
      if (toast) {
        toast.hidden = false; toast.textContent = html.lang === 'ar' ? 'تم نسخ البريد الإلكتروني' : 'EMAIL COPIED';
        if (gsap && !prefersReduced.matches) {
          toastTween?.kill();
          toastTween = gsap.timeline().fromTo(toast, { y: 12, opacity: 0 }, { y: 0, opacity: 1, duration: 0.25, ease: 'power2.out' }).to(toast, { opacity: 0, y: 8, duration: 0.25, delay: 1.5, onComplete: () => { toast.hidden = true; } });
        } else { toast.hidden = false; toast.dataset.visible = 'true'; }
      }
    } catch (_) {
      if (toast) { toast.hidden = false; toast.textContent = html.lang === 'ar' ? 'انسخ البريد: ' + value : 'Copy email: ' + value; }
    }
  }
  $$('[data-copy-email]').forEach(button => button.addEventListener('click', () => copyEmail(button.dataset.copyEmail || email), { signal }));

  /* ---------- Contact form: success only after server success ---------- */
  const form = $('#contact-form');
  const formStatus = $('#form-status');
  form?.addEventListener('submit', async event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const submit = $('.form-submit', form);
    const payload = Object.fromEntries(new FormData(form).entries());
    if (payload.website) return;
    submit.disabled = true;
    addText(formStatus, html.lang === 'ar' ? 'جارٍ إرسال طلبك…' : 'Sending your inquiry…');
    if (formStatus) formStatus.dataset.state = 'pending';
    try {
      const response = await fetch(config.contact?.endpoint || '/api/contact', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify(payload)
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) throw new Error(result.error || 'Send failed');
      form.reset();
      addText(formStatus, html.lang === 'ar' ? 'وصل طلبك بنجاح. شكرًا لتواصلك معنا.' : 'Your inquiry has been sent. Thank you.');
      if (formStatus) formStatus.dataset.state = 'success';
    } catch (_) {
      addText(formStatus, html.lang === 'ar' ? 'تعذر الإرسال الآن. راسلنا عبر البريد أو واتساب.' : 'We could not send this right now. Email us or contact us on WhatsApp.');
      if (formStatus) formStatus.dataset.state = 'error';
    } finally { submit.disabled = false; }
  }, { signal });

  /* ---------- Magnetic interaction and rolling text ---------- */
  function initTextRoll() {
    $$('[data-roll]').forEach(element => {
      if (element.dataset.rollReady) return;
      element.dataset.rollReady = 'true';
      [...element.childNodes].forEach(node => {
        if (node.nodeType !== Node.TEXT_NODE || !node.textContent.trim()) return;
        const label = doc.createElement('span'); label.className = 'roll-inner';
        const first = doc.createElement('span'); first.className = 'roll-copy'; first.textContent = node.textContent;
        const second = doc.createElement('span'); second.className = 'roll-copy roll-copy-alt'; second.textContent = node.textContent.trim(); second.setAttribute('aria-hidden', 'true');
        label.append(first, second); node.replaceWith(label);
      });
    });
  }
  initTextRoll();
  const magneticItems = $$('.magnetic,[data-magnetic]');
  if (finePointer.matches && !prefersReduced.matches && gsap) {
    magneticItems.forEach(element => {
      let bounds = null;
      element.addEventListener('pointerenter', () => { bounds = element.getBoundingClientRect(); }, { signal });
      element.addEventListener('pointermove', event => {
        bounds = element.getBoundingClientRect();
        const dx = event.clientX - (bounds.left + bounds.width / 2);
        const dy = event.clientY - (bounds.top + bounds.height / 2);
        gsap.to(element, { x: clamp(dx * 0.16, -12, 12), y: clamp(dy * 0.16, -9, 9), duration: 0.35, ease: 'power3.out', overwrite: 'auto' });
      }, { signal });
      element.addEventListener('pointerleave', () => gsap.to(element, { x: 0, y: 0, duration: 0.55, ease: 'elastic.out(1,0.45)', overwrite: 'auto' }), { signal });
    });
  }

  /* ---------- Custom cursor: desktop fine-pointer only ---------- */
  const cursorDot = $('.cursor-dot');
  const cursorRing = $('.cursor-ring');
  const cursorLabel = $('.cursor-ring span');
  if (cursorDot && cursorRing && finePointer.matches && !mobileQuery.matches && !prefersReduced.matches) {
    html.classList.add('has-custom-cursor');
    let mx = innerWidth / 2, my = innerHeight / 2, rx = mx, ry = my;
    gsap?.set([cursorDot, cursorRing], { opacity: 1 });
    const pointerMove = event => { mx = event.clientX; my = event.clientY; };
    const drawCursor = () => {
      rx += (mx - rx) * 0.18; ry += (my - ry) * 0.18;
      cursorDot.style.transform = 'translate3d(' + mx + 'px,' + my + 'px,0) translate(-50%,-50%)';
      cursorRing.style.transform = 'translate3d(' + rx + 'px,' + ry + 'px,0) translate(-50%,-50%)';
      cursorFrame = requestAnimationFrame(drawCursor);
    };
    doc.addEventListener('pointermove', pointerMove, { passive: true, signal });
    doc.addEventListener('pointerover', event => {
      const target = event.target.closest('[data-cursor],.project-card,.work-track,[data-magnetic],button,a');
      if (!target) return;
      const label = target.dataset.cursor || (target.classList.contains('project-card') ? 'VIEW' : target.classList.contains('work-track') ? 'DRAG' : target.matches('[data-magnetic],button,a') ? 'GO' : 'MOVE');
      if (cursorLabel) cursorLabel.textContent = label;
      cursorRing.classList.toggle('is-active', label !== 'MOVE');
    }, { signal });
    doc.addEventListener('pointerout', event => {
      if (event.relatedTarget && event.relatedTarget.closest('[data-cursor],.project-card,.work-track,[data-magnetic],button,a')) return;
      cursorRing.classList.remove('is-active'); if (cursorLabel) cursorLabel.textContent = 'MOVE';
    }, { signal });
    canvasFrame = requestAnimationFrame(drawCursor);
    window.addEventListener('pointerdown', () => cursorRing.classList.add('is-active'), { signal });
    window.addEventListener('pointerup', () => cursorRing.classList.remove('is-active'), { signal });
  }

  /* ---------- Hero particle zero morphing into one ---------- */
  const canvas = $('#zero-canvas');
  const hero = $('.hero');
  let particleState = { morph: 0 };
  let particles = [];
  let pointer = { x: 0, y: 0, active: false };
  let canvasSize = { width: 0, height: 0, dpr: 1 };
  let canvasVisible = true;
  function seedParticles() {
    const count = mobileQuery.matches ? 88 : 260;
    particles = Array.from({ length: count }, (_, index) => {
      const angle = (index / count) * Math.PI * 2;
      const jitter = (Math.random() - 0.5) * 0.035;
      const t = angle + jitter;
      return {
        aX: Math.cos(t) * 0.38,
        aY: Math.sin(t) * 0.44,
        lineY: (index / (count - 1)) * 0.82 - 0.41,
        size: 0.6 + Math.random() * (mobileQuery.matches ? 0.7 : 1.2),
        phase: Math.random() * Math.PI * 2
      };
    });
  }
  function resizeCanvas() {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    canvasSize.width = Math.max(1, rect.width);
    canvasSize.height = Math.max(1, rect.height);
    canvasSize.dpr = Math.min(window.devicePixelRatio || 1, mobileQuery.matches ? 1 : 1.5);
    canvas.width = Math.round(canvasSize.width * canvasSize.dpr);
    canvas.height = Math.round(canvasSize.height * canvasSize.dpr);
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.setTransform(canvasSize.dpr, 0, 0, canvasSize.dpr, 0, 0);
    seedParticles();
  }
  function drawZero() {
    if (!canvas || !canvasSize.width) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const width = canvasSize.width, height = canvasSize.height;
    ctx.clearRect(0, 0, width, height);
    const centerX = width * 0.5, centerY = height * 0.5;
    const scale = 1 - particleState.morph * 0.55;
    const spread = 1 - particleState.morph;
    for (const particle of particles) {
      const baseX = centerX + (particle.aX * width * spread);
      const baseY = centerY + (particle.aY * height * spread) + particle.lineY * height * particleState.morph;
      let x = baseX, y = baseY;
      if (pointer.active && !mobileQuery.matches) {
        const dx = x - pointer.x, dy = y - pointer.y;
        const distance = Math.max(1, Math.hypot(dx, dy));
        const force = Math.max(0, 1 - distance / 130) * 15;
        x += (dx / distance) * force;
        y += (dy / distance) * force;
      }
      const twinkle = 0.72 + Math.sin(performance.now() * 0.0015 + particle.phase) * 0.2;
      ctx.globalAlpha = twinkle * (0.45 + particle.size * 0.3);
      ctx.fillStyle = '#FF5A1F';
      ctx.beginPath();
      ctx.arc(x, y, particle.size * scale, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    canvasFrame = requestAnimationFrame(drawZero);
  }
  if (canvas && !prefersReduced.matches) {
    resizeCanvas();
    doc.addEventListener('pointermove', event => {
      const rect = canvas.getBoundingClientRect();
      const inside = event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
      pointer.active = inside && !mobileQuery.matches;
      if (pointer.active) { pointer.x = event.clientX - rect.left; pointer.y = event.clientY - rect.top; }
    }, { passive: true, signal });
    hero?.addEventListener('pointerleave', () => { pointer.active = false; }, { signal });
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(entries => {
        canvasVisible = entries[0]?.isIntersecting ?? true;
        if (canvasVisible && !canvasFrame) canvasFrame = requestAnimationFrame(drawZero);
        else if (!canvasVisible && canvasFrame) { cancelAnimationFrame(canvasFrame); canvasFrame = 0; }
      }, { threshold: 0 });
      observer.observe(canvas);
      window.addEventListener('pagehide', () => observer.disconnect(), { once: true });
    }
    canvasFrame = requestAnimationFrame(drawZero);
  } else if (canvas) canvas.hidden = true;

  /* ---------- Scroll effects: only transform/opacity, contexts revert on breakpoints ---------- */
  const marqueeTrack = $('.marquee-track');
  let marqueeSkewTween = null;
  let marqueeSkewTo = null;
  function setupMotion() {
    if (!gsap || !ST || prefersReduced.matches) {
      $$('.reveal').forEach(el => { el.style.opacity = '1'; el.style.transform = 'none'; });
      return;
    }
    gsap.registerPlugin(ST);
    mm = gsap.matchMedia();
    mm.add('(min-width: 701px) and (prefers-reduced-motion: no-preference)', () => {
      const context = gsap.context(() => {
        $('[data-stat-value]').forEach(el => {
          const target = Number(el.dataset.statValue);
          const counter = { value: 0 };
          gsap.to(counter, { value: target, duration: 1.35, ease: 'power2.out', snap: { value: 1 }, scrollTrigger: { trigger: el, start: 'top 88%', once: true }, onUpdate: () => {
            el.textContent = el.dataset.statPrefix + Math.round(counter.value).toLocaleString() + el.dataset.statSuffix;
          } });
        });
        const heroChars = $('#hero-title .char');
        if (heroChars.length) gsap.from(heroChars, { yPercent: 115, opacity: 0, duration: 1.05, stagger: 0.025, ease: 'power4.out', delay: html.classList.contains('intro-pending') ? 1.2 : 0.12 });
        $$('.services-heading h2 .line,.work-intro h2 .line,.process-heading h2 .line,.contact-title .line').forEach((line, index) => {
          gsap.from(line, { yPercent: 110, opacity: 0, duration: 0.85, delay: index * 0.025, ease: 'power4.out',
            scrollTrigger: { trigger: line.closest('section') || line, start: 'top 82%', once: true } });
        });
        $$('.section-kicker,.hero-side-note,.hero-bottom,.services-heading p,.process-heading p,.contact-side,.form-heading').forEach(el => {
          gsap.from(el, { y: 18, opacity: 0, duration: 0.7, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 92%', once: true } });
        });
        $$('.about-copy p').forEach(el => gsap.from(el, { y: 28, opacity: 0, duration: 0.9, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 82%', once: true } }));
        const highlightWords = $$('.highlight-word');
        if (highlightWords.length) gsap.fromTo(highlightWords, { opacity: 0.22 }, { opacity: 1, stagger: 0.12, ease: 'none', scrollTrigger: { trigger: $('.aside-copy'), start: 'top 78%', end: 'bottom 45%', scrub: true } });
        if (canvas) gsap.to(particleState, { morph: 1, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 0.7 } });
        if (marqueeTrack) {
          gsap.to(marqueeTrack, { xPercent: -25, ease: 'none', scrollTrigger: { trigger: '.marquee-section', start: 'top bottom', end: 'bottom top', scrub: 0.7 } });
          marqueeSkewTo = gsap.quickTo(marqueeTrack, 'skewX', { duration: 0.24, ease: 'power2.out' });
          ST.create({ trigger: '.marquee-section', start: 'top bottom', end: 'bottom top', onUpdate: self => {
            marqueeSkewTo(clamp(self.getVelocity() / -850, -3, 3));
          }, onLeave: () => marqueeSkewTo(0), onLeaveBack: () => marqueeSkewTo(0) });
        }
        const workTrackEl = $('#work-track');
        if (workSection && !workSection.hidden && workTrackEl && caseStudies.length) {
          const distance = () => Math.max(0, workTrackEl.scrollWidth - window.innerWidth + (parseFloat(getComputedStyle(doc.documentElement).getPropertyValue('--pad')) || 0) * 2);
          gsap.to(workTrackEl, { x: () => -distance(), ease: 'none', scrollTrigger: { trigger: workSection, start: 'top top', end: () => '+=' + distance(), pin: '.work-pin-wrap', scrub: 0.8, invalidateOnRefresh: true, anticipatePin: 1,
            onUpdate: self => { if (workProgress) gsap.set(workProgress, { scaleX: self.progress }); } } });
          $$('.project-visual img,.project-visual video', workTrackEl).forEach(media => {
            gsap.fromTo(media, { scale: 1.12 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: media.closest('.project-card'), containerAnimation: null, start: 'left right', end: 'right left', scrub: 0.5 } });
          });
        }
        if (processCards.length && !mobileQuery.matches) {
          processCards.forEach((card, index) => {
            if (index === 0) gsap.set(card, { position: 'relative', inset: 'auto', opacity: 1, y: 0, scale: 1, zIndex: processCards.length });
            else gsap.set(card, { position: 'absolute', inset: 0, opacity: 0, y: 34, scale: 0.985, zIndex: processCards.length - index });
          });
          const timeline = gsap.timeline({ scrollTrigger: { trigger: '.process-pin', start: 'top top+=70', end: () => '+=' + (window.innerHeight * (processCards.length - 1) * 0.82), pin: true, scrub: 0.6, invalidateOnRefresh: true } });
          processCards.forEach((card, index) => {
            if (index === 0) { gsap.set(card, { opacity: 1, y: 0, scale: 1, zIndex: processCards.length }); return; }
            gsap.set(card, { opacity: 0, y: 34, scale: 0.985, zIndex: processCards.length - index });
            timeline.to(card, { opacity: 1, y: 0, scale: 1, duration: 0.7, ease: 'none' }, index - 1);
            if (index > 1) timeline.to(processCards[index - 1], { opacity: 0.25, scale: 0.97, duration: 0.5, ease: 'none' }, index - 1);
            timeline.to($('.process-progress span'), { scaleX: (index + 1) / processCards.length, duration: 0.7, ease: 'none' }, index - 1);
          });
          const current = $('.process-current');
          timeline.eventCallback('onUpdate', () => {
            const step = Math.min(processCards.length - 1, Math.floor(timeline.progress() * processCards.length));
            if (current) current.textContent = String(step).padStart(2, '0');
          });
        }
        const zero = $('.contact-zero');
        if (zero) gsap.to(zero, { rotate: 180, ease: 'none', scrollTrigger: { trigger: '.contact', start: 'top bottom', end: 'top 25%', scrub: 0.8 } });
        const footer = $('.footer-statement');
        if (footer && finePointer.matches) {
          footer.addEventListener('pointermove', event => {
            const rect = footer.getBoundingClientRect();
            const rx = (event.clientY - rect.top - rect.height / 2) / rect.height;
            const ry = (event.clientX - rect.left - rect.width / 2) / rect.width;
            gsap.to(footer, { rotateX: -rx * 3, rotateY: ry * 3, transformPerspective: 900, duration: 0.35, ease: 'power2.out', overwrite: true });
          }, { signal });
          footer.addEventListener('pointerleave', () => gsap.to(footer, { rotateX: 0, rotateY: 0, duration: 0.5, ease: 'power3.out' }), { signal });
        }
      }, doc);
      return () => { context.revert(); marqueeSkewTween?.kill(); marqueeSkewTween = null; marqueeSkewTo = null; };
    });
    mm.add('(max-width: 700px) and (prefers-reduced-motion: no-preference)', () => {
      const context = gsap.context(() => {
        $$('.reveal,.section-kicker,.services-heading p,.process-heading p,.contact-side').forEach(el => {
          gsap.from(el, { y: 14, opacity: 0, duration: 0.55, ease: 'power2.out', scrollTrigger: { trigger: el, start: 'top 95%', once: true } });
        });
        $$('.highlight-word').forEach(word => gsap.fromTo(word, { opacity: 0.25 }, { opacity: 1, duration: 0.2, scrollTrigger: { trigger: word, start: 'top 90%', end: 'bottom 65%', scrub: true } }));
      }, doc);
      return () => context.revert();
    });
  }
  setupMotion();

  /* ---------- Resize / refresh: one scheduled refresh, matchMedia reverts old contexts ---------- */
  function scheduleRefresh() {
    if (refreshFrame) cancelAnimationFrame(refreshFrame);
    refreshFrame = requestAnimationFrame(() => {
      refreshFrame = 0;
      if (canvas) resizeCanvas();
      if (ST && !prefersReduced.matches) ST.refresh();
    });
  }
  window.addEventListener('resize', scheduleRefresh, { passive: true, signal });
  window.addEventListener('orientationchange', scheduleRefresh, { passive: true, signal });
  if (doc.fonts?.ready) doc.fonts.ready.then(() => { if (!signal.aborted && ST) ST.refresh(); });
  window.addEventListener('scroll', () => {
    if (progressFrame) return;
    progressFrame = requestAnimationFrame(() => {
      progressFrame = 0;
      const bar = $('.scroll-progress span');
      const max = doc.documentElement.scrollHeight - innerHeight;
      if (bar) bar.style.transform = 'scaleX(' + (max > 0 ? clamp(scrollY / max, 0, 1) : 0) + ')';
    });
  }, { passive: true, signal });

  /* ---------- Cleanup: no ticker, observers, frames, or event listeners left behind ---------- */
  window.addEventListener('pagehide', () => {
    aborter.abort();
    if (cursorFrame) cancelAnimationFrame(cursorFrame);
    if (canvasFrame) cancelAnimationFrame(canvasFrame);
    if (progressFrame) cancelAnimationFrame(progressFrame);
    if (refreshFrame) cancelAnimationFrame(refreshFrame);
    mm?.revert();
    ST?.getAll().forEach(trigger => trigger.kill());
    splitInstances.forEach(instance => { try { instance.revert(); } catch (_) {} });
    lenis?.destroy();
  }, { once: true });
})();