// Store-only zip of [name, string|Uint8Array] pairs — no library.
export function zip(files) {
  const enc = new TextEncoder(), tbl = new Int32Array(256);
  for (let i = 0; i < 256; i++) { let c = i; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; tbl[i] = c; }
  const crc = d => { let c = -1; for (let i = 0; i < d.length; i++) c = tbl[(c ^ d[i]) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
  const now = new Date(), dt = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate(), tm = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const parts = [], cd = []; let off = 0;
  const u16 = v => [v & 255, (v >>> 8) & 255], u32 = v => [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255];
  for (const [name, data] of files) {
    const n = enc.encode(name), d = typeof data === 'string' ? enc.encode(data) : data, c = crc(d);
    const hdr = new Uint8Array([...u32(0x04034b50), ...u16(20), ...u16(0x800), ...u16(0), ...u16(tm), ...u16(dt), ...u32(c), ...u32(d.length), ...u32(d.length), ...u16(n.length), ...u16(0), ...n]);
    cd.push(new Uint8Array([...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0x800), ...u16(0), ...u16(tm), ...u16(dt), ...u32(c), ...u32(d.length), ...u32(d.length), ...u16(n.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(off), ...n]));
    parts.push(hdr, d); off += hdr.length + d.length;
  }
  const cdLen = cd.reduce((s, x) => s + x.length, 0);
  const end = new Uint8Array([...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length), ...u32(cdLen), ...u32(off), ...u16(0)]);
  return new Blob([...parts, ...cd, end], { type: 'application/zip' });
}
export function download(blob, name) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
