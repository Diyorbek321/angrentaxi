// Kichik progressiv qatlam: JS bo'lmasa ham sayt to'liq ishlaydi.
(() => {
  const root = document.documentElement;
  root.classList.add('js');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Sarlavha soyasi va o'qish progress chizig'i.
  const header = document.querySelector('[data-header]');
  const progress = document.querySelector('[data-progress]');
  let ticking = false;
  const onScroll = () => {
    ticking = false;
    const y = window.scrollY;
    header?.classList.toggle('is-scrolled', y > 8);
    if (progress) {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      progress.style.transform = `scaleX(${max > 0 ? Math.min(1, y / max) : 0})`;
    }
  };
  onScroll();
  window.addEventListener(
    'scroll',
    () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(onScroll);
      }
    },
    { passive: true },
  );

  // Mobil menyu.
  const toggle = document.querySelector('[data-menu-toggle]');
  const nav = document.querySelector('[data-nav]');
  const label = document.querySelector('[data-menu-label]');
  const setOpen = (open) => {
    if (!toggle || !nav) return;
    toggle.setAttribute('aria-expanded', String(open));
    nav.classList.toggle('is-open', open);
    if (label) label.textContent = open ? toggle.dataset.labelClose : toggle.dataset.labelOpen;
  };
  toggle?.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
  nav?.addEventListener('click', (e) => {
    if (e.target instanceof Element && e.target.closest('a[href^="#"]')) setOpen(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && toggle?.getAttribute('aria-expanded') === 'true') {
      setOpen(false);
      toggle.focus();
    }
  });
  window.matchMedia('(min-width: 1041px)').addEventListener('change', (e) => e.matches && setOpen(false));

  // Harakat kamaytirilgan bo'lsa — xaritadagi mashina (SVG SMIL) to'xtaydi.
  if (reduced) document.querySelectorAll('svg.map').forEach((svg) => svg.pauseAnimations?.());

  if (!('IntersectionObserver' in window)) {
    document.querySelectorAll('[data-reveal]').forEach((el) => el.classList.add('is-in'));
    return;
  }

  // Ko'rinishga kirganda paydo bo'lish. Kechikish faqat birinchi chiqish
  // uchun — keyin olib tashlanadi, aks holda hover ham kechikadi.
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        el.classList.add('is-in');
        io.unobserve(el);
        setTimeout(() => {
          el.style.transitionDelay = '';
        }, 1200);
      });
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
  );
  document.querySelectorAll('[data-reveal]').forEach((el) => {
    const siblings = el.parentElement ? [...el.parentElement.children].filter((c) => c.hasAttribute('data-reveal')) : [];
    const index = Math.max(0, siblings.indexOf(el));
    if (!reduced) el.style.transitionDelay = `${Math.min(index, 5) * 90}ms`;
    io.observe(el);
  });

  // Menyuda joriy bo'lim.
  const links = new Map(
    [...document.querySelectorAll('.main-nav ul a[href^="#"]')].map((a) => [a.getAttribute('href').slice(1), a]),
  );
  const spy = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const link = links.get(entry.target.id);
        if (!link || !entry.isIntersecting) return;
        links.forEach((a) => a.classList.remove('is-current'));
        link.classList.add('is-current');
      });
    },
    { rootMargin: '-45% 0px -50% 0px' },
  );
  links.forEach((_, id) => {
    const section = document.getElementById(id);
    if (section) spy.observe(section);
  });
})();
