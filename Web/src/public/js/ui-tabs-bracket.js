(() => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  // Gestion des onglets : ne cible que les boutons avec un data-tab
  const tabButtons = document.querySelectorAll('.tab-btn[data-tab]');
  const tabs = document.querySelectorAll('.tab');
  const SVG_NS = 'http://www.w3.org/2000/svg';

  function toContainerRect(container, element) {
    const c = container.getBoundingClientRect();
    const e = element.getBoundingClientRect();
    return {
      x: e.left - c.left + container.scrollLeft,
      y: e.top - c.top + container.scrollTop,
      width: e.width,
      height: e.height,
    };
  }

  function drawConnector(svg, x1, y1, x2, y2, color) {
    const p = document.createElementNS(SVG_NS, 'path');
    const elbowX = x1 + Math.max(20, (x2 - x1) * 0.45);
    p.setAttribute('d', `M ${x1} ${y1} L ${elbowX} ${y1} L ${elbowX} ${y2} L ${x2} ${y2}`);
    p.setAttribute('fill', 'none');
    p.setAttribute('stroke', color);
    p.setAttribute('stroke-width', '2');
    p.setAttribute('stroke-linecap', 'round');
    p.setAttribute('stroke-linejoin', 'round');
    p.setAttribute('opacity', '0.9');
    svg.appendChild(p);
  }

  function drawBracketTree(container) {
    container.querySelectorAll(':scope > svg.bracket-lines').forEach((n) => n.remove());
    const rounds = Array.from(container.querySelectorAll(':scope > .round'));
    if (rounds.length < 2) return;

    const width = Math.max(container.scrollWidth, container.clientWidth);
    const height = Math.max(container.scrollHeight, container.clientHeight);
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.classList.add('bracket-lines');
    svg.setAttribute('width', String(width));
    svg.setAttribute('height', String(height));
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    const color = container.dataset.connectorColor || '#c9d2e4';

    for (let i = 0; i < rounds.length - 1; i += 1) {
      const fromMatches = Array.from(rounds[i].querySelectorAll(':scope > .match'));
      const toMatches = Array.from(rounds[i + 1].querySelectorAll(':scope > .match'));
      if (!fromMatches.length || !toMatches.length) continue;

      fromMatches.forEach((fromMatch, fromIdx) => {
        const toIdx = Math.min(
          toMatches.length - 1,
          Math.floor((fromIdx * toMatches.length) / fromMatches.length)
        );
        const toMatch = toMatches[toIdx];
        const a = toContainerRect(container, fromMatch);
        const b = toContainerRect(container, toMatch);
        drawConnector(svg, a.x + a.width, a.y + a.height / 2, b.x, b.y + b.height / 2, color);
      });
    }

    container.prepend(svg);
  }

  function redrawBracketTrees() {
    document.querySelectorAll('.rounds.tree').forEach((container) => drawBracketTree(container));
  }

  let resizeTimer = null;
  window.addEventListener('resize', () => {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(redrawBracketTrees, 120);
  });

  window.addEventListener('load', () => {
    setTimeout(redrawBracketTrees, 120);
  });

  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      tabButtons.forEach((b) => b.classList.remove('active'));
      tabs.forEach((t) => t.classList.remove('active'));
      btn.classList.add('active');
      const target = document.getElementById(btn.dataset.tab);
      if (target) target.classList.add('active');
      setTimeout(redrawBracketTrees, 80);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });

  redrawBracketTrees();
})();
