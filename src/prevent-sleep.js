const { execFileSync } = require("child_process");

function runPowercfg(args) {
  execFileSync("powercfg.exe", args, { stdio: "inherit" });
}

function main() {
  runPowercfg(["/change", "standby-timeout-ac", "0"]);
  runPowercfg(["/change", "hibernate-timeout-ac", "0"]);
  runPowercfg(["/change", "monitor-timeout-ac", "0"]);
  console.log("已设置插电时不睡眠、不休眠、不关屏。");
}

main();
