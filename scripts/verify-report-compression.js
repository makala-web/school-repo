const fs = require('fs')
const ts = require('typescript')
const vm = require('vm')

const source = fs.readFileSync('src/lib/print-templates.ts', 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
}).outputText

const sandbox = { exports: {}, module: { exports: {} }, console }
sandbox.exports = sandbox.module.exports
vm.runInNewContext(compiled, sandbox)

const { getReportCardCompression } = sandbox.module.exports

for (const subjectCount of [6, 9, 10, 11, 12, 13]) {
  const result = getReportCardCompression({
    isSecondary: true,
    subjectCount,
    longestSubjectLength: 42,
    commentLength: 210,
    hasTabia: true,
  })

  console.log(
    subjectCount,
    result.className,
    result.styleVars['--report-font-size'] || 'no-vars',
    result.styleVars['--report-table-cell-y'] || 'no-vars'
  )
}
