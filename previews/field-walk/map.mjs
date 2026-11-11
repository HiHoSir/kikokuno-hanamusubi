export const cellPx = 32;
export const arrival = [10, 8];
export const villageCell = [10, 7];

export const terrain = [
  '~~~~~~~~~~~~~~~~~~~~~~',
  '~~~~~~...~~~~~~..~~~~~',
  '~~~~~.^^^...~~....~~~~',
  '~~~~.^^^^...~~..^^.~~~',
  '~~~.^^..ff...~..^^^.~~',
  '~~.^^..ff.....f..^^.~~',
  '~~.^......vv.fff...~~~',
  '~~...ff...=...f.....~~',
  '~...ffff..=......ff.~~',
  '~..fff....=..ff....s~~',
  '~~.ff.....=..fff..ss~~',
  '~~.....f..=...f..ss~~~',
  '~~~....f..=......s~~~~',
  '~~~......==....sss~~~~',
  '~~~~ss...=...sss~~~~~~',
  '~~~~~~s..=..ss~~~~~~~~',
  '~~~~~~~s.=.ss~~~~~~~~~',
  '~~~~~~~~sss~~~~~~~~~~~',
  '~~~~~~~~~~~~~~~~~~~~~~',
];

export function canEnterCell(column, row) {
  const tile = terrain[row]?.[column];
  return tile !== undefined && !'~^v'.includes(tile);
}
