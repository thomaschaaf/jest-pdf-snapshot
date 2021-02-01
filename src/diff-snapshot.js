const fs = require('fs');
const path = require('path');
const tmp = require('tmp');
const ComparePdf = require('compare-pdf');

const DIFF_OUTPUT_DIR = '__diff_output__';


async function defaultIsSamePdf(source, target) {
  const comparisonResult = await new ComparePdf({
    paths: {
      actualPdfRootFolder: process.cwd() + '/.compare-pdf/actualPdfs',
      baselinePdfRootFolder: process.cwd() + '/.compare-pdf/baselinePdfs',
      actualPngRootFolder: process.cwd() + '/.compare-pdf/actualPngs',
      baselinePngRootFolder: process.cwd() + '/.compare-pdf/baselinePngs',
      diffPngRootFolder: process.cwd() + '/.compare-pdf/diffPngs',
    },
    settings: {
      imageEngine: 'native',
    },
  })
    .actualPdfFile(source)
    .baselinePdfFile(target)
    .compare();

  return comparisonResult.status === 'passed';
}

async function defaultGenerateDiff(source, target, diffOutput) {
  return fs.writeFileSync(diffOutput, fs.readFileSync(source));
}

async function diffPdfToSnapshot({
  pdfBuffer,
  snapshotDir,
  snapshotIdentifier,
  updateSnapshot,
  addSnapshot,
}, {
  isSamePdf = defaultIsSamePdf,
  generateDiff = defaultGenerateDiff,
} = {}) {
  const snapshotPath = path.join(snapshotDir, `${snapshotIdentifier}.pdf`);

  if (updateSnapshot) {
    const snapshotFd = fs.openSync(snapshotPath, 'w');
    fs.writeSync(snapshotFd, pdfBuffer);

    return {
      pass: true,
      updated: true,
      added: false,
    };
  }

  if (!fs.existsSync(snapshotPath)) {
    if (addSnapshot) {
      const snapshotFd = fs.openSync(snapshotPath, 'w');
      fs.writeSync(snapshotFd, pdfBuffer);

      return {
        pass: true,
        updated: false,
        added: true,
      };
    }

    return {
      pass: false,
      failureType: 'EmptySnapshot',
    };
  }

  const tmpFile = tmp.fileSync();
  fs.writeSync(tmpFile.fd, pdfBuffer);

  if (!await isSamePdf(tmpFile.name, snapshotPath)) {
    const diffOutputDir = path.join(snapshotDir, DIFF_OUTPUT_DIR);

    if (!fs.existsSync(diffOutputDir)) {
      fs.mkdirSync(diffOutputDir);
    }

    const diffOutputPath = path.join(diffOutputDir, `${snapshotIdentifier}-diff.pdf`);

    await generateDiff(tmpFile.name, snapshotPath, diffOutputPath);

    tmpFile.removeCallback();

    return {
      pass: false,
      failureType: 'MismatchSnapshot',
      diffOutputPath,
    };
  }

  tmpFile.removeCallback();

  return {
    pass: true,
    updated: false,
    added: false,
  };
}

module.exports = {
  diffPdfToSnapshot,
};
