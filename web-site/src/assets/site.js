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

  // ---------- Ariza formasi ----------
  const section = document.querySelector('[data-apply-section]');
  const form = document.querySelector('[data-apply-form]');
  const done = document.querySelector('[data-apply-done]');
  if (section && form && done) {
    const status = form.querySelector('[data-status]');
    const submit = form.querySelector('[data-submit]');
    const submitLabel = form.querySelector('[data-submit-label]');
    const idleLabel = submitLabel?.textContent ?? '';

    // Faqat tanlangan turdagi maydonlar faol: o'chirilgan fieldset tekshirilmaydi va yuborilmaydi.
    const setType = (type) => {
      section.dataset.type = type;
      form.querySelectorAll('fieldset[data-for]').forEach((fs) => {
        fs.disabled = fs.dataset.for !== type;
      });
      const radio = form.querySelector(`input[name="type"][value="${type}"]`);
      if (radio) radio.checked = true;
    };
    form.addEventListener('change', (e) => {
      if (e.target instanceof HTMLInputElement && e.target.name === 'type') setType(e.target.value);
    });
    document.querySelectorAll('[data-apply]').forEach((link) =>
      link.addEventListener('click', () => setType(link.dataset.apply)),
    );

    const showError = (msg) => {
      status.textContent = msg;
      status.classList.add('is-error');
    };
    const setBusy = (busy) => {
      submit.setAttribute('aria-busy', String(busy));
      submit.disabled = busy;
      submitLabel.textContent = busy ? form.dataset.sending : idleLabel;
    };

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      status.textContent = '';
      status.classList.remove('is-error');
      form.classList.add('was-validated');
      if (!form.checkValidity()) {
        const consent = form.elements.namedItem('consent');
        showError(consent && !consent.checked && form.querySelectorAll(':invalid').length === 1
          ? form.dataset.errConsent
          : form.dataset.errInvalid);
        form.querySelector(':invalid:not(fieldset)')?.focus();
        return;
      }
      const data = new FormData(form);
      const payload = { lang: form.dataset.lang, consent: true };
      for (const [key, value] of data.entries()) {
        if (key === 'consent') continue;
        const v = String(value).trim();
        if (v === '' && key !== 'website') continue;
        payload[key] = key === 'carYear' ? Number(v) : v;
      }
      if (!payload.website) delete payload.website;

      setBusy(true);
      try {
        const res = await fetch('/api/v1/leads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          form.hidden = true;
          done.hidden = false;
          done.focus();
          return;
        }
        showError(res.status === 429 ? form.dataset.errRate : res.status === 400 ? form.dataset.errInvalid : form.dataset.errNetwork);
      } catch {
        showError(form.dataset.errNetwork);
      } finally {
        setBusy(false);
      }
    });

    done.querySelector('[data-apply-again]')?.addEventListener('click', () => {
      form.reset();
      form.classList.remove('was-validated');
      setType('driver');
      done.hidden = true;
      form.hidden = false;
      form.querySelector('input[name="name"]')?.focus();
    });
  }

  // ---------- Kursor effektlari (sichqoncha bo'lsa va harakat ruxsat etilsa) ----------
  if (!reduced && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    document.querySelectorAll('.card').forEach((card) =>
      card.addEventListener('pointermove', (e) => {
        const r = card.getBoundingClientRect();
        card.style.setProperty('--mx', `${e.clientX - r.left}px`);
        card.style.setProperty('--my', `${e.clientY - r.top}px`);
      }),
    );
    const heroEl = document.querySelector('.hero');
    const visual = document.querySelector('.hero-visual');
    if (heroEl && visual) {
      heroEl.addEventListener('pointermove', (e) => {
        const r = heroEl.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        visual.style.setProperty('--px', `${(x * 18).toFixed(1)}px`);
        visual.style.setProperty('--py', `${(y * 14).toFixed(1)}px`);
      });
      heroEl.addEventListener('pointerleave', () => {
        visual.style.setProperty('--px', '0px');
        visual.style.setProperty('--py', '0px');
      });
    }
  }

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
