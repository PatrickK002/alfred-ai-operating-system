import { inflateRawSync } from "node:zlib";

function decodeXml(value = "") {
  return String(value)
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'");
}

function attr(xml, name) {
  return xml.match(new RegExp(`${name}="([^"]*)"`, "i"))?.[1]
    || xml.match(new RegExp(`${name}='([^']*)'`, "i"))?.[1]
    || "";
}

function columnName(cellRef = "") {
  return String(cellRef).match(/[A-Z]+/i)?.[0] || "";
}

function columnIndex(name) {
  return [...String(name).toUpperCase()].reduce((sum, letter) => sum * 26 + letter.charCodeAt(0) - 64, 0) - 1;
}

function parseZipEntries(buffer) {
  let eocd = -1;
  for (let offset = buffer.length - 22; offset >= 0; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) {
      eocd = offset;
      break;
    }
  }
  if (eocd < 0) throw new Error("Workbook is not a valid XLSX zip file");
  const entries = new Map();
  const count = buffer.readUInt16LE(eocd + 10);
  let centralOffset = buffer.readUInt32LE(eocd + 16);
  for (let index = 0; index < count; index += 1) {
    if (buffer.readUInt32LE(centralOffset) !== 0x02014b50) throw new Error("Invalid XLSX central directory");
    const method = buffer.readUInt16LE(centralOffset + 10);
    const compressedSize = buffer.readUInt32LE(centralOffset + 20);
    const fileNameLength = buffer.readUInt16LE(centralOffset + 28);
    const extraLength = buffer.readUInt16LE(centralOffset + 30);
    const commentLength = buffer.readUInt16LE(centralOffset + 32);
    const localOffset = buffer.readUInt32LE(centralOffset + 42);
    const name = buffer.slice(centralOffset + 46, centralOffset + 46 + fileNameLength).toString("utf8");
    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = buffer.slice(dataOffset, dataOffset + compressedSize);
    const content = method === 8 ? inflateRawSync(compressed) : compressed;
    entries.set(name.replace(/^\/+/, ""), content);
    centralOffset += 46 + fileNameLength + extraLength + commentLength;
  }
  return entries;
}

function parseSharedStrings(xml = "") {
  return [...xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map((match) => {
    const text = [...match[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((part) => decodeXml(part[1])).join("");
    return text;
  });
}

function parseWorkbook(entries) {
  const workbook = entries.get("xl/workbook.xml")?.toString("utf8") || "";
  const rels = entries.get("xl/_rels/workbook.xml.rels")?.toString("utf8") || "";
  const relMap = Object.fromEntries([...rels.matchAll(/<Relationship\b[^>]*>/g)].map((match) => [
    attr(match[0], "Id"),
    attr(match[0], "Target").replace(/^\/?xl\//, ""),
  ]));
  return [...workbook.matchAll(/<sheet\b[^>]*>/g)].map((match) => {
    const relationshipId = attr(match[0], "r:id");
    const target = relMap[relationshipId] || "";
    return {
      name: decodeXml(attr(match[0], "name")),
      path: target.startsWith("xl/") ? target : `xl/${target}`,
    };
  }).filter((sheet) => sheet.name && sheet.path);
}

function parseCellValue(cellXml, sharedStrings) {
  const type = attr(cellXml, "t");
  if (type === "inlineStr") {
    return decodeXml(cellXml.match(/<t\b[^>]*>([\s\S]*?)<\/t>/)?.[1] || "");
  }
  const raw = cellXml.match(/<v\b[^>]*>([\s\S]*?)<\/v>/)?.[1] || "";
  if (type === "s") return sharedStrings[Number(raw)] || "";
  if (type === "b") return raw === "1" ? "TRUE" : "FALSE";
  return decodeXml(raw);
}

function parseWorksheet(xml = "", sharedStrings = []) {
  const table = [];
  for (const rowMatch of xml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)) {
    const rowNumber = Number(attr(rowMatch[1], "r")) || table.length + 1;
    const values = [];
    for (const cellMatch of rowMatch[2].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
      const ref = attr(cellMatch[1], "r");
      const colIndex = columnIndex(columnName(ref));
      values[colIndex] = parseCellValue(`<c ${cellMatch[1]}>${cellMatch[2]}</c>`, sharedStrings);
    }
    table.push({ rowNumber, values });
  }

  const headerRow = table.find((row) => row.values.some((value) => String(value || "").trim()));
  if (!headerRow) return [];
  const headers = headerRow.values.map((value, index) => String(value || `Column ${index + 1}`).trim());
  return table
    .filter((row) => row.rowNumber > headerRow.rowNumber && row.values.some((value) => String(value || "").trim()))
    .map((row) => {
      const record = { __rowNumber: row.rowNumber };
      headers.forEach((header, index) => {
        if (header) record[header] = row.values[index] ?? "";
      });
      return record;
    });
}

function parseCsv(text) {
  const rows = [];
  let current = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"' && text[index + 1] === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      current.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      current.push(cell);
      rows.push(current);
      current = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  if (cell || current.length) {
    current.push(cell);
    rows.push(current);
  }
  const headers = rows.shift()?.map((header, index) => header.trim() || `Column ${index + 1}`) || [];
  return rows
    .filter((row) => row.some((value) => String(value || "").trim()))
    .map((row, index) => Object.fromEntries([
      ["__rowNumber", index + 2],
      ...headers.map((header, column) => [header, row[column] ?? ""]),
    ]));
}

export function parseOrderBookWorkbookFromBase64({ fileName = "order-book.xlsx", dataBase64 = "" } = {}) {
  if (!dataBase64) {
    const error = new Error("dataBase64 is required for order book import");
    error.statusCode = 400;
    throw error;
  }
  const buffer = Buffer.from(dataBase64, "base64");
  if (/\.csv$/i.test(fileName)) {
    return {
      fileName,
      sheets: [{ name: fileName.replace(/\.csv$/i, ""), rows: parseCsv(buffer.toString("utf8")) }],
    };
  }
  if (!/\.xlsx$/i.test(fileName)) {
    const error = new Error("Order book import supports .xlsx and .csv files");
    error.statusCode = 400;
    throw error;
  }
  const entries = parseZipEntries(buffer);
  const sharedStrings = parseSharedStrings(entries.get("xl/sharedStrings.xml")?.toString("utf8") || "");
  const sheets = parseWorkbook(entries).map((sheet) => ({
    name: sheet.name,
    rows: parseWorksheet(entries.get(sheet.path)?.toString("utf8") || "", sharedStrings),
  }));
  return { fileName, sheets };
}
