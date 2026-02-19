function parseChrono(chrono) {
  if (!chrono) return [null, null];
  const trimmed = chrono.trim();

  // Accepte hh:mm:ss:cc ou mm:ss:cc (1 ou 2 chiffres par segment)
  let hh = 0;
  let mm = 0;
  let ss = 0;
  let cc = 0;
  let match = trimmed.match(/^(\d{1,2}):(\d{1,2}):(\d{1,2}):(\d{1,2})$/);
  if (match) {
    [, hh, mm, ss, cc] = match;
  } else {
    match = trimmed.match(/^(\d{1,2}):(\d{1,2}):(\d{1,2})$/);
    if (!match) return [null, trimmed];
    [, mm, ss, cc] = match;
  }
  const hours = Number(hh);
  const minutes = Number(mm);
  const seconds = Number(ss);
  const centi = Number(cc);
  const ms = ((hours * 3600 + minutes * 60 + seconds) * 1000) + centi * 10;
  const norm = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}:${String(centi).padStart(2, '0')}`;
  return [ms, norm];
}

function splitIntoGroupsOf3Or4(count) {
  if (count < 3) {
    throw new Error('Au moins 3 participants requis pour former des groupes de 3 ou 4.');
  }
  for (let nb4 = Math.floor(count / 4); nb4 >= 0; nb4 -= 1) {
    const remaining = count - nb4 * 4;
    if (remaining === 0) {
      return Array(nb4).fill(4);
    }
    if (remaining % 3 === 0) {
      const nb3 = remaining / 3;
      return [...Array(nb4).fill(4), ...Array(nb3).fill(3)];
    }
  }
  throw new Error('Impossible de former uniquement des groupes de 3 ou 4 avec ce nombre de participants.');
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

module.exports = {
  parseChrono,
  splitIntoGroupsOf3Or4,
  shuffle,
};
