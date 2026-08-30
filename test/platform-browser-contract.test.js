const assert = require("assert");
const fs = require("fs");
const path = require("path");

// Offline contract test: warns on refactors that remove selectors required by the manual live smoke check.
const source = fs.readFileSync(path.join(__dirname, "..", "src", "run-once.js"), "utf8");

function testBrowserSmokeContractUsesAllLibraryAndFirstPage() {
  assert.match(source, /getByText\("全部书库",\s*\{ exact: true \}\)/);
  assert.match(source, /\.ant-pagination-item-1/);
  assert.match(source, /\.ant-pagination-next/);
}

function testBrowserSmokeContractCanSearchBookId() {
  assert.match(source, /input\[placeholder="书籍ID"\]/);
  assert.match(source, /书籍ID 查询后没有找到/);
}

function testBrowserSmokeContractReadsRequiredColumns() {
  assert.match(source, /添加时间/);
  assert.match(source, /书籍ID/);
  assert.match(source, /原书名/);
}

testBrowserSmokeContractUsesAllLibraryAndFirstPage();
testBrowserSmokeContractCanSearchBookId();
testBrowserSmokeContractReadsRequiredColumns();
console.log("platform-browser-contract tests passed");
