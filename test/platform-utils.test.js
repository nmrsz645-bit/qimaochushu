const assert = require("assert");
const {
  filterBooksByAddedDate,
  findBooksByTitle,
  findNewBooks,
  filterBooksAlreadyInFeishu,
  chooseManualFeishuBookName,
  duplicateBookTitleKey,
  mergeBooksById,
  normalizeBookTitle,
  parseManualBookIds,
  selectDetectedBooks,
} = require("../src/platform-utils");

function testMergeBooksByIdKeepsFirstSeenOrder() {
  const books = mergeBooksById([
    [{ bookId: "3" }, { bookId: "2" }],
    [{ bookId: "2" }, { bookId: "1" }],
  ]);
  assert.deepStrictEqual(books.map((book) => book.bookId), ["3", "2", "1"]);
}

function testFindNewBooksFiltersSeenIds() {
  const books = findNewBooks([{ bookId: "3" }, { bookId: "2" }, { bookId: "1" }], ["2"]);
  assert.deepStrictEqual(books.map((book) => book.bookId), ["3", "1"]);
}

function testNormalizeBookTitleRemovesPlatformMetadata() {
  assert.strictEqual(normalizeBookTitle("《山月不知岁岁》"), "山月不知岁岁");
  assert.strictEqual(normalizeBookTitle("山月不知岁岁 超短·完结·1.03万字 推荐书籍"), "山月不知岁岁");
  assert.strictEqual(normalizeBookTitle("一腔爱意葬红尘 中短·完结·2.21万字 编辑推荐"), "一腔爱意葬红尘");
}

function testFilterBooksAlreadyInFeishuMatchesBColumnNames() {
  const result = filterBooksAlreadyInFeishu(
    [
      { bookId: "700001", bookName: "山月不知岁岁 超短·完结·1.03万字 推荐书籍" },
      { bookId: "700002", bookName: "未完成的新书 超短·完结·1万字" },
    ],
    ["山月不知岁岁"]
  );
  assert.deepStrictEqual(result.completed.map((book) => book.bookId), ["700001"]);
  assert.deepStrictEqual(result.pending.map((book) => book.bookId), ["700002"]);
}

function testDuplicateBookTitleKeyPrefersPlatformOriginalTitle() {
  assert.strictEqual(
    duplicateBookTitleKey({ bookName: "15今夜港口无灯", originalBookName: "今夜港口无灯" }),
    "今夜港口无灯"
  );
  assert.strictEqual(duplicateBookTitleKey({ bookName: "15今夜港口无灯" }), "今夜港口无灯");
  assert.strictEqual(duplicateBookTitleKey({ bookName: "今夜港口无灯15", originalBookName: "今夜港口无灯" }), "今夜港口无灯");
}

function testSelectDetectedBooksNormallyUsesSeenSet() {
  const books = [{ bookId: "700001" }, { bookId: "700002" }];
  const detected = selectDetectedBooks({ books, seenSet: new Set(["700001"]) });
  assert.deepStrictEqual(detected.map((book) => book.bookId), ["700002"]);
}

function testSelectDetectedBooksCanProcessAllScannedBooks() {
  const books = [{ bookId: "700001" }, { bookId: "700002" }];
  const detected = selectDetectedBooks({ books, seenSet: new Set(["700001"]), processAllScanned: true });
  assert.deepStrictEqual(detected.map((book) => book.bookId), ["700001", "700002"]);
}

function testFilterBooksByAddedDateKeepsOnlyTodayRows() {
  const books = [
    { bookId: "700001", addedTime: "2026-07-07 11:45:04" },
    { bookId: "700002", addedTime: "2026-07-06 23:59:59" },
    { bookId: "700003", addedTime: "" },
  ];
  const todayBooks = filterBooksByAddedDate(books, "2026-07-07");
  assert.deepStrictEqual(todayBooks.map((book) => book.bookId), ["700001"]);
}

function testFindBooksByTitleRequiresAnExactNormalizedMatch() {
  const books = [
    { bookId: "700001", bookName: "山月不知岁岁 超短·完结·1万字" },
    { bookId: "700002", bookName: "山月知岁岁 超短·完结·1万字" },
  ];
  assert.deepStrictEqual(findBooksByTitle(books, "《山月不知岁岁》").map((book) => book.bookId), ["700001"]);
}

function testManualBookIdsAndFeishuTitleSuffixes() {
  assert.deepStrictEqual(parseManualBookIds("700001, 700002\n700001"), ["700001", "700002"]);
  assert.throws(() => parseManualBookIds("700001, abc"), /只能填写数字/);
  const names = new Set(["原书名"]);
  assert.strictEqual(chooseManualFeishuBookName("原书名", names), "《原书名》");
  assert.strictEqual(chooseManualFeishuBookName("原书名", names), "《原书名》-");
  assert.strictEqual(chooseManualFeishuBookName("原书名", names), "《原书名》--");
}

testMergeBooksByIdKeepsFirstSeenOrder();
testFindNewBooksFiltersSeenIds();
testNormalizeBookTitleRemovesPlatformMetadata();
testFilterBooksAlreadyInFeishuMatchesBColumnNames();
testDuplicateBookTitleKeyPrefersPlatformOriginalTitle();
testSelectDetectedBooksNormallyUsesSeenSet();
testSelectDetectedBooksCanProcessAllScannedBooks();
testFilterBooksByAddedDateKeepsOnlyTodayRows();
testFindBooksByTitleRequiresAnExactNormalizedMatch();
testManualBookIdsAndFeishuTitleSuffixes();
console.log("platform-utils tests passed");
