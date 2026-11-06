// Kichik progressiv qatlam: JS bo'lmasa ham sayt to'liq ishlaydi.
(() => {
  const root = document.documentElement;
  root.classList.add('js');

  // Sarlavha soyasi — sahifa siljiganda.
  const header = document.querySelector('[data-header]');
  const onScroll = () => header?.classList.toggle('is-scrolled', window.scrollY > 8);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

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

  // Ko'rinishga kirganda paydo bo'lish.
  const items = document.querySelectorAll('[data-reveal]');
  if (!('IntersectionObserver' in window)) {
    items.forEach((el) => el.classList.add('is-in'));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      });
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
  );
  items.forEach((el, i) => {
    // Bir qatordagi kartalar ketma-ket chiqadi.
    el.style.transitionDelay = `${(i % 4) * 70}ms`;
    io.observe(el);
  });
})();
