(() => {
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function fillRandomResults() {
    const fields = Array.from(document.querySelectorAll('fieldset.heat'));
    fields.forEach((heat) => {
      const inputs = Array.from(heat.querySelectorAll('input[type="number"]'));
      const positions = shuffle([...Array(inputs.length).keys()].map((i) => i + 1));
      inputs.forEach((input, idx) => {
        input.value = positions[idx];
      });
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('results-random');
    if (!btn) return;
    btn.addEventListener('click', fillRandomResults);
  });
})();
