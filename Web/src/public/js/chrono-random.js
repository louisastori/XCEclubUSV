(() => {
  const pad = (n, len = 2) => String(n).padStart(len, '0');

  function randomMs() {
    // Chrono réaliste entre 60s et 150s
    const totalSeconds = 60 + Math.floor(Math.random() * 91); // 60..150 sec
    const centi = Math.floor(Math.random() * 100);
    return totalSeconds * 1000 + centi * 10;
  }

  function fillRandomChronos() {
    const inputs = document.querySelectorAll('input[name^="times_global"]');
    const times = Array.from({ length: inputs.length }, () => randomMs());
    // on mélange l'attribution pour qu'elle soit indépendante de l'ordre d'affichage
    for (let i = times.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [times[i], times[j]] = [times[j], times[i]];
    }
    inputs.forEach((input, idx) => {
      const ms = times[idx];
      const totalSeconds = Math.floor(ms / 1000);
      const centi = Math.floor((ms % 1000) / 10);
      const hh = Math.floor(totalSeconds / 3600);
      const mm = Math.floor((totalSeconds % 3600) / 60);
      const ss = totalSeconds % 60;
      const chrono = `${pad(hh)}:${pad(mm)}:${pad(ss)}:${pad(centi)}`;
      input.value = chrono;
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('fill-random');
    if (!btn) return;
    btn.addEventListener('click', fillRandomChronos);
  });
})();
