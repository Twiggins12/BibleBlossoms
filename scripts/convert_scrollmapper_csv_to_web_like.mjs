import fs from "node:fs";
import path from "node:path";

function parseCSVLine(line) {
  // Handles commas + quotes in CSV safely enough for the scrollmapper format
  const out = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      // double quote inside quoted field
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map(s => s.trim());
}

function ensureBook(booksByName, order, name) {
  if (!booksByName.has(name)) {
    booksByName.set(name, {
      name,
      commonName: name,
      order: order.length + 1,
      chapters: []
    });
    order.push(name);
  }
  return booksByName.get(name);
}

function ensureChapter(book, chapterNum) {
  let ch = book.chapters.find(c => c.number === chapterNum);
  if (!ch) {
    ch = { number: chapterNum, content: [] };
    book.chapters.push(ch);
    book.chapters.sort((a, b) => a.number - b.number);
  }
  return ch;
}

function ensureVerse(chapter, verseNum, text) {
  let v = chapter.content.find(x => x.number === verseNum);
  if (!v) {
    v = { number: verseNum, content: [text] };
    chapter.content.push(v);
    chapter.content.sort((a, b) => a.number - b.number);
  } else {
    v.content = [text];
  }
}

function convertCSV(csvText) {
  const lines = csvText.split(/\r?\n/).filter(Boolean);
  const header = parseCSVLine(lines[0]).map(h => h.toLowerCase());

  const idxBook = header.findIndex(h => h === "book");
  const idxChapter = header.findIndex(h => h === "chapter");
  const idxVerse = header.findIndex(h => h === "verse");
  const idxText = header.findIndex(h => h === "text");

  if ([idxBook, idxChapter, idxVerse, idxText].some(i => i < 0)) {
    throw new Error(`CSV header must include Book,Chapter,Verse,Text. Got: ${lines[0]}`);
  }

  const booksByName = new Map();
  const order = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    const bookName = cols[idxBook];
    const chapterNum = Number(cols[idxChapter]);
    const verseNum = Number(cols[idxVerse]);
    const text = cols[idxText] ?? "";

    if (!bookName || !Number.isFinite(chapterNum) || !Number.isFinite(verseNum)) continue;

    const book = ensureBook(booksByName, order, bookName);
    const chapter = ensureChapter(book, chapterNum);
    ensureVerse(chapter, verseNum, text);
  }

  // Final array in insertion order
  const books = order.map(name => booksByName.get(name));
  return { books };
}

// ---- CLI usage ----
// node scripts/convert_scrollmapper_csv_to_web_like.mjs input.csv output.json
const [,, inFile, outFile] = process.argv;
if (!inFile || !outFile) {
  console.error("Usage: node scripts/convert_scrollmapper_csv_to_web_like.mjs <input.csv> <output.json>");
  process.exit(1);
}

const csvText = fs.readFileSync(inFile, "utf8");
const outObj = convertCSV(csvText);
fs.writeFileSync(outFile, JSON.stringify(outObj, null, 2), "utf8");
console.log("Wrote", outFile, "books:", outObj.books.length);
