(async function runImporterTests() {
  const results = [];

  function assert(condition, message) {
    if (!condition) {
      throw new Error(message);
    }
  }

  async function expectError(action, fragment) {
    try {
      await action();
    } catch (error) {
      assert(error.message.toLowerCase().includes(fragment.toLowerCase()), `Expected error containing "${fragment}", received "${error.message}"`);
      return;
    }
    throw new Error(`Expected an error containing "${fragment}".`);
  }

  async function makeZip(name, entries) {
    const zip = new JSZip();
    Object.entries(entries).forEach(([path, contents]) => zip.file(path, contents));
    const blob = await zip.generateAsync({ type: 'blob' });
    return new File([blob], name, { type: 'application/zip' });
  }

  async function makeEncryptedZip() {
    const zipFile = await makeZip('encrypted.zip', { 'Chat.txt': 'Priya: Hello' });
    const bytes = new Uint8Array(await zipFile.arrayBuffer());
    const view = new DataView(bytes.buffer);
    for (let offset = 0; offset <= bytes.length - 4; offset += 1) {
      if (view.getUint32(offset, true) === 0x02014b50) {
        view.setUint16(offset + 8, view.getUint16(offset + 8, true) | 1, true);
        return new File([bytes], 'encrypted.zip', { type: 'application/zip' });
      }
    }
    throw new Error('Test ZIP did not contain a central directory record.');
  }

  async function makeDocx() {
    return makeZip('conversation.docx', {
      '[Content_Types].xml': '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>',
      'word/document.xml': '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Priya: Please review the report by Friday.</w:t></w:r></w:p><w:p><w:r><w:t>Rahul: We agreed to the plan.</w:t></w:r></w:p></w:body></w:document>',
    });
  }

  function makePdf(text) {
    const stream = text
      ? `BT /F1 12 Tf 20 200 Td (${text.replace(/[()\\]/g, '\\$&')}) Tj ET`
      : 'q Q';
    const objects = [
      '<< /Type /Catalog /Pages 2 0 R >>',
      '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 300] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
      `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    ];
    let pdf = '%PDF-1.4\n';
    const offsets = [0];
    objects.forEach((object, index) => {
      offsets.push(pdf.length);
      pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
    });
    const xrefOffset = pdf.length;
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    offsets.slice(1).forEach((offset) => {
      pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
    });
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
    return new File([pdf], 'conversation.pdf', { type: 'application/pdf' });
  }

  async function test(name, action) {
    try {
      await action();
      results.push({ name, passed: true });
    } catch (error) {
      results.push({ name, passed: false, message: error.message });
    }
  }

  await test('TXT imports text as-is', async () => {
    const result = await ConversationFileImporter.extract(new File(['Priya: Hello'], 'chat.txt'));
    assert(result.text === 'Priya: Hello', 'TXT contents were changed.');
  });
  await test('TXT rejects empty content', () => expectError(
    () => ConversationFileImporter.extract(new File([' \n'], 'empty.txt')),
    'empty',
  ));
  await test('TXT rejects invalid UTF-8 bytes', () => expectError(
    () => ConversationFileImporter.extract(new File([new Uint8Array([0xff, 0xfe, 0xff])], 'binary.txt')),
    'valid UTF-8',
  ));
  await test('extracted text limit is enforced', () => expectError(
    () => ConversationFileImporter.extract(new File(['a'.repeat(5 * 1024 * 1024 + 1)], 'too-much-text.txt')),
    'extracted text is larger than 5 MB',
  ));
  await test('unsupported extension is rejected', () => expectError(
    () => ConversationFileImporter.extract(new File(['x'], 'chat.rtf')),
    'Unsupported file type',
  ));
  await test('oversized file is rejected', () => expectError(
    () => ConversationFileImporter.extract(new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'large.txt')),
    'larger than 10 MB',
  ));
  await test('ZIP selects its chat TXT and ignores non-TXT files', async () => {
    const file = await makeZip('whatsapp.zip', { 'Chat.txt': 'Priya: Hello', 'image.jpg': 'not a chat' });
    const result = await ConversationFileImporter.extract(file);
    assert(result.kind === 'text' && result.filename === 'Chat.txt' && result.text === 'Priya: Hello', 'ZIP chat text was not extracted.');
  });
  await test('ZIP asks user to choose when multiple TXT files exist', async () => {
    const file = await makeZip('multiple.zip', { 'Chat.txt': 'Priya: Hello', 'Readme.txt': 'Ananya: Notes' });
    const result = await ConversationFileImporter.extract(file);
    assert(result.kind === 'zip-selection' && result.entries.length === 2, 'Multiple TXT entries were not offered for selection.');
    assert(await result.extract('Chat.txt') === 'Priya: Hello', 'Selected ZIP entry was not extracted.');
  });
  await test('ZIP rejects archives without TXT files', async () => {
    const file = await makeZip('media.zip', { 'photo.jpg': 'binary' });
    await expectError(() => ConversationFileImporter.extract(file), 'No chat .txt file');
  });
  await test('ZIP rejects corrupted archives', () => expectError(
    () => ConversationFileImporter.extract(new File(['not a zip'], 'broken.zip')),
    'ZIP file is damaged',
  ));
  await test('ZIP reports encrypted archives', async () => {
    const file = await makeEncryptedZip();
    await expectError(() => ConversationFileImporter.extract(file), 'encrypted');
  });
  await test('PDF extracts selectable text', async () => {
    const result = await ConversationFileImporter.extract(makePdf('Priya: Review the draft.'));
    assert(result.text.includes('Priya: Review the draft.'), 'PDF text was not extracted.');
  });
  await test('PDF reports scanned or image-only documents', () => expectError(
    () => ConversationFileImporter.extract(makePdf('')),
    'OCR is not supported',
  ));
  await test('PDF rejects corrupted files', () => expectError(
    () => ConversationFileImporter.extract(new File(['not a pdf'], 'broken.pdf')),
    'corrupted',
  ));
  await test('PDF reports the password-protected file error', async () => {
    const originalPdfJs = window.pdfjsLib;
    window.pdfjsLib = {
      GlobalWorkerOptions: {},
      getDocument: () => ({
        promise: Promise.reject(Object.assign(new Error('Password required'), { name: 'PasswordException' })),
      }),
    };
    try {
      await expectError(
        () => ConversationFileImporter.extract(new File(['%PDF-1.4'], 'locked.pdf')),
        'password-protected',
      );
    } finally {
      window.pdfjsLib = originalPdfJs;
    }
  });
  await test('DOCX extracts paragraph text', async () => {
    const result = await ConversationFileImporter.extract(await makeDocx());
    assert(result.text.includes('Priya: Please review the report by Friday.'), 'DOCX paragraph was not extracted.');
    assert(result.text.includes('Rahul: We agreed to the plan.'), 'DOCX second paragraph was not extracted.');
  });
  await test('DOCX rejects corrupted files', () => expectError(
    () => ConversationFileImporter.extract(new File(['bad archive'], 'broken.docx')),
    'ZIP file is damaged',
  ));
  await test('DOCX reports documents without text', async () => {
    const file = await makeZip('empty.docx', {
      'word/document.xml': '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body></w:body></w:document>',
    });
    await expectError(() => ConversationFileImporter.extract(file), 'No readable text');
  });
  await test('CSV maps sender, timestamp, and message columns', async () => {
    const source = 'Timestamp,Sender,Message\n"10/09/26, 2:30 PM",Priya,"Please review, then reply."\n';
    const result = await ConversationFileImporter.extract(new File([source], 'chat.csv'));
    assert(result.text.includes('[10/09/26, 2:30 PM] Priya: Please review, then reply.'), 'CSV columns were not converted to chat lines.');
  });
  await test('CSV supports semicolon-delimited exports', async () => {
    const result = await ConversationFileImporter.extract(new File(['Sender;Message\nPriya;Please review the report.'], 'chat.csv'));
    assert(result.text === 'Priya: Please review the report.', 'Semicolon-delimited values were not converted.');
  });
  await test('CSV asks for clear message columns', () => expectError(
    () => ConversationFileImporter.extract(new File(['Name,Note\nPriya,Hello'], 'ambiguous.csv')),
    'Could not identify a message/text column',
  ));
  await test('CSV rejects multiple possible message columns', () => expectError(
    () => ConversationFileImporter.extract(new File(['Sender,Message,Body\nPriya,Hello,Hi'], 'ambiguous.csv')),
    'more than one possible message/text column',
  ));
  await test('CSV rejects unclosed quoted fields', () => expectError(
    () => ConversationFileImporter.extract(new File(['Sender,Message\nPriya,"broken'], 'broken.csv')),
    'unclosed quoted field',
  ));
  await test('CSV rejects empty content with a clear message', () => expectError(
    () => ConversationFileImporter.extract(new File([' \n'], 'empty.csv')),
    'empty',
  ));
  await test('JSON supports messages array', async () => {
    const source = JSON.stringify({ messages: [{ sender: 'Priya', text: 'Please review the report.', timestamp: 'today' }] });
    const result = await ConversationFileImporter.extract(new File([source], 'chat.json'));
    assert(result.text === '[today] Priya: Please review the report.', 'JSON message fields were not converted.');
  });
  await test('JSON rejects unsupported structures', () => expectError(
    () => ConversationFileImporter.extract(new File(['{"settings":{"theme":"dark"}}'], 'settings.json')),
    'structure is not supported',
  ));
  await test('JSON rejects malformed syntax', () => expectError(
    () => ConversationFileImporter.extract(new File(['{"messages":'], 'broken.json')),
    'invalid or corrupted',
  ));
  await test('JSON rejects empty content with a clear message', () => expectError(
    () => ConversationFileImporter.extract(new File([' \n'], 'empty.json')),
    'empty',
  ));

  const list = document.getElementById('testResults');
  results.forEach((result) => {
    const item = document.createElement('li');
    item.className = result.passed ? 'pass' : 'fail';
    item.textContent = `${result.passed ? 'PASS' : 'FAIL'} — ${result.name}${result.message ? `: ${result.message}` : ''}`;
    list.appendChild(item);
  });
  const passedCount = results.filter((result) => result.passed).length;
  document.getElementById('summary').textContent = `${passedCount}/${results.length} tests passed.`;
  document.documentElement.dataset.testStatus = passedCount === results.length ? 'passed' : 'failed';
}());
