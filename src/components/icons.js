/* Ícones SVG (os símbolos ficam no index.html) */
(function (G) {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';

  G.icon = function (name, cls = '') {
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    if (cls) svg.setAttribute('class', cls);
    const use = document.createElementNS(NS, 'use');
    use.setAttribute('href', '#i-' + name);
    svg.appendChild(use);
    return svg;
  };
})(window.Game = window.Game || {});
