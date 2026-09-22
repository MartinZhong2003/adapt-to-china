(function (global) {
  'use strict';

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>'"]/g, function (char) {
      return {'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char];
    });
  }

  function usable(value) {
    var text = String(value == null ? '' : value).trim();
    if (!text) return '';
    if (/^(unknown|unclear|needs verification|not publicly available|not_publicly_available)$/i.test(text)) return '';
    return text;
  }

  function validUrl(value) {
    return /^https?:\/\//i.test(String(value || ''));
  }

  function destinationQuery(options) {
    var parts = [
      usable(options.nameChinese),
      usable(options.addressChinese),
      usable(options.nameEnglish),
      usable(options.addressEnglish),
      usable(options.city)
    ].filter(Boolean);
    return parts.filter(function (value, index) { return parts.indexOf(value) === index; }).join(' ');
  }

  function amapUrl(options, query) {
    if (validUrl(options.amapUrl)) return options.amapUrl;
    if (options.latitude != null && options.longitude != null && options.mode === 'exact') {
      var marker = new URLSearchParams({
        position: String(options.longitude) + ',' + String(options.latitude),
        name: usable(options.nameChinese) || usable(options.nameEnglish) || 'Destination',
        src: 'adapttochina',
        coordinate: /^(gaode|gcj02)$/i.test(String(options.coordinateSystem || '')) ? 'gaode' : 'wgs84',
        callnative: '1'
      });
      return 'https://uri.amap.com/marker?' + marker.toString();
    }
    var search = new URLSearchParams({
      keyword: usable(options.amapSearchQuery) || query,
      city: usable(options.city),
      src: 'adapttochina',
      callnative: '1'
    });
    return 'https://uri.amap.com/search?' + search.toString();
  }

  function buildUrls(options) {
    options = options || {};
    var query = destinationQuery(options) || 'China';
    var apple = new URLSearchParams({q: query});
    var baidu = new URLSearchParams({
      query: query,
      region: usable(options.city) || 'China',
      output: 'html',
      src: 'adapttochina'
    });
    return {
      apple: 'https://maps.apple.com/?' + apple.toString(),
      amap: amapUrl(options, query),
      baidu: 'https://api.map.baidu.com/place/search?' + baidu.toString()
    };
  }

  function renderChooser(options, config) {
    config = config || {};
    var urls = buildUrls(options || {});
    var destination = usable(options && (options.nameEnglish || options.nameChinese)) || 'this place';
    var buttonClass = config.buttonClass || 'btn';
    var extraClass = config.extraClass || '';
    return '<details class="map-choice ' + escapeHtml(extraClass) + '">' +
      '<summary class="' + escapeHtml(buttonClass) + '" aria-label="Choose a map for ' + escapeHtml(destination) + '">' +
        '<span>Choose a map</span><span class="map-choice-chevron" aria-hidden="true">⌄</span>' +
      '</summary>' +
      '<div class="map-choice-menu" aria-label="Map options">' +
        '<a href="' + escapeHtml(urls.apple) + '" target="_blank" rel="noopener noreferrer"><span>Apple Maps</span><span aria-hidden="true">↗</span></a>' +
        '<a href="' + escapeHtml(urls.amap) + '" target="_blank" rel="noopener noreferrer"><span>AMap Global</span><span aria-hidden="true">↗</span></a>' +
        '<a href="' + escapeHtml(urls.baidu) + '" target="_blank" rel="noopener noreferrer"><span>Baidu Maps</span><span aria-hidden="true">↗</span></a>' +
      '</div>' +
    '</details>';
  }

  function firstFact(labels) {
    var rows = Array.prototype.slice.call(document.querySelectorAll('.hd-fact'));
    for (var i = 0; i < rows.length; i += 1) {
      var term = rows[i].querySelector('dt');
      var value = rows[i].querySelector('dd');
      if (!term || !value) continue;
      var label = term.textContent.trim().toLowerCase();
      if (labels.some(function (candidate) { return label === candidate || label.indexOf(candidate) !== -1; })) return value.textContent.trim();
    }
    return '';
  }

  function inferDetailOptions(amapLink) {
    var eyebrow = document.querySelector('.page-head .eyebrow');
    var city = eyebrow ? eyebrow.textContent.split('·')[0].trim() : '';
    var nameEnglishNode = document.querySelector('.hd-hero-grid h1');
    var nameChineseNode = document.querySelector('.hd-cn');
    return {
      nameEnglish: nameEnglishNode ? nameEnglishNode.textContent.trim() : '',
      nameChinese: nameChineseNode ? nameChineseNode.textContent.trim() : '',
      addressChinese: firstFact(['chinese address', 'address or campus']),
      addressEnglish: firstFact(['english address', 'address']),
      city: city,
      amapUrl: amapLink ? amapLink.href : '',
      mode: /\/marker\?|\/place\//i.test(amapLink ? amapLink.href : '') ? 'exact' : 'search'
    };
  }

  function chooserNode(options, buttonClass) {
    var holder = document.createElement('div');
    holder.innerHTML = renderChooser(options, {buttonClass: buttonClass, extraClass: 'map-choice--detail'});
    return holder.firstElementChild;
  }

  function enhanceDetailPage() {
    var selector = '.hd-hero-actions a[href*="amap.com"], .hd-copy-actions a[href*="amap.com"], .hd-fact dd a[href*="amap.com"]';
    Array.prototype.slice.call(document.querySelectorAll(selector)).forEach(function (link) {
      if (link.closest('.map-choice')) return;
      var buttonClass = 'btn';
      if (link.classList.contains('sm')) buttonClass += ' sm';
      if (link.classList.contains('primary')) buttonClass += ' primary';
      var row = link.closest('.hd-fact');
      if (row) {
        var term = row.querySelector('dt');
        if (term && /amap action/i.test(term.textContent)) term.textContent = 'Map options';
      }
      link.replaceWith(chooserNode(inferDetailOptions(link), buttonClass));
    });
  }

  global.MapLinks = {
    buildUrls: buildUrls,
    renderChooser: renderChooser,
    enhanceDetailPage: enhanceDetailPage
  };
})(window);
