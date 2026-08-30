const { normalizeOutputBookTitle } = require("./compliance-topic-utils");

function mergeBooksById(pages) {
  const map = new Map();
  for (const books of pages) {
    for (const book of books) {
      if (book && book.bookId && !map.has(book.bookId)) map.set(book.bookId, book);
    }
  }
  return Array.from(map.values());
}

function findNewBooks(scannedBooks, seenIds) {
  const seen = new Set(seenIds || []);
  return scannedBooks.filter((book) => book.bookId && !seen.has(book.bookId));
}

function addedDateOf(book) {
  return String((book && (book.addedTime || book.addedDate)) || "").slice(0, 10);
}

function filterBooksByAddedDate(books, today) {
  const date = String(today || "").slice(0, 10);
  if (!date) return [];
  return (books || []).filter((book) => book && book.bookId && addedDateOf(book) === date);
}

function selectDetectedBooks({ books, seenSet, singleBookId = "", processAllScanned = false }) {
  const list = books || [];
  if (singleBookId) {
    const matches = list.filter((book) => book.bookId === singleBookId);
    return matches.length ? matches : [{ bookId: singleBookId, bookName: "" }];
  }
  if (processAllScanned) return list.filter((book) => book.bookId);
  return findNewBooks(list, seenSet || []);
}

function normalizeBookTitle(title) {
  return normalizeOutputBookTitle(title)
    .replace(/[《》]/g, "")
    .replace(/\s+(超短|中短|短篇|长篇|中篇)·.*$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function duplicateBookTitleKey(book) {
  const originalTitle = String(book && (book.originalBookName || book.originalTitle) || "").trim();
  const title = normalizeBookTitle(originalTitle || (book && book.bookName));
  return originalTitle ? title : title.replace(/^\d+/, "").trim();
}

function findBooksByTitle(books, title) {
  const expected = normalizeBookTitle(title);
  if (!expected) return [];
  return (books || []).filter((book) => normalizeBookTitle(book && book.bookName) === expected);
}

function parseManualBookIds(value) {
  const values = String(value || "")
    .split(/[\s,，;；]+/)
    .map((item) => item.trim())
    .filter(Boolean);
  const invalid = values.filter((item) => !/^\d+$/.test(item));
  if (invalid.length) throw new Error(`批量书籍ID只能填写数字：${invalid.join("、")}`);
  return Array.from(new Set(values));
}

function chooseManualFeishuBookName(bookName, existingNames) {
  const title = normalizeBookTitle(bookName);
  if (!title) return bookName;
  const names = existingNames || new Set();
  const normalizedNames = new Set(Array.from(names).map(normalizeBookTitle).filter(Boolean));
  if (!normalizedNames.has(title)) {
    names.add(title);
    return title;
  }
  let candidate = `《${title}》`;
  while (names.has(candidate)) candidate += "-";
  names.add(candidate);
  return candidate;
}

function filterBooksAlreadyInFeishu(books, feishuBookNames) {
  const completedNames = new Set((feishuBookNames || []).map(normalizeBookTitle).filter(Boolean));
  const completed = [];
  const pending = [];
  for (const book of books) {
    if (completedNames.has(normalizeBookTitle(book.bookName))) {
      completed.push(book);
    } else {
      pending.push(book);
    }
  }
  return { completed, pending };
}

module.exports = {
  filterBooksAlreadyInFeishu,
  filterBooksByAddedDate,
  chooseManualFeishuBookName,
  findBooksByTitle,
  findNewBooks,
  duplicateBookTitleKey,
  mergeBooksById,
  normalizeBookTitle,
  parseManualBookIds,
  selectDetectedBooks,
};
