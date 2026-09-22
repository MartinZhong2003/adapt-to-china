(function () {
  'use strict';

  function initNav() {
    const burger = document.querySelector('.nav-burger');
    const links = document.getElementById('nav-links');
    if (!burger || !links) return;
    burger.addEventListener('click', function () {
      const open = links.classList.toggle('open');
      burger.setAttribute('aria-expanded', String(open));
      burger.textContent = open ? '×' : '☰';
    });
  }

  function buildBackLink() {
    const link = document.getElementById('hd-back-link');
    if (!link) return;
    try {
      const state = JSON.parse(sessionStorage.getItem('healthcareFinderState') || 'null');
      if (!state || typeof state !== 'object') return;
      const params = new URLSearchParams();
      Object.entries(state).forEach(([key, value]) => {
        if (!value) return;
        params.set(key, typeof value === 'boolean' ? '1' : String(value));
      });
      link.href = `/healthcare.html${params.toString() ? `?${params}` : ''}#finder`;
    } catch (_) { /* keep default link */ }
  }

  async function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return;
    }
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    document.execCommand('copy');
    area.remove();
  }

  function initCopyButtons() {
    const status = document.getElementById('hd-copy-status');
    document.querySelectorAll('[data-copy]').forEach((button) => {
      button.addEventListener('click', async () => {
        try {
          await copyText(button.dataset.copy || '');
          if (status) status.textContent = `${button.textContent.replace(/^Copy\s+/i, '')} copied.`;
        } catch (_) {
          if (status) status.textContent = 'Copy failed. Select and copy the text manually.';
        }
      });
    });
  }

  function initMapChoices() {
    if (window.MapLinks) {
      window.MapLinks.enhanceDetailPage();
      return;
    }
    const script = document.createElement('script');
    script.src = '/map-links.js';
    script.addEventListener('load', () => {
      if (window.MapLinks) window.MapLinks.enhanceDetailPage();
    });
    document.head.appendChild(script);
  }

  function initCompactSections() {
    document.querySelectorAll('main .hd-section').forEach((section, index) => {
      if (index === 0) return;
      const wrap = section.querySelector(':scope > .wrap');
      const heading = wrap && wrap.querySelector(':scope > h2');
      if (!wrap || !heading) return;
      const details = document.createElement('details');
      details.className = 'hd-collapsible';
      const summary = document.createElement('summary');
      summary.textContent = heading.textContent;
      const body = document.createElement('div');
      body.className = 'hd-collapsible-body';
      Array.from(wrap.childNodes).forEach((node) => { if (node !== heading) body.appendChild(node); });
      details.append(summary, body);
      wrap.replaceChildren(details);
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    initNav();
    buildBackLink();
    initCopyButtons();
    initMapChoices();
    initCompactSections();
  });
})();
