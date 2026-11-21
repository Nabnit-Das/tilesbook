// Code 39 standard character patterns, expressed as nine-bit wide-element masks.
const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-. $/+%*";
const masks = [
  52, 289, 97, 352, 49, 304, 112, 37, 292, 100, 265, 73, 328, 25, 280, 88, 13,
  268, 76, 28, 259, 67, 322, 19, 274, 82, 7, 262, 70, 22, 385, 193, 448, 145,
  400, 208, 133, 388, 196, 168, 162, 138, 42, 148,
];
export function barcodeSvg(value: string) {
  if (
    !value ||
    value.length > 64 ||
    [...value].some((c) => c === "*" || !chars.includes(c))
  )
    return null;
  let x = 10;
  const bars: string[] = [];
  for (const c of "*" + value + "*") {
    const mask = masks[chars.indexOf(c)];
    for (let i = 0; i < 9; i++) {
      const w = mask & (256 >> i) ? 3 : 1;
      if (i % 2 === 0)
        bars.push('<rect x="' + x + '" y="2" width="' + w + '" height="40"/>');
      x += w;
    }
    x++;
  }
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' +
    (x + 9) +
    ' 56"><rect width="100%" height="100%" fill="white"/>' +
    bars.join("") +
    '<text x="50%" y="53" font-family="monospace" font-size="10" text-anchor="middle">' +
    value +
    "</text></svg>"
  );
}
