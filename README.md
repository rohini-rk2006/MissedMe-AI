# MissedMe AI

MissedMe AI is a local-first web app that helps people find important updates, tasks, deadlines, decisions, and follow-ups in busy conversations. Its analysis engine is browser-side JavaScript rules and pattern matching, not a generative AI model.

## Run the app

Use a local web server so PDF.js can load its bundled worker:

1. Open a terminal in the project folder.
2. Run `python -m http.server 8000`.
3. Open `http://localhost:8000`.

The app and its bundled libraries are served from this local folder. No build step or package installation is required.

## Import conversation files

Select **Import Conversation**, choose a supported file, review or edit the extracted text, then press **Analyze conversation**.

Supported formats:

- **TXT** — decoded as UTF-8.
- **ZIP** — extracts `.txt` files only; images, audio, and other media are ignored. If there are multiple text files, choose the chat export from the list.
- **PDF** — extracts selectable text. Scanned/image-only PDFs need OCR, which is not supported. Password-protected PDFs are not supported.
- **DOCX** — extracts paragraphs and basic text from `.docx` documents. Legacy `.doc` files are not supported.
- **CSV** — comma-, semicolon-, or tab-delimited files are detected automatically. A header row and recognizable `Message`, `Text`, `Body`, or `Content` column are required. Optional sender and timestamp headers include `Sender`, `Author`, `From`, `Participant`, `Name`, `Timestamp`, `Date`, and `Time`. Ambiguous or missing message columns produce an error instead of guessed output.
- **JSON** — supports a root message array, a `messages` array, common nested `conversation.messages`, `chat.messages`, `data.messages`, and `chats[].messages` structures, plus common sender, timestamp, and message-text fields.

File size is limited to 10 MB; extracted text is limited to 5 MB. ZIP archives are checked for encryption, damaged directories, excessive entry counts, and expansion beyond 30 MB. PDF extraction is limited to 200 pages. Password-protected PDF and encrypted ZIP/DOCX files are rejected with an explanation. ZIP64 archives and OCR are not supported.

## Privacy and security

Files are read and parsed locally in the browser. Neither files nor conversation contents are sent to a server or external API. Extracted text is placed in the existing editable conversation box and is not persisted. The only persistent browser data is the selected theme preference. Imported HTML and scripts are treated as text; they are never executed.

## Local dependencies

No package manager install is required. The import feature uses locally bundled libraries:

- [JSZip 3.10.1](./vendor/jszip.min.js) for ZIP and DOCX containers; license at [vendor/JSZip-LICENSE.txt](./vendor/JSZip-LICENSE.txt).
- [PDF.js 3.11.174](./vendor/pdf.min.js) for PDF text extraction, with its local worker at [vendor/pdf.worker.min.js](./vendor/pdf.worker.min.js); license at [vendor/PDFJS-LICENSE.txt](./vendor/PDFJS-LICENSE.txt).

The TXT, CSV, and JSON readers use browser APIs and application code. The application does not load these libraries from a CDN.

## Test the importers

1. Start the local server using the steps above.
2. Open `http://localhost:8000/tests/importers.test.html`.
3. Confirm the page reports all tests passing. The browser tests cover valid TXT, ZIP, PDF, DOCX, CSV, and JSON files, ZIP multi-file selection and encryption rejection, scanned/corrupt PDFs and the password-error path, malformed and ambiguous CSV/JSON, invalid text encoding, unsupported and oversized files, and empty content.
4. To try the full interface, return to `http://localhost:8000`, select **Import Conversation**, choose a file, review the extracted text, and click **Analyze conversation**.
5. Try a ZIP containing more than one `.txt` file to check the selection step. Try CSV headers such as `Timestamp,Sender,Message`, or JSON with a `messages` array containing `sender` and `text`.

## Analysis limitations

The local rule-based analyzer may miss subtle context or misread ambiguous wording. Its results are suggestions; verify them against the original conversation.
