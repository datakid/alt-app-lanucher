(function (root) {
'use strict';
var F = root.F || (root.F = {});

var CRC = null;
function crc32(bytes) {
  var c, i, k, crc = 0xFFFFFFFF;
  if (!CRC) {
    CRC = new Uint32Array(256);
    for (i = 0; i < 256; i++) { c = i; for (k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; CRC[i] = c >>> 0; }
  }
  for (i = 0; i < bytes.length; i++) crc = CRC[(crc ^ bytes[i]) & 255] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

var LBASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
var LEXT = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
var DBASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
var DEXT = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
var CLORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];

function huff(lengths, n) {
  var count = new Uint16Array(16), symbol = new Uint16Array(n), offs = new Uint16Array(16), i;
  for (i = 0; i < n; i++) count[lengths[i]]++;
  for (i = 1; i < 15; i++) offs[i + 1] = offs[i] + count[i];
  for (i = 0; i < n; i++) if (lengths[i]) symbol[offs[lengths[i]]++] = i;
  return { count: count, symbol: symbol };
}

function inflate(src, sizeHint) {
  var pos = 0, bitbuf = 0, bitcnt = 0, out = new Uint8Array(Math.max(sizeHint || 0, 1024)), op = 0, last;
  function bits(need) {
    var val = bitbuf;
    while (bitcnt < need) {
      if (pos >= src.length) throw new Error('inflate: out of data');
      val |= src[pos++] << bitcnt;
      bitcnt += 8;
    }
    bitbuf = val >>> need;
    bitcnt -= need;
    return val & ((1 << need) - 1);
  }
  function decode(h) {
    var code = 0, first = 0, index = 0, len, count;
    for (len = 1; len < 16; len++) {
      code |= bits(1);
      count = h.count[len];
      if (code - count < first) return h.symbol[index + (code - first)];
      index += count; first += count; first <<= 1; code <<= 1;
    }
    throw new Error('inflate: bad code');
  }
  function put(b) {
    if (op >= out.length) { var n = new Uint8Array(out.length * 2); n.set(out); out = n; }
    out[op++] = b;
  }
  var fixedL = null, fixedD = null;
  function codes(lc, dc) {
    var sym, len, dist, i;
    for (;;) {
      sym = decode(lc);
      if (sym < 256) put(sym);
      else if (sym === 256) return;
      else {
        sym -= 257;
        if (sym >= 29) throw new Error('inflate: bad length');
        len = LBASE[sym] + bits(LEXT[sym]);
        sym = decode(dc);
        dist = DBASE[sym] + bits(DEXT[sym]);
        if (dist > op) throw new Error('inflate: bad distance');
        for (i = 0; i < len; i++) put(out[op - dist]);
      }
    }
  }
  do {
    last = bits(1);
    var type = bits(2), i, lens, nlen, ndist, ncode, tmp, lc, dc, len, sym, rep;
    if (type === 0) {
      bitbuf = 0; bitcnt = 0;
      len = src[pos] | (src[pos + 1] << 8);
      pos += 4;
      for (i = 0; i < len; i++) put(src[pos++]);
    } else if (type === 1) {
      if (!fixedL) {
        lens = new Uint8Array(288);
        for (i = 0; i < 144; i++) lens[i] = 8;
        for (; i < 256; i++) lens[i] = 9;
        for (; i < 280; i++) lens[i] = 7;
        for (; i < 288; i++) lens[i] = 8;
        fixedL = huff(lens, 288);
        lens = new Uint8Array(30);
        for (i = 0; i < 30; i++) lens[i] = 5;
        fixedD = huff(lens, 30);
      }
      codes(fixedL, fixedD);
    } else if (type === 2) {
      nlen = bits(5) + 257; ndist = bits(5) + 1; ncode = bits(4) + 4;
      tmp = new Uint8Array(19);
      for (i = 0; i < ncode; i++) tmp[CLORDER[i]] = bits(3);
      lc = huff(tmp, 19);
      lens = new Uint8Array(nlen + ndist);
      i = 0;
      while (i < nlen + ndist) {
        sym = decode(lc);
        if (sym < 16) lens[i++] = sym;
        else {
          len = 0;
          if (sym === 16) { len = lens[i - 1]; rep = 3 + bits(2); }
          else if (sym === 17) rep = 3 + bits(3);
          else rep = 11 + bits(7);
          while (rep--) lens[i++] = len;
        }
      }
      lc = huff(lens.subarray(0, nlen), nlen);
      dc = huff(lens.subarray(nlen), ndist);
      codes(lc, dc);
    } else throw new Error('inflate: bad block');
  } while (!last);
  return out.subarray(0, op);
}

function u16(b, o) { return b[o] | (b[o + 1] << 8); }
function u32(b, o) { return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0; }

function unzip(bytes) {
  var end = -1, i, files = Object.create(null), n, off, cd, name, dec = new TextDecoder('utf-8');
  for (i = bytes.length - 22; i >= Math.max(0, bytes.length - 65558); i--) if (u32(bytes, i) === 0x06054b50) { end = i; break; }
  if (end < 0) throw new Error('not a zip file');
  n = u16(bytes, end + 10); cd = u32(bytes, end + 16);
  off = cd;
  for (i = 0; i < n; i++) {
    if (u32(bytes, off) !== 0x02014b50) throw new Error('bad zip directory');
    var nl = u16(bytes, off + 28), el = u16(bytes, off + 30), cl = u16(bytes, off + 32);
    name = dec.decode(bytes.subarray(off + 46, off + 46 + nl));
    files[name] = { method: u16(bytes, off + 10), csize: u32(bytes, off + 20), usize: u32(bytes, off + 24), lho: u32(bytes, off + 42) };
    off += 46 + nl + el + cl;
  }
  return {
    has: function (nm) { return !!files[nm]; },
    names: function () { return Object.keys(files); },
    get: function (nm) {
      var f = files[nm];
      if (!f) return null;
      var o = f.lho, data;
      o += 30 + u16(bytes, o + 26) + u16(bytes, o + 28);
      data = bytes.subarray(o, o + f.csize);
      if (f.method === 0) return data;
      if (f.method === 8) return inflate(data, f.usize);
      throw new Error('unsupported zip method');
    }
  };
}

function zip(files) {
  var enc = new TextEncoder(), parts = [], central = [], offset = 0, total = 0, i, f, nameB, crc, lh, ch;
  function w16(a, o, v) { a[o] = v & 255; a[o + 1] = (v >>> 8) & 255; }
  function w32(a, o, v) { a[o] = v & 255; a[o + 1] = (v >>> 8) & 255; a[o + 2] = (v >>> 16) & 255; a[o + 3] = (v >>> 24) & 255; }
  for (i = 0; i < files.length; i++) {
    f = files[i];
    nameB = enc.encode(f.name);
    crc = crc32(f.data);
    lh = new Uint8Array(30 + nameB.length);
    w32(lh, 0, 0x04034b50); w16(lh, 4, 20); w16(lh, 6, 0x0800); w16(lh, 8, 0); w16(lh, 10, 0); w16(lh, 12, 0x21);
    w32(lh, 14, crc); w32(lh, 18, f.data.length); w32(lh, 22, f.data.length); w16(lh, 26, nameB.length); w16(lh, 28, 0);
    lh.set(nameB, 30);
    ch = new Uint8Array(46 + nameB.length);
    w32(ch, 0, 0x02014b50); w16(ch, 4, 20); w16(ch, 6, 20); w16(ch, 8, 0x0800); w16(ch, 10, 0); w16(ch, 12, 0); w16(ch, 14, 0x21);
    w32(ch, 16, crc); w32(ch, 20, f.data.length); w32(ch, 24, f.data.length); w16(ch, 28, nameB.length);
    w32(ch, 42, offset);
    ch.set(nameB, 46);
    parts.push(lh, f.data);
    central.push(ch);
    offset += lh.length + f.data.length;
  }
  var cdSize = 0;
  central.forEach(function (c) { cdSize += c.length; });
  var endRec = new Uint8Array(22);
  w32(endRec, 0, 0x06054b50); w16(endRec, 8, files.length); w16(endRec, 10, files.length); w32(endRec, 12, cdSize); w32(endRec, 16, offset);
  parts = parts.concat(central, [endRec]);
  parts.forEach(function (p) { total += p.length; });
  var out = new Uint8Array(total), at = 0;
  parts.forEach(function (p) { out.set(p, at); at += p.length; });
  return out;
}

function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function unesc(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, function (m, e) {
    if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[e.toLowerCase()];
  });
}
function attr(s, name) {
  var m = new RegExp('(?:^|\\s)' + name + '="([^"]*)"').exec(s);
  return m ? unesc(m[1]) : '';
}
function colIndex(ref) {
  var m = /^([A-Z]+)/.exec(ref), n = 0, i;
  if (!m) return 0;
  for (i = 0; i < m[1].length; i++) n = n * 26 + (m[1].charCodeAt(i) - 64);
  return n - 1;
}
function colName(i) {
  var s = '';
  i++;
  while (i > 0) { s = String.fromCharCode(65 + (i - 1) % 26) + s; i = Math.floor((i - 1) / 26); }
  return s;
}
function textOf(xml) {
  var out = '', re = /<t\b[^>]*>([\s\S]*?)<\/t>/g, m;
  xml = xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, '');
  while ((m = re.exec(xml))) out += unesc(m[1]);
  return out;
}

function read(buffer) {
  var bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer), z = unzip(bytes), dec = new TextDecoder('utf-8');
  function txt(nm) { var d = z.get(nm); return d ? dec.decode(d) : ''; }
  var wb = txt('xl/workbook.xml');
  if (!wb) throw new Error('not a spreadsheet');
  var rels = Object.create(null), m, re = /<Relationship\b([^>]*?)\/?>/g, rx = txt('xl/_rels/workbook.xml.rels');
  while ((m = re.exec(rx))) rels[attr(m[1], 'Id')] = attr(m[1], 'Target');
  var sst = [], sx = txt('xl/sharedStrings.xml');
  re = /<si\b[^>]*?(?:\/>|>([\s\S]*?)<\/si>)/g;
  while ((m = re.exec(sx))) sst.push(m[1] ? textOf(m[1]) : '');
  var sheets = [];
  re = /<sheet\b([^>]*?)\/?>/g;
  while ((m = re.exec(wb))) {
    var rid = attr(m[1], 'r:id'), target = rels[rid] || '', path = target.charAt(0) === '/' ? target.slice(1) : 'xl/' + target.replace(/^\.\//, '');
    sheets.push({ name: attr(m[1], 'name'), hidden: /hidden/i.test(attr(m[1], 'state')), path: path, rows: [] });
  }
  sheets.forEach(function (sh) {
    var xml = txt(sh.path), rowRe = /<row\b[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g, rm, rows = [];
    while ((rm = rowRe.exec(xml))) {
      if (!rm[1]) { rows.push([]); continue; }
      var cellRe = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g, cm, row = [], rowNo = null;
      while ((cm = cellRe.exec(rm[1]))) {
        var ref = attr(cm[1], 'r'), t = attr(cm[1], 't'), body = cm[2] || '', val = '', v = /<v\b[^>]*>([\s\S]*?)<\/v>/.exec(body), ci = ref ? colIndex(ref) : row.length;
        if (t === 's') val = v ? sst[parseInt(v[1], 10)] || '' : '';
        else if (t === 'inlineStr') val = textOf(body);
        else if (t === 'b') val = v && v[1] === '1' ? 'TRUE' : 'FALSE';
        else if (t === 'e') val = '';
        else val = v ? unesc(v[1]) : '';
        while (row.length < ci) row.push('');
        row[ci] = val;
      }
      rows.push(row);
    }
    sh.rows = rows;
    delete sh.path;
  });
  return { sheets: sheets };
}

function sheetXml(sh) {
  var rows = sh.rows || [], x = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">';
  var cols = sh.widths || [];
  x += '<sheetViews><sheetView workbookViewId="0"' + (sh.rtl ? ' rightToLeft="1"' : '') + '>' + (sh.header ? '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft"/>' : '') + '</sheetView></sheetViews>';
  x += '<sheetFormatPr defaultRowHeight="15"/>';
  if (cols.length) x += '<cols>' + cols.map(function (w, i) { return '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>'; }).join('') + '</cols>';
  x += '<sheetData>';
  rows.forEach(function (row, ri) {
    x += '<row r="' + (ri + 1) + '">';
    row.forEach(function (v, ci) {
      if (v === '' || v == null) return;
      var style = sh.header && ri === 0 ? 1 : (sh.wrap ? 2 : 0);
      x += '<c r="' + colName(ci) + (ri + 1) + '" t="inlineStr"' + (style ? ' s="' + style + '"' : '') + '><is><t xml:space="preserve">' + esc(v) + '</t></is></c>';
    });
    x += '</row>';
  });
  x += '</sheetData>';
  var dv = sh.validations || [];
  if (dv.length) {
    x += '<dataValidations count="' + dv.length + '">' + dv.map(function (d) {
      return '<dataValidation type="list" allowBlank="1" showErrorMessage="1" sqref="' + d.col + '2:' + d.col + '1000"><formula1>"' + esc(d.values.join(',')) + '"</formula1></dataValidation>';
    }).join('') + '</dataValidations>';
  }
  return x + '</worksheet>';
}

function safeName(n, used) {
  var s = String(n || 'Sheet').replace(/[\[\]:*?\/\\]/g, ' ').trim().slice(0, 31) || 'Sheet', base = s, i = 2;
  while (used[s.toLowerCase()]) { s = base.slice(0, 28) + ' ' + i++; }
  used[s.toLowerCase()] = 1;
  return s;
}

function write(sheets) {
  var enc = new TextEncoder(), files = [], used = Object.create(null), names = sheets.map(function (s) { return safeName(s.name, used); });
  function add(name, text) { files.push({ name: name, data: enc.encode(text) }); }
  var head = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
  add('[Content_Types].xml', head + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' + sheets.map(function (s, i) { return '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'; }).join('') + '</Types>');
  add('_rels/.rels', head + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
  add('xl/workbook.xml', head + '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' + sheets.map(function (s, i) { return '<sheet name="' + esc(names[i]) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>'; }).join('') + '</sheets></workbook>');
  add('xl/_rels/workbook.xml.rels', head + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + sheets.map(function (s, i) { return '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>'; }).join('') + '<Relationship Id="rId' + (sheets.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>');
  add('xl/styles.xml', head + '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>');
  sheets.forEach(function (s, i) { add('xl/worksheets/sheet' + (i + 1) + '.xml', sheetXml(s)); });
  return zip(files);
}

F.xlsx = { read: read, write: write, unzip: unzip, zip: zip, inflate: inflate, crc32: crc32 };
})(typeof window !== 'undefined' ? window : globalThis);
