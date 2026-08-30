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
  return String(title || "")
    .replace(/[《》]/g, "")
    .replace(/\s+(超短|中短|短篇|长篇|中篇)·.*$/, "")
    .replace(/\s+/g, " ")
    .trim();
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
  findNewBooks,
  mergeBooksById,
  normalizeBookTitle,
  selectDetectedBooks,
};
