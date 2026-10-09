(function exposeConversationFileImporter(global) {
  const IMPORTER_BASE_URL = new URL('.', document.currentScript.src);
  const MAX_FILE_BYTES = 10 * 1024 * 1024;
  const MAX_TEXT_BYTES = 5 * 1024 * 1024;
  const MAX_ZIP_EXPANDED_BYTES = 30 * 1024 * 1024;
  const MAX_ZIP_ENTRIES = 3000;
  const MAX_PDF_PAGES = 200;
  const SUPPORTED_EXTENSIONS = new Set(['txt', 'zip', 'pdf', 'docx', 'csv', 'json']);
  const XML_NAMESPACE = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

  function getExtension(filename) {
    const match = String(filename).toLowerCase().match(/\.([^.]+)$/);
    return match ? match[1] : '';
  }

  function validateFile(file) {
    const extension = getExtension(file.name);
    if (!SUPPORTED_EXTENSIONS.has(extension)) {
      throw new Error('Unsupported file type. Choose a TXT, ZIP, PDF, DOCX, CSV, or JSON file.');
    }
    if (file.size > MAX_FILE_BYTES) {
      throw new Error('This file is larger than 10 MB. Choose a smaller file and try again.');
    }
    if (file.size === 0) {
      throw new Error('This file is empty. Choose a file that contains conversation text.');
    }
    return extension;
  }

  function validateText(text) {
    if (!text.trim()) {
      throw new Error('No readable text was found in this file.');
    }
    if (new Blob([text]).size > MAX_TEXT_BYTES) {
      throw new Error('The extracted text is larger than 5 MB. Choose a smaller conversation file.');
    }
    return text;
  }

  function decodeUtf8(bytes) {
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      throw new Error('This file is not valid UTF-8 text. Export or save it as UTF-8 and try again.');
    }
  }

  async function readUtf8File(file) {
    const contents = decodeUtf8(new Uint8Array(await file.arrayBuffer()));
    if (!contents.trim()) {
      throw new Error('This file is empty. Choose a file that contains conversation text.');
    }
    return contents;
  }

  async function readZipDirectory(file) {
    const buffer = await file.arrayBuffer();
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);
    const minOffset = Math.max(0, bytes.length - 22 - 65535);
    let endOffset = -1;

    for (let offset = bytes.length - 22; offset >= minOffset; offset -= 1) {
      if (view.getUint32(offset, true) === 0x06054b50) {
        endOffset = offset;
        break;
      }
    }
    if (endOffset < 0) {
      throw new Error('This ZIP file is damaged or uses an unsupported archive format.');
    }

    const entryCount = view.getUint16(endOffset + 10, true);
    const directoryOffset = view.getUint32(endOffset + 16, true);
    if (entryCount === 0xffff || directoryOffset === 0xffffffff) {
      throw new Error('ZIP64 archives are not supported yet. Re-export this chat as a standard ZIP file.');
    }
    if (entryCount > MAX_ZIP_ENTRIES || directoryOffset >= endOffset) {
      throw new Error('This ZIP archive has an invalid or unsupported directory.');
    }

    const entries = [];
    let expandedSize = 0;
    let offset = directoryOffset;
    for (let index = 0; index < entryCount; index += 1) {
      if (offset + 46 > bytes.length || view.getUint32(offset, true) !== 0x02014b50) {
        throw new Error('This ZIP file has a damaged directory and cannot be opened.');
      }

      const flags = view.getUint16(offset + 8, true);
      const uncompressedSize = view.getUint32(offset + 24, true);
      const filenameLength = view.getUint16(offset + 28, true);
      const extraLength = view.getUint16(offset + 30, true);
      const commentLength = view.getUint16(offset + 32, true);
      const recordEnd = offset + 46 + filenameLength + extraLength + commentLength;
      if (recordEnd > bytes.length || uncompressedSize === 0xffffffff) {
        throw new Error('This ZIP file has an invalid or unsupported directory.');
      }
      if (flags & 0x0001) {
        throw new Error('This ZIP archive is encrypted. Remove the password protection and try again.');
      }

      const filenameBytes = bytes.subarray(offset + 46, offset + 46 + filenameLength);
      const name = new TextDecoder('utf-8').decode(filenameBytes);
      expandedSize += uncompressedSize;
      if (expandedSize > MAX_ZIP_EXPANDED_BYTES) {
        throw new Error('This ZIP expands to more than 30 MB. Choose a smaller export.');
      }
      entries.push({ name, uncompressedSize, isDirectory: name.endsWith('/') });
      offset = recordEnd;
    }

    return { buffer, entries };
  }

  async function loadZip(file) {
    if (!global.JSZip) {
      throw new Error('The local ZIP reader is missing. Restore the bundled vendor files and reload the page.');
    }
    try {
      const directory = await readZipDirectory(file);
      const archive = await global.JSZip.loadAsync(directory.buffer, { checkCRC32: false });
      return { archive, entries: directory.entries };
    } catch (error) {
      if (error instanceof Error && /encrypted|30 MB|ZIP64|directory|damaged/.test(error.message)) {
        throw error;
      }
      throw new Error('This ZIP file is corrupted or uses an unsupported compression method.');
    }
  }

  async function readTextEntry(archive, entry) {
    if (entry.uncompressedSize > MAX_TEXT_BYTES) {
      throw new Error('The selected text file inside the ZIP is larger than 5 MB.');
    }
    const zipEntry = archive.file(entry.name);
    if (!zipEntry || zipEntry.dir) {
      throw new Error('The selected text file could not be found inside the ZIP.');
    }
    try {
      return validateText(await zipEntry.async('string'));
    } catch (error) {
      if (error instanceof Error && /larger than|readable text/.test(error.message)) {
        throw error;
      }
      throw new Error(`Could not extract "${entry.name}" from the ZIP. The archive may be corrupted.`);
    }
  }

  async function prepareZip(file) {
    const { archive, entries } = await loadZip(file);
    const textEntries = entries.filter((entry) => (
      !entry.isDirectory
      && /\.txt$/i.test(entry.name)
      && !/(?:^|\/)__macosx\//i.test(entry.name)
      && !/(?:^|\/)\._[^/]+$/.test(entry.name)
    ));
    if (!textEntries.length) {
      throw new Error('No chat .txt file was found in this ZIP. Media files are not imported.');
    }
    if (textEntries.length === 1) {
      return {
        kind: 'text',
        text: await readTextEntry(archive, textEntries[0]),
        filename: textEntries[0].name,
      };
    }
    return {
      kind: 'zip-selection',
      entries: textEntries.map(({ name, uncompressedSize }) => ({ name, uncompressedSize })),
      extract: (name) => {
        const selected = textEntries.find((entry) => entry.name === name);
        if (!selected) {
          throw new Error('Choose a .txt file from the ZIP before importing.');
        }
        return readTextEntry(archive, selected);
      },
    };
  }

  function detectCsvDelimiter(source) {
    const counts = new Map([['\t', 0], [',', 0], [';', 0]]);
    let inQuotes = false;
    for (let index = 0; index < source.length; index += 1) {
      const char = source[index];
      if (char === '"' && inQuotes && source[index + 1] === '"') {
        index += 1;
      } else if (char === '"') {
        inQuotes = !inQuotes;
      } else if (!inQuotes && (char === '\r' || char === '\n')) {
        break;
      } else if (!inQuotes && counts.has(char)) {
        counts.set(char, counts.get(char) + 1);
      }
    }
    const [delimiter, count] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    return count ? delimiter : ',';
  }

  function parseCsv(source, delimiter) {
    const rows = [];
    let row = [];
    let field = '';
    let inQuotes = false;

    for (let index = 0; index < source.length; index += 1) {
      const char = source[index];
      if (inQuotes) {
        if (char === '"' && source[index + 1] === '"') {
          field += '"';
          index += 1;
        } else if (char === '"') {
          inQuotes = false;
        } else {
          field += char;
        }
      } else if (char === '"' && field.length === 0) {
        inQuotes = true;
      } else if (char === delimiter) {
        row.push(field);
        field = '';
      } else if (char === '\n' || char === '\r') {
        row.push(field);
        if (row.some((cell) => cell.trim())) {
          rows.push(row);
        }
        row = [];
        field = '';
        if (char === '\r' && source[index + 1] === '\n') {
          index += 1;
        }
      } else {
        field += char;
      }
    }
    if (inQuotes) {
      throw new Error('This CSV has an unclosed quoted field and appears to be corrupted.');
    }
    row.push(field);
    if (row.some((cell) => cell.trim())) {
      rows.push(row);
    }
    return rows;
  }

  function normalizeHeader(value) {
    return value.replace(/^\uFEFF/, '').trim().toLowerCase().replace(/[\s_-]+/g, '');
  }

  function findColumn(headers, aliases, label, required) {
    const candidates = [];
    headers.forEach((header, index) => {
      const normalized = normalizeHeader(header);
      const aliasIndex = aliases.indexOf(normalized);
      if (aliasIndex !== -1) {
        candidates.push({ index, aliasIndex });
      }
    });
    candidates.sort((a, b) => a.aliasIndex - b.aliasIndex);
    if (!candidates.length) {
      if (required) {
        throw new Error(`Could not identify a ${label} column in this CSV. Use a header such as Message, Text, Body, or Content.`);
      }
      return -1;
    }
    if (candidates.length > 1 && label === 'message/text') {
      throw new Error('This CSV has more than one possible message/text column. Keep one clearly named column and try again.');
    }
    return candidates[0].index;
  }

  function csvToText(source) {
    const rows = parseCsv(source, detectCsvDelimiter(source));
    if (rows.length < 2) {
      throw new Error('This CSV needs a header row and at least one message row.');
    }

    const headers = rows[0];
    const messageColumn = findColumn(headers, ['message', 'text', 'body', 'content', 'messagetext', 'chatmessage'], 'message/text', true);
    const senderColumn = findColumn(headers, ['sender', 'author', 'from', 'participant', 'name', 'username'], 'sender', false);
    const timestampColumn = findColumn(headers, ['timestamp', 'datetime', 'createdat'], 'timestamp', false);
    const dateColumn = findColumn(headers, ['date'], 'date', false);
    const timeColumn = findColumn(headers, ['time'], 'time', false);

    const messages = rows.slice(1).map((cells) => {
      const text = (cells[messageColumn] || '').trim();
      if (!text) {
        return '';
      }
      const sender = senderColumn >= 0 ? (cells[senderColumn] || '').trim() : '';
      const timestamp = timestampColumn >= 0
        ? (cells[timestampColumn] || '').trim()
        : [dateColumn >= 0 ? (cells[dateColumn] || '').trim() : '', timeColumn >= 0 ? (cells[timeColumn] || '').trim() : ''].filter(Boolean).join(' ');
      const prefix = timestamp ? `[${timestamp}] ` : '';
      return `${prefix}${sender || 'Conversation'}: ${text}`;
    }).filter(Boolean);

    return validateText(messages.join('\n'));
  }

  function firstValue(record, keys) {
    for (const key of keys) {
      if (record[key] !== undefined && record[key] !== null && record[key] !== '') {
        return record[key];
      }
    }
    return '';
  }

  function scalarText(value) {
    if (typeof value === 'string' || typeof value === 'number') {
      return String(value).trim();
    }
    if (value && typeof value === 'object') {
      return scalarText(firstValue(value, ['name', 'displayName', 'username', 'id']));
    }
    return '';
  }

  function jsonRecords(value) {
    if (Array.isArray(value)) {
      return value;
    }
    if (!value || typeof value !== 'object') {
      return [];
    }
    if (Array.isArray(value.messages)) {
      return value.messages;
    }
    if (value.conversation && Array.isArray(value.conversation.messages)) {
      return value.conversation.messages;
    }
    if (value.chat && Array.isArray(value.chat.messages)) {
      return value.chat.messages;
    }
    if (value.data && Array.isArray(value.data.messages)) {
      return value.data.messages;
    }
    if (Array.isArray(value.chats)) {
      const chats = value.chats.filter((chat) => chat && Array.isArray(chat.messages));
      if (chats.length) {
        return chats.flatMap((chat) => chat.messages);
      }
    }
    if (firstValue(value, ['text', 'message', 'body', 'content']) !== '') {
      return [value];
    }
    return [];
  }

  function jsonToText(source) {
    let parsed;
    try {
      parsed = JSON.parse(source);
    } catch {
      throw new Error('This JSON file is invalid or corrupted. Check its brackets, quotes, and commas.');
    }
    const records = jsonRecords(parsed);
    if (!records.length) {
      throw new Error('This JSON structure is not supported. Use a message array or an object containing a messages array with text/message/body fields.');
    }

    const messages = records.map((record) => {
      if (typeof record === 'string' || typeof record === 'number') {
        return `Conversation: ${String(record).trim()}`;
      }
      if (!record || typeof record !== 'object' || Array.isArray(record)) {
        return '';
      }
      const text = scalarText(firstValue(record, ['text', 'message', 'body', 'content', 'caption']));
      if (!text) {
        return '';
      }
      const sender = scalarText(firstValue(record, ['sender', 'author', 'from', 'participant', 'name', 'username'])) || 'Conversation';
      const timestamp = scalarText(firstValue(record, ['timestamp', 'datetime', 'date', 'time', 'created_at']));
      return `${timestamp ? `[${timestamp}] ` : ''}${sender}: ${text}`;
    }).filter(Boolean);

    if (!messages.length) {
      throw new Error('No message text was found in the JSON records. Expected a text, message, body, or content field.');
    }
    return validateText(messages.join('\n'));
  }

  async function docxToText(file) {
    const { archive, entries } = await loadZip(file);
    const documentEntry = entries.find((entry) => entry.name === 'word/document.xml');
    if (documentEntry && documentEntry.uncompressedSize > MAX_TEXT_BYTES) {
      throw new Error('This DOCX document content is larger than 5 MB. Choose a smaller document.');
    }
    const documentXml = archive.file('word/document.xml');
    if (!documentXml) {
      throw new Error('This DOCX is missing its main document content and may be corrupted.');
    }
    const xmlText = await documentXml.async('string');
    const document = new DOMParser().parseFromString(xmlText, 'application/xml');
    if (document.querySelector('parsererror')) {
      throw new Error('This DOCX contains invalid document XML and cannot be read.');
    }

    const paragraphs = Array.from(document.getElementsByTagNameNS(XML_NAMESPACE, 'p')).map((paragraph) => {
      let text = '';
      Array.from(paragraph.getElementsByTagNameNS(XML_NAMESPACE, '*')).forEach((node) => {
        if (node.localName === 't') {
          text += node.textContent || '';
        } else if (node.localName === 'tab') {
          text += '\t';
        } else if (node.localName === 'br' || node.localName === 'cr') {
          text += '\n';
        }
      });
      return text.trim();
    }).filter(Boolean);

    return validateText(paragraphs.join('\n'));
  }

  async function pdfToText(file) {
    if (!global.pdfjsLib) {
      throw new Error('The local PDF reader is missing. Restore the bundled vendor files and reload the page.');
    }
    global.pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('vendor/pdf.worker.min.js', IMPORTER_BASE_URL).href;

    let pdf;
    try {
      const loadingTask = global.pdfjsLib.getDocument({
        data: await file.arrayBuffer(),
        isEvalSupported: false,
        maxImageSize: 0,
      });
      pdf = await loadingTask.promise;
    } catch (error) {
      if (error && error.name === 'PasswordException') {
        throw new Error('This PDF is encrypted or password-protected. Remove its password before importing.');
      }
      throw new Error('This PDF is corrupted or could not be opened. Try exporting it again.');
    }

    try {
      if (pdf.numPages > MAX_PDF_PAGES) {
        throw new Error('This PDF has more than 200 pages. Split it into smaller files before importing.');
      }
      const pages = [];
      let extractedSize = 0;
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();
        const lines = [];
        let currentY = null;
        let currentLine = '';

        content.items.forEach((item) => {
          if (typeof item.str !== 'string' || !item.str) {
            return;
          }
          const y = item.transform ? Math.round(item.transform[5]) : currentY;
          if (currentY !== null && y !== currentY) {
            lines.push(currentLine.trim());
            currentLine = '';
          }
          currentY = y;
          currentLine += `${currentLine ? ' ' : ''}${item.str}`;
        });
        if (currentLine.trim()) {
          lines.push(currentLine.trim());
        }

        const pageText = lines.filter(Boolean).join('\n');
        extractedSize += pageText.length;
        if (extractedSize > MAX_TEXT_BYTES) {
          throw new Error('The extracted PDF text is larger than 5 MB. Choose a smaller document.');
        }
        if (pageText) {
          pages.push(pageText);
        }
      }

      if (!pages.length) {
        throw new Error('No selectable text was found. This PDF may contain scanned images; OCR is not supported yet.');
      }
      return validateText(pages.join('\n\n'));
    } finally {
      await pdf.destroy();
    }
  }

  async function extract(file) {
    const extension = validateFile(file);
    try {
      if (extension === 'txt') {
        return { kind: 'text', text: validateText(await readUtf8File(file)), filename: file.name };
      }
      if (extension === 'zip') {
        return prepareZip(file);
      }
      if (extension === 'pdf') {
        return { kind: 'text', text: await pdfToText(file), filename: file.name };
      }
      if (extension === 'docx') {
        return { kind: 'text', text: await docxToText(file), filename: file.name };
      }
      if (extension === 'csv') {
        return { kind: 'text', text: csvToText(await readUtf8File(file)), filename: file.name };
      }
      if (extension === 'json') {
        return { kind: 'text', text: jsonToText(await readUtf8File(file)), filename: file.name };
      }
      throw new Error('Unsupported file type.');
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Could not read "${file.name}". The file may be corrupted or in an unsupported format.`);
    }
  }

  global.ConversationFileImporter = Object.freeze({
    extract,
    maxFileBytes: MAX_FILE_BYTES,
    maxTextBytes: MAX_TEXT_BYTES,
  });
}(window));
