# MissedMe AI — Project Requirements and Implementation Checklist

## Project goal

Build and improve **MissedMe AI**, a polished, reliable, local-first web app for the ProtocolX hackathon challenge, “The Unread Problem — What Did I Miss?” The app should help people catch important information in busy conversations without reading every message.

Users should be able to identify:

- Concise conversation summaries.
- Urgent or high-priority messages.
- Tasks and action items.
- Deadlines and dates.
- Decisions and agreements.
- Direct mentions and follow-ups.
- The original message and sender that support each result.

Results are rule-based suggestions, not guaranteed interpretations. Never fabricate a message, sender, deadline, task, or decision.

## 1. Inspect and preserve the existing project

- [ ] Inspect the existing project files before making changes. Read the current HTML, CSS, JavaScript, README, tests, and local dependencies as relevant.
- [ ] Understand existing behavior and identify the smallest complete change that meets the request.
- [ ] Modify the existing ProtocolX project in place. Do not rebuild it from scratch or replace working functionality without a clear reason.
- [ ] Preserve useful existing work, including the browser-side analyzer, themes, file import, and user interactions.
- [ ] Do not delete files or modify unrelated areas.
- [ ] Use synthetic conversations in development and tests; never put real private chat content into coding-assistant prompts or public fixtures.

## 2. UI, themes, and responsive design

- [ ] Preserve the existing product identity and professional, compact dark-navy/turquoise design.
- [ ] Preserve the light theme, theme toggle, accessible toggle label, keyboard support, visible focus indicators, and saved theme preference.
- [ ] Ensure every new interface element follows both themes: file picker, validation, status messages, selectors, and errors.
- [ ] Keep the conversation input, analysis summary, dynamic counts, and five result categories clear and readable.
- [ ] Retain distinctive, readable category accents: coral/red for alerts, turquoise for tasks, amber for deadlines, purple for decisions, and blue for mentions.
- [ ] Preserve the existing primary Analyze action and secondary Sample, Import, and Clear actions.
- [ ] Maintain desktop, tablet, and narrow mobile layouts without horizontal overflow.
- [ ] Preserve semantic HTML, accessible labels, live status announcements, keyboard usability, and reduced-motion support.
- [ ] Ensure long original messages wrap safely and remain understandable.

## 3. Conversation analyzer and accuracy

- [ ] Keep and improve the existing browser-side JavaScript rule-based analysis engine. Do not replace it with fake AI output or an unverified external service.
- [ ] Recognize genuine chat messages with sender names, timestamps, and message content when available.
- [ ] Support common WhatsApp-exported text formats, including date/time prefixes followed by `- Sender: message`; retain the sender, timestamp, and original source text.
- [ ] Handle multiline WhatsApp messages carefully: attach valid continuation lines to the preceding message without promoting documentation, system notifications, media placeholders, or unrelated lines into fabricated sender messages.
- [ ] Ignore group/system notifications and non-message records when they cannot be reliably attributed to a sender.
- [ ] Avoid treating documentation as chat. Do not interpret Markdown headings, numbered or bulleted instructions, code blocks, UI labels, copied documentation, or long technical prose as chat messages simply because they contain keywords or colons.
- [ ] Require recognizable message structure when possible. If input does not resemble a conversation, show a helpful instruction to paste chat messages and do not show fabricated analysis.
- [ ] Identify urgency using context and transparent rules rather than highlighting every occurrence of words like “urgent,” “tomorrow,” or “important.”
- [ ] Detect action items, decisions, direct mentions, follow-ups, and deadlines only when supported by the message text.
- [ ] Extract a deadline only when an actual date/time expression is present and relevant to an action or request. Do not infer a date from an unrelated timestamp or invent one.
- [ ] Avoid duplicate findings for the same message or repeated identical messages where appropriate.
- [ ] Preserve original text, sender, and timestamp where available so users can verify each result.
- [ ] Keep priorities understandable and provide a short explanation for why an item was highlighted.
- [ ] Ensure summary and count values come from actual analyzed results, not sample constants.

## 4. Conversation input and controls

- [ ] Keep the existing editable conversation text area.
- [ ] Keep Analyze Conversation, Load Sample Conversation, Clear, empty-input validation, and loading feedback working.
- [ ] Let users review and edit imported text before starting analysis.
- [ ] Preserve alert dismissal and action-item completion.
- [ ] Do not persist private conversation text by default. Clear should remove the text, results, and transient import state.
- [ ] Keep the sample conversation synthetic and clearly separate from actual user input.

## 5. Conversation file importing

- [ ] Provide a clear **Import Conversation** control adjacent to the existing conversation input actions, with an accessible file picker.
- [ ] Read and extract all supported content locally in the browser, then put the extracted text into the existing editable conversation text area.
- [ ] Display the imported filename and a clear status message. Do not analyze automatically; let the user review the text and choose Analyze Conversation.
- [ ] Reuse the existing analyzer after import. Do not create a second analyzer for files.
- [ ] Validate extension and content; show helpful errors for empty, malformed, corrupt, unsupported, encrypted, and oversized files.
- [ ] Set reasonable limits for file size, extracted text, archive expansion, document pages, and work performed. Avoid freezing the browser on large inputs.
- [ ] Treat all imported content as untrusted text. Never execute embedded scripts, HTML, formulas, or instructions.
- [ ] Preserve existing themes, responsive layout, sample, Clear, dismiss, complete, and other app behavior.

### Supported formats

- [ ] **TXT:** Read UTF-8 text in-browser. Support WhatsApp exported chat text.
- [ ] **ZIP:** Extract the chat `.txt` in-browser. Ignore media and non-text entries. If multiple `.txt` files are present, ask the user which to import. Reject encrypted or unsupported archives clearly.
- [ ] **PDF:** Extract selectable text locally. Explain that scanned/image-only PDFs require OCR, which is not supported. Report password protection and corrupted files clearly.
- [ ] **DOCX:** Extract document text locally. Legacy `.doc` is not the same format and may be unsupported.
- [ ] **CSV:** Parse quoted fields and common delimiters safely. Map message text from clearly named columns and include sender/timestamp when present. Do not guess when columns are missing or ambiguous; show a helpful error.
- [ ] **JSON:** Support common message-array structures and common message, sender, and timestamp field names. Explain when syntax is invalid or the structure is unsupported.
- [ ] Document all unsupported cases honestly, including OCR, legacy document formats, ZIP64, encrypted archives, and size/page limits where applicable.

## 6. Privacy and security

- [ ] All conversation analysis and supported file parsing must occur locally in the browser.
- [ ] Never transmit files, extracted text, or conversation content to a server, analytics service, external AI API, CDN-hosted parser, or other external endpoint.
- [ ] Do not add analytics, tracking, credentials, or unnecessary personal-data collection.
- [ ] Do not persist conversations. The existing theme preference may be stored, but chat text and imported contents must remain transient.
- [ ] Use safe DOM APIs and `textContent` for user-provided text. Do not insert untrusted text as executable HTML.
- [ ] Do not evaluate, execute, or obey instructions embedded in imported chats or documents.
- [ ] Do not upload private conversations or test fixtures containing real conversations to GitHub.
- [ ] Use synthetic test data and disclose the limits of local rule-based extraction.

## 7. Dependencies and local libraries

- [ ] Prefer browser APIs and existing project patterns where practical.
- [ ] If a format needs a library, use a maintained library bundled in the project and loaded through a local relative path; do not silently load it from a CDN.
- [ ] Explain why each dependency is needed, its version, license, and any required files such as a local PDF worker.
- [ ] Do not add a framework, backend, package manager, or build setup unless the requirement truly needs it.
- [ ] Confirm the app still works offline or without contacting third-party services, apart from files explicitly served by the local/static host.

## 8. README documentation

- [ ] Keep `README.md` accurate and aligned with the actual implementation.
- [ ] Explain how to run the app and the browser-side rule-based analysis method.
- [ ] Document supported file formats, accepted CSV/JSON structures, file limits, and unsupported cases.
- [ ] Describe local-only processing, what (if anything) is stored, and the privacy/security model.
- [ ] List bundled dependencies with versions, purposes, and license locations.
- [ ] Document how to run the importer tests and manually verify the import flow.
- [ ] Avoid claiming model-based AI or capabilities that have not been implemented and tested.

## 9. GitHub Pages deployment preparation

- [ ] Keep the app static-host friendly: no backend, secrets, server-only APIs, or build requirement unless explicitly agreed.
- [ ] Use relative local paths for scripts, styles, PDF worker, and other assets so the app works when hosted from a GitHub Pages project subpath.
- [ ] Check that no resource is fetched from an external CDN or API at runtime.
- [ ] Ensure local PDF worker paths resolve correctly under a repository subpath, not only at `/`.
- [ ] Ensure test pages and public fixtures contain only synthetic data.
- [ ] Document deployment prerequisites and a safe GitHub Pages smoke-test checklist in the README.
- [ ] Do not push, publish, or deploy to GitHub unless explicitly requested.

## 10. Testing requirements

- [ ] Inspect existing test setup before adding or selecting tests. Add focused tests for each supported format and relevant error paths.
- [ ] Test a realistic WhatsApp conversation containing urgent requests, tasks, deadlines, decisions, mentions, timestamps, multiline messages, and sender names.
- [ ] Test repeated messages and ensure duplicate results are avoided where expected.
- [ ] Test a technical document with headings, numbered steps, bullets, code, and UI instructions; it must not become fake chat analysis.
- [ ] Test chat input without deadlines or decisions and verify none are invented.
- [ ] Test empty input and non-conversation/documentation input.
- [ ] Test valid and invalid TXT, ZIP (including multiple TXT selection, no TXT/media-only, corrupt/encrypted), selectable-text and scanned/password-protected/corrupt PDF, valid/corrupt DOCX, valid/ambiguous/malformed CSV, and valid/unsupported/malformed JSON.
- [ ] Test unsupported file types, invalid text encoding, empty files, oversized files/text, and archive/document limits.
- [ ] Test editing imported text before analysis.
- [ ] Test Analyze, Load Sample, Clear, theme switching and persistence, alert dismissal, task completion, live counts, and empty states.
- [ ] Test desktop and mobile layouts, including narrow viewport overflow and keyboard access.
- [ ] Check browser console and editor diagnostics for errors.
- [ ] Verify that no external network resource receives conversation content and that the app loads only local parser scripts/workers.
- [ ] Report only tests that were actually run and their actual results. Clearly separate automated browser checks from physical-device or manual checks.

## 11. Final verification and reporting

- [ ] Make only necessary changes in the existing project.
- [ ] Verify all referenced selectors, element IDs, scripts, worker paths, and test paths exist.
- [ ] Verify the existing features still work after the changes.
- [ ] Do not claim success for an untested format or unsupported edge case.
- [ ] Report exactly which files changed and summarize each change.
- [ ] List dependencies added, including versions, purpose, and license.
- [ ] Report the tests actually run and pass/fail results.
- [ ] Identify limitations, incomplete features, and any manual checks the user still needs to perform.
- [ ] Confirm no files were pushed or deployed unless the user explicitly authorized it.
