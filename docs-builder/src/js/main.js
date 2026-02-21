/* TaskNotes Docs — client-side behaviour
   - Reading progress bar
   - Theme toggle (persisted)
   - Mobile nav
   - TOC active-link tracking
*/

(function () {
  'use strict';

  // ── Theme ────────────────────────────────────────────────────────

  const root = document.documentElement;
  const themeBtn = document.getElementById('js-theme');

  function applyTheme(t) {
    root.setAttribute('data-theme', t);
    localStorage.setItem('tn-theme', t);
  }

  // Restore persisted preference, falling back to OS preference
  const saved = localStorage.getItem('tn-theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(saved || (prefersDark ? 'dark' : 'light'));

  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      applyTheme(root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
    });
  }

  // ── Reading progress ─────────────────────────────────────────────

  const progressFill = document.getElementById('js-progress');

  function updateProgress() {
    if (!progressFill) return;
    const scrolled = window.scrollY;
    const total    = document.body.scrollHeight - window.innerHeight;
    const pct      = total > 0 ? (scrolled / total) * 100 : 0;
    progressFill.style.height = pct + '%';
  }

  window.addEventListener('scroll', updateProgress, { passive: true });
  updateProgress();

  // ── Mobile nav ───────────────────────────────────────────────────

  const sidebar  = document.getElementById('js-sidebar');
  const menuBtn  = document.getElementById('js-menu');
  const overlay  = document.getElementById('js-overlay');

  function openNav() {
    sidebar?.classList.add('is-open');
    overlay?.classList.add('is-visible');
    menuBtn?.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
  }

  function closeNav() {
    sidebar?.classList.remove('is-open');
    overlay?.classList.remove('is-visible');
    menuBtn?.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }

  menuBtn?.addEventListener('click', () => {
    const isOpen = sidebar?.classList.contains('is-open');
    isOpen ? closeNav() : openNav();
  });

  overlay?.addEventListener('click', closeNav);

  // Close on nav link tap (mobile)
  sidebar?.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', closeNav);
  });

  // ── Code copy buttons ────────────────────────────────────────────

  document.querySelectorAll('.prose pre').forEach(pre => {
    const btn = document.createElement('button');
    btn.className = 'copy-btn';
    btn.setAttribute('aria-label', 'Copy code');
    btn.textContent = 'copy';
    pre.appendChild(btn);

    btn.addEventListener('click', () => {
      const code = pre.querySelector('code');
      navigator.clipboard.writeText(code ? code.innerText : pre.innerText).then(() => {
        btn.textContent = 'copied';
        btn.classList.add('is-copied');
        setTimeout(() => {
          btn.textContent = 'copy';
          btn.classList.remove('is-copied');
        }, 2000);
      });
    });
  });

  // ── TOC active link ──────────────────────────────────────────────

  const tocLinks = document.querySelectorAll('.toc a');
  if (tocLinks.length) {
    const headings = Array.from(
      document.querySelectorAll('.prose h2[id], .prose h3[id]')
    );

    function updateToc() {
      let active = headings[0];
      const scrollY = window.scrollY + 80;

      for (const h of headings) {
        if (h.offsetTop <= scrollY) active = h;
      }

      tocLinks.forEach(a => {
        const isActive = active && a.getAttribute('href') === '#' + active.id;
        a.classList.toggle('is-active', isActive);
      });
    }

    window.addEventListener('scroll', updateToc, { passive: true });
    updateToc();
  }
})();
