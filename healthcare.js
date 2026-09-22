(function () {
  'use strict';

  const DATA_URL = 'data/hospitals.json';
  const CITIES = ['Beijing', 'Shanghai', 'Guangzhou', 'Shenzhen', 'Hangzhou', 'Chengdu', 'Nanjing', 'Suzhou', 'Wuhan', 'Xi’an'];
  const DEFAULT_STATE = {
    query: '', city: '', care: '', type: '', pathway: false, english: false,
    emergency: false, insurance: false, directBilling: false
  };

  let hospitals = [];
  let state = { ...DEFAULT_STATE };
  let lastFilterTrigger = null;
  let visibleLimit = 6;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[char]));
  }

  function normalize(value) {
    return String(value || '')
      .normalize('NFKD')
      .toLowerCase()
      .replace(/[’‘]/g, "'")
      .replace(/[^\p{L}\p{N}\u3400-\u9fff]+/gu, ' ')
      .trim();
  }

  function isYes(value) { return value === 'yes'; }

  function serviceKeywords(hospital) {
    const s = hospital.medicalServices || {};
    const words = [];
    if (isYes(s.dentistry)) words.push('dentist dental dentistry tooth teeth');
    if (isYes(s.pediatrics)) words.push('children child pediatric pediatrics paediatric paediatrics');
    if (isYes(s.womensHealth)) words.push('women womens health gynecology gynaecology obstetrics ob gyn maternity prenatal reproductive');
    if (isYes(s.mentalHealth)) words.push('mental health psychiatry psychology counselling counseling');
    if (isYes(s.emergencyDepartment) || isYes(s.twentyFourHourEmergency)) words.push('emergency er emergency department 24 hour');
    if (isYes(s.healthCheckCenter)) words.push('health check check up checkup health examination screening');
    if (isYes(s.surgery)) words.push('surgery surgical specialist care');
    if (isYes(s.cancerCenter)) words.push('cancer oncology tumour tumor');
    const specialties = normalize((s.mainSpecialties || []).join(' '));
    if (specialties.includes('ophthalmology')) words.push('eye');
    if (specialties.includes('dermatology')) words.push('skin');
    if (specialties.includes('orthopedics') || specialties.includes('orthopaedics')) words.push('bone');
    if (specialties.includes('cardiology') || specialties.includes('cardiovascular')) words.push('heart');
    if (specialties.includes('oncology')) words.push('cancer');
    return words.join(' ');
  }

  function buildSearchText(hospital) {
    const i = hospital.internationalSupport || {};
    const p = hospital.practicalInformation || {};
    const pathLabels = [];
    if (isYes(i.internationalMedicalDepartment)) pathLabels.push('international medical department imd');
    if (isYes(i.internationalClinic)) pathLabels.push('international clinic');
    if (isYes(i.vipClinic)) pathLabels.push('vip clinic special needs clinic');
    if (isYes(i.foreignPatientCenter)) pathLabels.push('foreign patient center international patient center');
    if (isYes(i.englishSpeakingReception)) pathLabels.push('english support english speaking reception');
    if (isYes(i.interpreterServices)) pathLabels.push('interpreter interpretation language assistance');

    return normalize([
      hospital.englishName, hospital.chineseName, ...(hospital.alternativeNames || []),
      hospital.city, hospital.district, hospital.province, hospital.fullAddress,
      hospital.hospitalType, hospital.facilityKind, hospital.hospitalLevel,
      hospital.facilityClassification, ...((hospital.medicalServices || {}).mainSpecialties || []),
      ...(i.multilingualServices || []), p.nearestMetroStation, pathLabels.join(' '),
      serviceKeywords(hospital),
      JSON.stringify(hospital.navigation || {})
    ].filter(Boolean).join(' '));
  }

  function careMatches(hospital, care) {
    if (!care) return true;
    const s = hospital.medicalServices || {};
    const specialties = normalize((s.mainSpecialties || []).join(' '));
    switch (care) {
      case 'general': return /family medicine|internal medicine|general practice|health management/.test(specialties);
      case 'emergency': return isYes(s.emergencyDepartment) || specialties.includes('emergency');
      case 'dental': return isYes(s.dentistry) || /dental|dentistry/.test(specialties);
      case 'mental-health': return isYes(s.mentalHealth) || /psychiatry|psychology|mental health/.test(specialties);
      case 'womens-health': return isYes(s.womensHealth) || /ob gyn|obstetrics|gynecology|gynaecology|women|reproductive/.test(specialties);
      case 'children': return isYes(s.pediatrics) || /pediatrics|paediatrics/.test(specialties);
      case 'health-check': return isYes(s.healthCheckCenter) || /health management|health check|examination/.test(specialties);
      case 'specialist': return isYes(s.surgery) || isYes(s.cancerCenter) || specialties.length > 0;
      default: return true;
    }
  }

  function searchMatches(hospital, query) {
    const q = normalize(query);
    if (!q) return true;
    const tokens = q.split(/\s+/).filter(Boolean);
    return tokens.every((token) => hospital._searchText.includes(token));
  }

  function filterHospitals() {
    return hospitals.filter((h) => {
      const i = h.internationalSupport || {};
      const f = h.foreignPatientInformation || {};
      const m = h.medicalServices || {};
      if (state.city && h.city !== state.city) return false;
      if (state.type && h.hospitalType !== state.type) return false;
      if (state.pathway && !isYes(i.internationalPatientPathway)) return false;
      if (state.english && !isYes(i.englishSpeakingReception)) return false;
      if (state.emergency && !isYes(m.twentyFourHourEmergency)) return false;
      if (state.insurance && !isYes(f.overseasInsuranceAccepted)) return false;
      if (state.directBilling && !isYes(f.directBillingAvailable)) return false;
      if (!careMatches(h, state.care)) return false;
      if (!searchMatches(h, state.query)) return false;
      return true;
    }).sort((a, b) => a.englishName.localeCompare(b.englishName, 'en'));
  }

  function exactAmapUrl(item) {
    const lat = item.latitude;
    const lng = item.longitude;
    if (lat == null || lng == null) return item.amapPlaceUrl || '';
    const coordinate = item.coordinateSystem === 'gaode' || item.coordinateSystem === 'gcj02' ? 'gaode' : 'wgs84';
    const params = new URLSearchParams({
      position: `${lng},${lat}`,
      name: item.destinationName || item.chineseName || item.name || 'Hospital',
      src: 'adapttochina',
      coordinate,
      callnative: '1'
    });
    return `https://uri.amap.com/marker?${params.toString()}`;
  }

  function searchAmapUrl(item) {
    if (!item.searchKeyword) return item.fallbackPlaceUrl || '';
    const params = new URLSearchParams({
      keyword: item.searchKeyword,
      city: item.city || '',
      src: 'adapttochina',
      callnative: '1'
    });
    return `https://uri.amap.com/search?${params.toString()}`;
  }

  function mapOptions(hospital, navOverride) {
    const nav = navOverride || hospital.navigation || {};
    let amapUrl = '';
    if (nav.mode === 'search') amapUrl = searchAmapUrl(nav);
    else if (nav.mode === 'exact') amapUrl = exactAmapUrl(nav);
    else if (nav.amapPlaceUrl || nav.fallbackPlaceUrl) amapUrl = nav.amapPlaceUrl || nav.fallbackPlaceUrl;
    const gps = hospital.gps || {};
    return {
      nameEnglish: nav.name || hospital.englishName,
      nameChinese: nav.destinationName || nav.chineseName || hospital.chineseName,
      addressChinese: nav.addressZh || '',
      addressEnglish: nav.addressEnglish || hospital.fullAddress,
      city: nav.city || hospital.city,
      latitude: nav.latitude != null ? nav.latitude : gps.latitude,
      longitude: nav.longitude != null ? nav.longitude : gps.longitude,
      coordinateSystem: nav.coordinateSystem || 'wgs84',
      amapSearchQuery: nav.searchKeyword || '',
      amapUrl,
      mode: nav.mode === 'exact' ? 'exact' : 'search'
    };
  }

  function renderMapChooser(options, buttonClass) {
    if (window.MapLinks && typeof window.MapLinks.renderChooser === 'function') {
      return window.MapLinks.renderChooser(options, { buttonClass: buttonClass || 'btn primary' });
    }
    const fallback = options.amapUrl || searchAmapUrl({ searchKeyword: options.nameChinese || options.nameEnglish, city: options.city });
    return fallback ? `<a class="${escapeHtml(buttonClass || 'btn primary')}" href="${escapeHtml(fallback)}" target="_blank" rel="noopener">Open in AMap Global</a>` : '';
  }

  function navigationAction(hospital) {
    const nav = hospital.navigation || {};
    if (nav.mode === 'campus' && Array.isArray(nav.campuses) && nav.campuses.length) {
      return { mode: 'campus', label: nav.buttonLabel || 'Choose a campus' };
    }
    return { mode: 'maps', options: mapOptions(hospital) };
  }

  function sourceDateLabel(hospital) {
    const date = (hospital.evidence || {}).retrievalDate;
    if (!date) return 'Source date not stated';
    const parsed = new Date(`${date}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime())) return `Source retrieved: ${date}`;
    return `Source retrieved: ${parsed.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })}`;
  }

  function badge(label, className = '') {
    return `<span class="hc-badge ${className}">${escapeHtml(label)}</span>`;
  }

  function facilityIcon() {
    return `<div class="hc-facility-icon" aria-hidden="true"><svg viewBox="0 0 64 64" focusable="false"><path d="M15 54V18h34v36M24 18V9h16v9M29 12h6M22 28h6m8 0h6m-20 9h6m8 0h6M28 54V44h8v10M10 54h44"/></svg></div>`;
  }

  function renderCard(hospital) {
    const i = hospital.internationalSupport || {};
    const f = hospital.foreignPatientInformation || {};
    const m = hospital.medicalServices || {};
    const p = hospital.practicalInformation || {};
    const badges = [badge(hospital.hospitalType || 'Facility', 'neutral')];
    if (isYes(i.internationalPatientPathway)) badges.push(badge('International pathway'));
    if (isYes(i.englishSpeakingReception)) badges.push(badge('English support listed'));
    if (badges.length < 3 && isYes(f.directBillingAvailable)) badges.push(badge('Direct billing listed'));
    const specialties = (m.mainSpecialties || []).slice(0, 4);
    const location = [hospital.city, hospital.district].filter(Boolean).join(' · ');
    const navAction = navigationAction(hospital);
    const chineseName = hospital.chineseName ? `<p class="hc-card-cn" lang="zh-CN">${escapeHtml(hospital.chineseName)}</p>` : '';
    const specialtyHtml = specialties.length ? `<p class="hc-card-services">${escapeHtml(specialties.join(' · '))}</p>` : '';
    const metro = p.nearestMetroStation ? `<span class="hc-card-metro">Metro: ${escapeHtml(p.nearestMetroStation)}</span>` : '';
    const limited = hospital.profileCompleteness === 'summary' ? `<span class="hc-card-limited">Limited profile</span>` : '';

    return `<article class="hc-hospital-card hc-hospital-card--row" data-slug="${escapeHtml(hospital.slug)}">
      ${facilityIcon()}
      <div class="hc-card-main">
        <div class="hc-card-topline"><span>${escapeHtml(location)}</span><span>${escapeHtml(hospital.facilityKind === 'clinic' ? 'Clinic' : 'Hospital')}</span></div>
        <h3>${escapeHtml(hospital.englishName)}</h3>
        ${chineseName}
        <div class="hc-badges" aria-label="Confirmed or source-listed features">${badges.join('')}</div>
        ${specialtyHtml}
        <div class="hc-card-footnotes">${metro}${limited}<span>${escapeHtml(sourceDateLabel(hospital))}</span></div>
      </div>
      <div class="hc-card-actions hc-card-actions--row">
        <a class="btn hc-detail-link" href="healthcare/hospitals/${encodeURIComponent(hospital.slug)}/">View details</a>
        ${navAction.mode === 'campus' ? `<button class="btn primary hc-campus-button" type="button" data-campus-hospital="${escapeHtml(hospital.id)}">${escapeHtml(navAction.label)}</button>` : renderMapChooser(navAction.options, 'btn primary')}
      </div>
    </article>`;
  }

  function renderEmptyState() {
    return `<div class="hc-empty-state"><h3>No confirmed match in this directory.</h3><p>Try a broader care type, another city, or fewer filters. This curated list does not include every hospital in China.</p><div class="btn-row"><button class="btn" type="button" data-reset-filters>Reset filters</button><a class="btn" href="answers.html">Ask for practical support</a></div></div>`;
  }

  function renderResults() {
    const container = $('#hc-results');
    const count = $('#hc-result-count');
    if (!container || !count) return;
    const matches = filterHospitals();
    const visible = matches.slice(0, visibleLimit);
    container.setAttribute('aria-busy', 'false');
    count.textContent = `${matches.length} ${matches.length === 1 ? 'facility' : 'facilities'} found.`;
    container.innerHTML = matches.length ? visible.map(renderCard).join('') : renderEmptyState();
    const moreButton = $('#hc-show-more');
    if (moreButton) {
      const remaining = Math.max(0, matches.length - visible.length);
      moreButton.hidden = remaining === 0;
      moreButton.textContent = remaining ? `Show ${Math.min(6, remaining)} more ${remaining === 1 ? 'facility' : 'facilities'}` : 'Show more facilities';
    }
    const showButton = $('#hc-show-results');
    if (showButton) showButton.textContent = `Show ${matches.length} ${matches.length === 1 ? 'facility' : 'facilities'}`;
    updateActiveFilterCount();
    bindDynamicActions();
    saveState();
    updateUrl();
  }

  function cityOptions() {
    return ['<option value="">All cities</option>', ...CITIES.map((city) => `<option value="${escapeHtml(city)}">${escapeHtml(city)}</option>`)].join('');
  }

  function filterControlMarkup(prefix) {
    const checkbox = (key, label) => `<label class="hc-filter-check"><input type="checkbox" data-filter-key="${key}" id="${prefix}-${key}"><span>${escapeHtml(label)}</span></label>`;
    return `<div class="hc-filter-group"><label for="${prefix}-type">Facility type</label><select id="${prefix}-type" data-filter-key="type"><option value="">Public and private</option><option value="Public">Public</option><option value="Private">Private</option></select></div>
      <fieldset class="hc-filter-group hc-filter-checks"><legend>International access</legend>${checkbox('pathway', 'International-patient pathway')}${checkbox('english', 'English-speaking reception')}</fieldset>
      <fieldset class="hc-filter-group hc-filter-checks"><legend>Payment and urgent care</legend>${checkbox('emergency', '24-hour emergency listed')}${checkbox('insurance', 'Overseas insurance accepted')}${checkbox('directBilling', 'Direct billing available')}</fieldset>
      <p class="hc-filter-help">Feature filters include only records explicitly marked “yes.” Missing information is not treated as “no.”</p>`;
  }

  function renderFilterControls() {
    $$('[data-filter-controls]').forEach((node) => {
      node.innerHTML = filterControlMarkup(node.dataset.filterControls === 'mobile' ? 'hc-dialog' : 'hc-desktop');
    });
    const quickCity = $('#hc-quick-city');
    if (quickCity) quickCity.innerHTML = cityOptions();
    bindFilterInputs();
    syncControlsFromState();
  }

  function bindFilterInputs() {
    $$('[data-filter-key]').forEach((control) => {
      control.addEventListener('change', () => {
        const key = control.dataset.filterKey;
        state[key] = control.type === 'checkbox' ? control.checked : control.value;
        visibleLimit = 6;
        syncControlsFromState(control);
        renderResults();
      });
    });
  }

  function syncControlsFromState(source) {
    $$('[data-filter-key]').forEach((control) => {
      if (control === source) return;
      const key = control.dataset.filterKey;
      if (control.type === 'checkbox') control.checked = Boolean(state[key]);
      else control.value = state[key] || '';
    });
    const search = $('#hc-search');
    if (search && search.value !== state.query) search.value = state.query;
    const clear = $('#hc-clear-search');
    if (clear) clear.hidden = !state.query;
  }

  function bindStaticControls() {
    const search = $('#hc-search');
    let timer;
    search?.addEventListener('input', () => {
      state.query = search.value.trim();
      visibleLimit = 6;
      $('#hc-clear-search').hidden = !state.query;
      clearTimeout(timer);
      timer = setTimeout(renderResults, 120);
    });
    search?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        renderResults();
        $('#hc-results')?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      }
    });
    $('#hc-clear-search')?.addEventListener('click', () => {
      state.query = '';
      visibleLimit = 6;
      search.value = '';
      $('#hc-clear-search').hidden = true;
      renderResults();
      search.focus();
    });
    $('#hc-run-search')?.addEventListener('click', () => {
      state.query = search?.value.trim() || '';
      visibleLimit = 6;
      renderResults();
      $('#hc-results')?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    });
    $$('[data-reset-filters]').forEach((button) => button.addEventListener('click', resetFilters));
    $('#hc-show-more')?.addEventListener('click', () => {
      visibleLimit += 6;
      renderResults();
      $('#hc-show-more')?.focus({ preventScroll: true });
    });

    const dialog = $('#hc-filter-dialog');
    const open = $('#hc-open-filters');
    const close = $('#hc-close-filters');
    open?.addEventListener('click', () => {
      lastFilterTrigger = open;
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
      document.body.classList.add('hc-dialog-open');
      close?.focus();
    });
    close?.addEventListener('click', () => dialog.close());
    $('#hc-show-results')?.addEventListener('click', () => dialog.close());
    dialog?.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
    dialog?.addEventListener('close', () => {
      document.body.classList.remove('hc-dialog-open');
      lastFilterTrigger?.focus();
    });
    window.addEventListener('beforeunload', saveState);
  }

  let lastCampusTrigger = null;

  function openCampusDialog(hospitalId, trigger) {
    const hospital = hospitals.find((item) => item.id === hospitalId);
    const nav = hospital && hospital.navigation;
    const dialog = $('#hc-campus-dialog');
    const title = $('#hc-campus-dialog-title');
    const note = $('#hc-campus-dialog-note');
    const list = $('#hc-campus-list');
    const warning = $('#hc-campus-warning');
    if (!hospital || !nav || nav.mode !== 'campus' || !dialog || !list) return;
    lastCampusTrigger = trigger || null;
    title.textContent = `Choose a campus for ${hospital.englishName}`;
    note.textContent = nav.note || 'Choose the campus shown in your appointment.';
    warning.textContent = nav.warning || '';
    warning.hidden = !nav.warning;
    list.innerHTML = nav.campuses.map((campus) => {
      const badge = campus.recommended ? `<span class="hc-campus-recommended">${escapeHtml(campus.recommendationLabel || 'Recommended')}</span>` : '';
      const campusOptions = mapOptions(hospital, {
        ...campus,
        name: `${hospital.englishName} — ${campus.name}`,
        destinationName: [hospital.chineseName, campus.chineseName].filter(Boolean).join(' '),
        searchKeyword: campus.searchKeyword || [hospital.chineseName, campus.chineseName, campus.addressZh].filter(Boolean).join(' '),
        city: hospital.city
      });
      return `<article class="hc-campus-option">
        <div><div class="hc-campus-title-row"><h3>${escapeHtml(campus.name)}</h3>${badge}</div>
        <p lang="zh-CN">${escapeHtml(campus.chineseName || '')}</p>
        <p>${escapeHtml(campus.addressZh || '')}</p></div>
        ${renderMapChooser(campusOptions, 'btn primary')}
      </article>`;
    }).join('');
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    document.body.classList.add('hc-dialog-open');
  }

  function closeCampusDialog() {
    const dialog = $('#hc-campus-dialog');
    if (!dialog) return;
    if (dialog.open && typeof dialog.close === 'function') dialog.close();
    else dialog.removeAttribute('open');
    document.body.classList.remove('hc-dialog-open');
    if (lastCampusTrigger) lastCampusTrigger.focus();
  }

  function initCampusDialog() {
    const dialog = $('#hc-campus-dialog');
    const close = $('#hc-close-campus-dialog');
    if (!dialog) return;
    if (close) close.addEventListener('click', closeCampusDialog);
    dialog.addEventListener('close', () => {
      document.body.classList.remove('hc-dialog-open');
      if (lastCampusTrigger) lastCampusTrigger.focus();
    });
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) closeCampusDialog();
    });
  }

  function bindDynamicActions() {
    $$('[data-reset-filters]', $('#hc-results')).forEach((button) => button.addEventListener('click', resetFilters));
    $$('.hc-campus-button').forEach((button) => button.addEventListener('click', () => openCampusDialog(button.dataset.campusHospital, button)));
    $$('.hc-detail-link').forEach((link) => link.addEventListener('click', () => {
      saveState();
      sessionStorage.setItem('healthcareFinderScroll', String(window.scrollY));
    }));
  }

  function resetFilters() {
    state = { ...DEFAULT_STATE };
    visibleLimit = 6;
    syncControlsFromState();
    renderResults();
  }

  function activeFilterCount() {
    return ['city', 'care', 'type', 'pathway', 'english', 'emergency', 'insurance', 'directBilling'].reduce((sum, key) => sum + (state[key] ? 1 : 0), 0);
  }

  function updateActiveFilterCount() {
    const count = activeFilterCount();
    const node = $('#hc-active-filter-count');
    if (node) node.textContent = count ? `(${count})` : '';
  }

  function saveState() {
    try { sessionStorage.setItem('healthcareFinderState', JSON.stringify(state)); } catch (_) { /* ignored */ }
  }

  function loadState() {
    const params = new URLSearchParams(location.search);
    if (Array.from(params.keys()).length) {
      Object.keys(DEFAULT_STATE).forEach((key) => {
        if (!params.has(key)) return;
        state[key] = typeof DEFAULT_STATE[key] === 'boolean' ? params.get(key) === '1' : params.get(key) || '';
      });
      return;
    }
    try {
      const saved = JSON.parse(sessionStorage.getItem('healthcareFinderState') || 'null');
      if (saved && typeof saved === 'object') state = { ...DEFAULT_STATE, ...saved };
    } catch (_) { state = { ...DEFAULT_STATE }; }
  }

  function updateUrl() {
    try {
      const params = new URLSearchParams();
      Object.entries(state).forEach(([key, value]) => {
        if (!value) return;
        params.set(key, typeof value === 'boolean' ? '1' : value);
      });
      const hash = location.hash === '#finder' ? '#finder' : '';
      history.replaceState(null, '', `${location.pathname}${params.toString() ? `?${params}` : ''}${hash}`);
    } catch (_) {
      /* History can be unavailable in local previews; filtering still works. */
    }
  }

  function restoreScroll() {
    try {
      const value = sessionStorage.getItem('healthcareFinderScroll');
      if (value && location.hash === '#finder') {
        requestAnimationFrame(() => window.scrollTo({ top: Number(value), behavior: 'auto' }));
        sessionStorage.removeItem('healthcareFinderScroll');
      }
    } catch (_) { /* ignored */ }
  }

  function initNav() {
    const burger = $('.nav-burger');
    const links = $('#nav-links');
    if (!burger || !links) return;
    burger.addEventListener('click', () => {
      const open = links.classList.toggle('open');
      burger.setAttribute('aria-expanded', String(open));
      burger.textContent = open ? '×' : '☰';
    });
  }

  async function init() {
    initNav();
    initCampusDialog();
    loadState();
    bindStaticControls();
    try {
      const response = await fetch(DATA_URL, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Data request returned ${response.status}`);
      const payload = await response.json();
      if (!payload || !Array.isArray(payload.hospitals)) throw new Error('Hospital data is not in the expected format.');
      hospitals = payload.hospitals.map((hospital) => ({ ...hospital, _searchText: buildSearchText(hospital) }));
      renderFilterControls();
      renderResults();
      restoreScroll();
    } catch (error) {
      console.error(error);
      const alert = $('#hc-data-alert');
      const results = $('#hc-results');
      const count = $('#hc-result-count');
      if (alert) { alert.hidden = false; alert.textContent = 'The hospital directory could not be loaded. Please try again later.'; }
      if (count) count.textContent = 'Hospital data unavailable.';
      if (results) {
        results.setAttribute('aria-busy', 'false');
        results.innerHTML = '<div class="hc-empty-state"><h3>The directory is temporarily unavailable.</h3><p>You can still read the hospital visit guide or request practical support.</p><div class="btn-row"><a class="btn" href="healthcare-guide.html">Hospital visit guide</a><a class="btn" href="answers.html">Practical support</a></div></div>';
      }
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
