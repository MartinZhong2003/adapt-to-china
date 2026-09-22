(function () {
  'use strict';

  var DATA_URL = 'data/halal-restaurants.json';
  var CITY_ORDER = ['Beijing', 'Shanghai', 'Guangzhou', 'Shenzhen'];
  var EVIDENCE_LABELS = {
    publicly_identified_as_halal: 'Publicly identified',
    restaurant_self_identifies: 'Restaurant states halal',
    recent_diner_reports_only: 'Diner reports only',
    pork_free_not_halal_verified: 'Pork-free claim only',
    unclear: 'Status unclear',
    conflicting_information: 'Conflicting information'
  };
  var PRICE_LABELS = {
    budget: 'Budget', moderate: 'Moderate', 'higher-priced': 'Higher-priced', unknown: 'Price unknown'
  };

  var restaurants = [];
  var visibleLimit = window.matchMedia('(max-width: 700px)').matches ? 6 : 8;
  var state = { query:'', city:'', district:'', price:'', evidence:'', confidence:'', delivery:false, budget:false, late:false };

  var $ = function (s, root) { return (root || document).querySelector(s); };
  var $$ = function (s, root) { return Array.prototype.slice.call((root || document).querySelectorAll(s)); };

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>'"]/g, function (char) {
      return {'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char];
    });
  }

  function normalize(value) {
    return String(value || '').normalize('NFKC').toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim();
  }

  function isKnown(value) {
    if (value == null || value === '') return false;
    var n = normalize(value);
    return n !== 'unknown' && n !== 'not publicly available' && n !== 'needs verification' && n !== 'unclear' && n !== 'not_publicly_available';
  }

  function validUrl(value) { return /^https?:\/\//i.test(String(value || '')); }
  function yes(value) { return normalize(value) === 'yes'; }
  function listHas(value, token) { return normalize(value).split(';').map(function(v){return v.trim();}).indexOf(token) !== -1; }

  function fillSelect(select, values, firstLabel) {
    var current = select.value;
    select.innerHTML = '<option value="">' + escapeHtml(firstLabel) + '</option>' + values.map(function(v){
      return '<option value="' + escapeHtml(v) + '">' + escapeHtml(v) + '</option>';
    }).join('');
    if (values.indexOf(current) !== -1) select.value = current;
  }

  function updateDistricts() {
    var districts = restaurants.filter(function(r){ return !state.city || r.city === state.city; })
      .map(function(r){ return r.district; }).filter(Boolean)
      .filter(function(v,i,a){ return a.indexOf(v) === i; }).sort();
    fillSelect($('#hf-district'), districts, 'All districts');
    if (districts.indexOf(state.district) === -1) {
      state.district = '';
      $('#hf-district').value = '';
    }
  }

  function haystack(r) {
    return normalize([
      r.restaurantNameEnglish, r.restaurantNameChinese, r.aliases, r.city, r.district,
      r.cuisineType, r.shortDescription, r.fullAddressChinese, r.addressEnglish,
      r.nearestMetroStation, r.suitableFor
    ].join(' '));
  }

  function filtered() {
    var q = normalize(state.query);
    var words = q ? q.split(' ').filter(Boolean) : [];
    return restaurants.filter(function(r){
      if (words.length && !words.every(function(w){ return haystack(r).indexOf(w) !== -1; })) return false;
      if (state.city && r.city !== state.city) return false;
      if (state.district && r.district !== state.district) return false;
      if (state.price && r.priceCategory !== state.price) return false;
      if (state.evidence && r.halalEvidenceStatus !== state.evidence) return false;
      if (state.confidence && r.confidenceLevel !== state.confidence) return false;
      if (state.delivery && !yes(r.deliveryAvailable)) return false;
      if (state.budget && !listHas(r.suitableFor, 'student_budget')) return false;
      if (state.late && !listHas(r.suitableFor, 'late_night')) return false;
      return true;
    });
  }

  function evidenceClass(status) {
    if (status === 'publicly_identified_as_halal') return 'evidence-public';
    if (status === 'restaurant_self_identifies') return 'evidence-self';
    return 'evidence-reports';
  }

  function priceText(r) {
    var base = PRICE_LABELS[r.priceCategory] || 'Price unknown';
    if (r.averagePriceRMB != null && r.averagePriceRMB !== '') base += ' · ¥' + r.averagePriceRMB;
    return base;
  }

  function amapSearchUrl(r) {
    if (!isKnown(r.amapSearchQuery)) return '';
    var params = new URLSearchParams({ keyword:r.amapSearchQuery, city:r.city || '', src:'adapttochina', callnative:'1' });
    return 'https://uri.amap.com/search?' + params.toString();
  }

  function mapAction(r) {
    var amapUrl = r.buttonType === 'open_amap' && validUrl(r.amapPlaceUrl) ? r.amapPlaceUrl : amapSearchUrl(r);
    var options = {
      nameEnglish: r.restaurantNameEnglish,
      nameChinese: r.restaurantNameChinese,
      addressChinese: r.fullAddressChinese,
      addressEnglish: r.addressEnglish,
      city: r.city,
      latitude: r.latitude,
      longitude: r.longitude,
      coordinateSystem: 'wgs84',
      amapSearchQuery: r.amapSearchQuery,
      amapUrl: amapUrl,
      mode: r.buttonType === 'open_amap' ? 'exact' : 'search'
    };
    if (window.MapLinks && typeof window.MapLinks.renderChooser === 'function') {
      return window.MapLinks.renderChooser(options, {buttonClass:'btn sm hf-map-link'});
    }
    return amapUrl ? '<a class="btn sm hf-map-link" href="' + escapeHtml(amapUrl) + '" target="_blank" rel="noopener noreferrer">Open in AMap Global</a>' : '';
  }

  function restaurantIcon() {
    return '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M20 10v18M14 10v11c0 4 3 7 6 7s6-3 6-7V10M20 28v26M43 10c-6 7-8 15-7 24h9V10h-2ZM45 34v20"/></svg>';
  }

  function card(r) {
    var evidence = EVIDENCE_LABELS[r.halalEvidenceStatus] || 'Evidence unclear';
    var smallTags = [evidence, priceText(r), yes(r.deliveryAvailable) ? 'Delivery' : ''].filter(Boolean).slice(0,3);
    var needsCheck = isKnown(r.importantCautions) || isKnown(r.amapLocationWarning) || r.amapVerificationStatus === 'conflicting_results';
    return '<article class="hf-card hf-card--compact">' +
      '<div class="hf-card-icon">' + restaurantIcon() + '</div>' +
      '<div class="hf-card-main">' +
        '<div class="hf-card-topline"><span>' + escapeHtml(r.city) + ' · ' + escapeHtml(r.district) + '</span><span class="hf-confidence ' + escapeHtml(r.confidenceLevel) + '">' + escapeHtml(r.confidenceLevel) + '</span></div>' +
        '<h3>' + escapeHtml(r.restaurantNameEnglish) + '</h3>' +
        '<p class="hf-cn-name" lang="zh-CN">' + escapeHtml(r.restaurantNameChinese) + '</p>' +
        '<p class="hf-card-services">' + escapeHtml(r.cuisineType) + '</p>' +
        '<div class="hf-badges">' + smallTags.map(function(t, i){ return '<span class="' + (i === 0 ? evidenceClass(r.halalEvidenceStatus) : '') + '">' + escapeHtml(t) + '</span>'; }).join('') + '</div>' +
        (needsCheck ? '<p class="hf-card-check">Confirm current branch details before visiting.</p>' : '') +
      '</div>' +
      '<div class="hf-card-actions hf-card-actions--compact">' +
        '<a class="btn sm teal hf-detail-link" href="halal-food/restaurants/' + encodeURIComponent(r.slug) + '/">View details</a>' +
        mapAction(r) +
      '</div>' +
    '</article>';
  }

  function saveState() {
    try { sessionStorage.setItem('halalFinderState', JSON.stringify(state)); } catch (_) {}
  }

  function activeFilterCount() {
    return ['city','district','price','evidence','confidence'].filter(function(k){ return !!state[k]; }).length +
      ['delivery','budget','late'].filter(function(k){ return !!state[k]; }).length;
  }

  function updateFilterButton() {
    var count = activeFilterCount();
    $('#hf-filter-count').textContent = String(count);
    $('#hf-filter-toggle').classList.toggle('has-filters', count > 0);
  }

  function render() {
    var matches = filtered();
    var shown = matches.slice(0, visibleLimit);
    var resultEl = $('#hf-results');
    resultEl.setAttribute('aria-busy','false');
    $('#hf-result-count').textContent = matches.length + (matches.length === 1 ? ' restaurant' : ' restaurants') + ' found';
    $('#hf-clear-search').hidden = !state.query;
    if (!matches.length) {
      resultEl.innerHTML = '<div class="hf-empty"><strong>No matches yet.</strong><p>Try removing one filter, searching the Chinese name, or choosing another city.</p></div>';
    } else {
      resultEl.innerHTML = shown.map(card).join('');
    }
    $('#hf-show-more').hidden = shown.length >= matches.length;
    $('#hf-show-more').textContent = 'Show more (' + (matches.length - shown.length) + ' remaining)';
    $$('.hf-detail-link').forEach(function(link){ link.addEventListener('click', saveState); });
    updateFilterButton();
  }

  function readStateFromUrl() {
    var params = new URLSearchParams(window.location.search);
    ['query','city','district','price','evidence','confidence'].forEach(function(k){ if (params.has(k)) state[k] = params.get(k) || ''; });
    ['delivery','budget','late'].forEach(function(k){ state[k] = params.get(k) === '1'; });
  }

  function applyStateToControls() {
    $('#hf-search').value = state.query;
    $('#hf-city').value = state.city;
    updateDistricts();
    $('#hf-district').value = state.district;
    $('#hf-price').value = state.price;
    $('#hf-evidence').value = state.evidence;
    $('#hf-confidence').value = state.confidence;
    $('#hf-delivery').checked = state.delivery;
    $('#hf-budget').checked = state.budget;
    $('#hf-late').checked = state.late;
  }

  function syncUrl() {
    var params = new URLSearchParams();
    Object.keys(state).forEach(function(k){
      var value = state[k];
      if (!value) return;
      params.set(k, typeof value === 'boolean' ? '1' : String(value));
    });
    var url = window.location.pathname + (params.toString() ? '?' + params.toString() : '') + '#finder';
    history.replaceState(null, '', url);
  }

  function syncState() {
    state.query = $('#hf-search').value.trim();
    state.city = $('#hf-city').value;
    state.district = $('#hf-district').value;
    state.price = $('#hf-price').value;
    state.evidence = $('#hf-evidence').value;
    state.confidence = $('#hf-confidence').value;
    state.delivery = $('#hf-delivery').checked;
    state.budget = $('#hf-budget').checked;
    state.late = $('#hf-late').checked;
    visibleLimit = window.matchMedia('(max-width: 700px)').matches ? 6 : 8;
    updateDistricts();
    syncUrl();
    render();
  }

  function reset() {
    state = { query:'', city:'', district:'', price:'', evidence:'', confidence:'', delivery:false, budget:false, late:false };
    applyStateToControls();
    visibleLimit = window.matchMedia('(max-width: 700px)').matches ? 6 : 8;
    syncUrl();
    render();
  }

  function initControls() {
    fillSelect($('#hf-city'), CITY_ORDER, 'All four cities');
    readStateFromUrl();
    applyStateToControls();
    ['hf-city','hf-district','hf-price','hf-evidence','hf-confidence','hf-delivery','hf-budget','hf-late'].forEach(function(id){
      $('#' + id).addEventListener('change', syncState);
    });
    $('#hf-search').addEventListener('input', syncState);
    $('#hf-clear-search').addEventListener('click', function(){ $('#hf-search').value=''; syncState(); $('#hf-search').focus(); });
    $('#hf-reset').addEventListener('click', reset);
    $('#hf-show-more').addEventListener('click', function(){ visibleLimit += 8; render(); });
    $('#hf-filter-toggle').addEventListener('click', function(){
      var panel = $('#hf-filter-panel');
      var open = panel.classList.toggle('is-open');
      $('#hf-filter-toggle').setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  function initNav() {
    var burger = $('.nav-burger'); var links = $('#nav-links');
    if (!burger || !links) return;
    burger.addEventListener('click', function(){
      var open = links.classList.toggle('open');
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      burger.textContent = open ? '×' : '☰';
    });
  }

  fetch(DATA_URL, {cache:'no-store'})
    .then(function(response){ if (!response.ok) throw new Error('Data request failed'); return response.json(); })
    .then(function(data){
      restaurants = Array.isArray(data.restaurants) ? data.restaurants : [];
      restaurants.sort(function(a,b){
        var cityDiff = CITY_ORDER.indexOf(a.city) - CITY_ORDER.indexOf(b.city);
        return cityDiff || String(a.restaurantNameEnglish).localeCompare(String(b.restaurantNameEnglish));
      });
      initControls(); render();
    })
    .catch(function(error){
      $('#hf-results').setAttribute('aria-busy','false');
      $('#hf-results').innerHTML = '<div class="hf-empty"><strong>The directory could not load.</strong><p>Please refresh the page or try again later.</p></div>';
      $('#hf-result-count').textContent = 'Directory unavailable';
      var alert = $('#hf-data-alert'); alert.hidden = false; alert.textContent = 'Restaurant data could not be loaded.';
      console.error(error);
    });

  initNav();
})();
