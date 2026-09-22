(function () {
  'use strict';
  function $(s) { return document.querySelector(s); }
  function initNav() {
    var burger = $('.nav-burger'); var links = $('#nav-links');
    if (!burger || !links) return;
    burger.addEventListener('click', function () {
      var open = links.classList.toggle('open');
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      burger.textContent = open ? '×' : '☰';
    });
  }
  function buildBackLink() {
    var link = $('#hd-back-link');
    if (!link) return;
    try {
      var state = JSON.parse(sessionStorage.getItem('halalFinderState') || 'null');
      if (!state || typeof state !== 'object') return;
      var params = new URLSearchParams();
      Object.keys(state).forEach(function (key) {
        var value = state[key];
        if (!value) return;
        params.set(key, typeof value === 'boolean' ? '1' : String(value));
      });
      link.href = '/halal-food.html' + (params.toString() ? '?' + params.toString() : '') + '#finder';
    } catch (_) {}
  }
  async function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); return; }
    var area = document.createElement('textarea');
    area.value = text; area.setAttribute('readonly',''); area.style.position='fixed'; area.style.opacity='0';
    document.body.appendChild(area); area.select(); document.execCommand('copy'); area.remove();
  }
  function initCopyButtons() {
    var status = $('#hd-copy-status');
    document.querySelectorAll('[data-copy]').forEach(function(button){
      button.addEventListener('click', async function(){
        try { await copyText(button.getAttribute('data-copy') || ''); if (status) status.textContent = 'Chinese name copied.'; }
        catch (_) { if (status) status.textContent = 'Copy failed. Select the Chinese name manually.'; }
      });
    });
  }
  function initMapChoices() {
    if (window.MapLinks) { window.MapLinks.enhanceDetailPage(); return; }
    var script = document.createElement('script');
    script.src = '/map-links.js';
    script.onload = function(){ if (window.MapLinks) window.MapLinks.enhanceDetailPage(); };
    document.head.appendChild(script);
  }
  function initCompactSections() {
    document.querySelectorAll('main .hd-section').forEach(function(section, index){
      if (index === 0) return;
      var wrap = section.querySelector(':scope > .wrap');
      var heading = wrap && wrap.querySelector(':scope > h2');
      if (!wrap || !heading) return;
      var details = document.createElement('details'); details.className = 'hd-collapsible';
      var summary = document.createElement('summary'); summary.textContent = heading.textContent;
      var body = document.createElement('div'); body.className = 'hd-collapsible-body';
      Array.prototype.slice.call(wrap.childNodes).forEach(function(node){ if (node !== heading) body.appendChild(node); });
      details.appendChild(summary); details.appendChild(body); wrap.replaceChildren(details);
    });
  }
  document.addEventListener('DOMContentLoaded', function(){ initNav(); buildBackLink(); initCopyButtons(); initMapChoices(); initCompactSections(); });
})();
