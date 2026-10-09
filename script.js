const sampleConversation = `Maya: We need to launch the landing page tomorrow by 3pm. This is urgent and we need final approvals before the meeting.
Alex: I can review the copy and send it to design by 2 PM.
Priya: Thanks, I approved the CTA text. We decided to keep the dark theme.
Daniel: @Maya can you confirm the launch checklist before noon?
Sam: Please review the budget before Friday and update the client notes.
Chris: The API is blocked, so we may miss the release window if we don't fix it.
Nia: We agreed to postpone the dashboard release and move it to next Monday.`;

const state = {
  analysis: null,
  dismissedAlerts: new Set(),
  completedTasks: new Set(),
  importedText: null,
  pendingZipSelection: null,
};

const elements = {
  input: document.getElementById('conversationInput'),
  chatFileInput: document.getElementById('chatFileInput'),
  zipChoicePanel: document.getElementById('zipChoicePanel'),
  zipFileSelect: document.getElementById('zipFileSelect'),
  importZipSelectionButton: document.getElementById('importZipSelectionButton'),
  cancelZipSelectionButton: document.getElementById('cancelZipSelectionButton'),
  analyzeButton: document.getElementById('analyzeButton'),
  sampleButton: document.getElementById('sampleButton'),
  importFileButton: document.getElementById('importFileButton'),
  clearButton: document.getElementById('clearButton'),
  themeToggle: document.getElementById('themeToggle'),
  themeToggleLabel: document.getElementById('themeToggleLabel'),
  validationMessage: document.getElementById('validationMessage'),
  fileImportStatus: document.getElementById('fileImportStatus'),
  analysisStatus: document.getElementById('analysisStatus'),
  loadingIndicator: document.getElementById('loadingIndicator'),
  summaryCard: document.getElementById('summaryCard'),
  alertCount: document.getElementById('alertCount'),
  actionCount: document.getElementById('actionCount'),
  deadlineCount: document.getElementById('deadlineCount'),
  decisionCount: document.getElementById('decisionCount'),
  alertsList: document.getElementById('alertsList'),
  actionItemsList: document.getElementById('actionItemsList'),
  deadlinesList: document.getElementById('deadlinesList'),
  decisionsList: document.getElementById('decisionsList'),
  mentionsList: document.getElementById('mentionsList'),
};

function setValidation(message, isError = false) {
  elements.validationMessage.textContent = message;
  elements.validationMessage.classList.toggle('is-error', isError);
}

function applyTheme(theme, persist = false) {
  const selectedTheme = theme === 'light' ? 'light' : 'dark';
  document.documentElement.dataset.theme = selectedTheme;

  const nextTheme = selectedTheme === 'dark' ? 'light' : 'dark';
  const label = `Switch to ${nextTheme} mode`;
  elements.themeToggle.setAttribute('aria-label', label);
  elements.themeToggle.title = label;
  elements.themeToggleLabel.textContent = `${nextTheme[0].toUpperCase()}${nextTheme.slice(1)} mode`;

  if (persist) {
    try {
      window.localStorage.setItem('missedme-theme', selectedTheme);
    } catch {
      elements.analysisStatus.textContent = 'Theme changed for this visit. Browser storage is unavailable, so the preference could not be saved.';
    }
  }
}

function restoreTheme() {
  try {
    applyTheme(window.localStorage.getItem('missedme-theme') || 'dark');
  } catch {
    applyTheme('dark');
  }
}

async function handleImportFile() {
  const file = elements.chatFileInput.files[0];
  if (!file) {
    return;
  }

  elements.fileImportStatus.textContent = '';
  elements.zipChoicePanel.hidden = true;
  state.pendingZipSelection = null;
  setValidation('');
  setImportBusy(true);
  elements.fileImportStatus.textContent = `Reading ${file.name} locally…`;

  try {
    const result = await ConversationFileImporter.extract(file);
    if (result.kind === 'zip-selection') {
      state.pendingZipSelection = result;
      elements.zipFileSelect.replaceChildren();
      result.entries.forEach((entry) => {
        const option = document.createElement('option');
        option.value = entry.name;
        option.textContent = `${entry.name} (${formatFileSize(entry.uncompressedSize)})`;
        elements.zipFileSelect.appendChild(option);
      });
      elements.zipChoicePanel.hidden = false;
      elements.fileImportStatus.textContent = `Found ${result.entries.length} text files in ${file.name}. Choose the chat export to continue.`;
      elements.zipFileSelect.focus();
      return;
    }

    installImportedText(result.text, result.filename || file.name);
  } catch (error) {
    elements.fileImportStatus.textContent = '';
    setValidation(error instanceof Error ? error.message : 'The file could not be imported. Please try again.', true);
    elements.analysisStatus.textContent = 'Chat file import failed.';
  } finally {
    elements.chatFileInput.value = '';
    setImportBusy(false);
  }
}

function formatFileSize(size) {
  if (size < 1024) {
    return `${size} B`;
  }
  return `${(size / 1024).toFixed(size >= 1024 * 1024 ? 0 : 1)} ${size >= 1024 * 1024 ? 'MB' : 'KB'}`;
}

function installImportedText(text, filename) {
  elements.input.value = text;
  state.importedText = text;
  state.analysis = null;
  state.dismissedAlerts.clear();
  state.completedTasks.clear();
  state.pendingZipSelection = null;
  elements.zipChoicePanel.hidden = true;
  renderResults();
  elements.fileImportStatus.textContent = `Imported ${filename} locally. Review or edit the extracted text, then choose Analyze conversation.`;
  elements.analysisStatus.textContent = `Imported ${filename} locally. Review it before analysis.`;
}

async function handleImportZipSelection() {
  if (!state.pendingZipSelection || !elements.zipFileSelect.value) {
    setValidation('Choose a text file from the ZIP first.', true);
    return;
  }

  setValidation('');
  setImportBusy(true);
  elements.fileImportStatus.textContent = 'Extracting the selected chat locally…';
  try {
    const text = await state.pendingZipSelection.extract(elements.zipFileSelect.value);
    installImportedText(text, elements.zipFileSelect.value);
  } catch (error) {
    elements.fileImportStatus.textContent = '';
    setValidation(error instanceof Error ? error.message : 'The selected ZIP file could not be extracted.', true);
  } finally {
    setImportBusy(false);
  }
}

function cancelZipSelection() {
  state.pendingZipSelection = null;
  elements.zipChoicePanel.hidden = true;
  elements.fileImportStatus.textContent = '';
  setValidation('');
}

const documentationLabels = new Set([
  'action items',
  'analysis',
  'api',
  'button',
  'buttons',
  'clear',
  'code',
  'component',
  'configuration',
  'copy',
  'css',
  'decisions',
  'description',
  'documentation',
  'example',
  'export',
  'features',
  'html',
  'implementation',
  'input',
  'instructions',
  'javascript',
  'markdown',
  'mentions',
  'next steps',
  'note',
  'output',
  'overview',
  'part',
  'priority alerts',
  'privacy',
  'readme',
  'requirements',
  'section',
  'settings',
  'setup',
  'status',
  'step',
  'summary',
  'testing',
  'tip',
  'ui',
  'usage',
  'warning',
]);

function isDocumentationLine(line, indentation) {
  return indentation >= 4
    || /^#{1,6}\s/.test(line)
    || /^(?:[-*+•]\s+|\d+[.)]\s+)/.test(line)
    || /^>/.test(line)
    || /^(```|~~~)/.test(line);
}

function parseSpeakerLine(line, index, fallbackTimestamp = '') {
  let content = line;
  let timestamp = fallbackTimestamp;

  const timestampMatch = content.match(/^(?:\[([^\]]+)\]|(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}(?:,\s*\d{1,2}:\d{2}(?::\d{2})?(?:\s?[AP]M)?)?|\d{1,2}:\d{2}(?:\s?[AP]M)?))\s*(?:[-–|]\s*)?/i);
  if (timestampMatch) {
    timestamp = timestampMatch[1] || timestampMatch[2];
    content = content.slice(timestampMatch[0].length).trim();
  }

  const speakerMatch = content.match(/^([A-Z][A-Za-z.'’-]*(?:\s+[A-Z][A-Za-z.'’-]*){0,2})(?:\s+\(([^)]+)\))?\s*:\s+(.+)$/);
  if (!speakerMatch) {
    return null;
  }

  const sender = speakerMatch[1].trim();
  const normalizedSender = sender.toLowerCase().replace(/[.'’-]/g, '').replace(/\s+/g, ' ');
  const senderWords = sender.split(/\s+/);
  if (
    documentationLabels.has(normalizedSender)
    || senderWords.some((word) => /^[A-Z]{2,}$/.test(word))
  ) {
    return null;
  }

  return {
    id: `msg-${index}`,
    sender,
    timestamp: speakerMatch[2] || timestamp,
    content: speakerMatch[3].trim(),
    original: line,
  };
}

function parseConversation(rawText) {
  const messages = [];
  const seenMessages = new Set();
  let insideCodeBlock = false;
  let index = 0;

  rawText.split(/\r?\n/).forEach((rawLine) => {
    const indentation = rawLine.match(/^\s*/)[0].length;
    const line = rawLine.trim();
    if (!line) {
      return;
    }

    if (/^(?:```|~~~)/.test(line)) {
      insideCodeBlock = !insideCodeBlock;
      return;
    }
    if (insideCodeBlock || isDocumentationLine(line, indentation)) {
      return;
    }

    const message = parseSpeakerLine(line, ++index);
    if (!message) {
      return;
    }

    const normalizedMessage = `${message.sender.toLowerCase()}|${message.content.toLowerCase().replace(/\s+/g, ' ').trim()}`;
    if (seenMessages.has(normalizedMessage)) {
      return;
    }
    seenMessages.add(normalizedMessage);
    messages.push(message);
  });

  return messages;
}

function extractUrgency(message) {
  const text = message.content.toLowerCase();
  let score = 0;
  const reasons = [];

  if (/\b(?:urgent|asap|immediately|critical|time-sensitive|blocked|blocker|deadline)\b/.test(text)) {
    score += 2;
    reasons.push('urgent wording');
  }

  if (/\b(?:today|tomorrow|tonight|before\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?|by\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?|before\s+(?:monday|tuesday|wednesday|thursday|friday|weekend)|by\s+(?:monday|tuesday|wednesday|thursday|friday)|deadline|due)\b/.test(text)) {
    score += 2;
    reasons.push('time-sensitive request');
  }

  if (/\b(?:please|can you|need to|must|important|priority|review|confirm|finalize)\b/.test(text)) {
    score += 1;
    reasons.push('clear request');
  }

  if (score >= 3) {
    return {
      priority: score >= 5 ? 'High' : 'Medium',
      reason: reasons.join(', '),
      score,
    };
  }

  return null;
}

function extractActionItem(message) {
  const text = message.content.trim();
  const lower = text.toLowerCase();
  const actionVerbs = '(?:review|confirm|send|create|finalize|approve|update|schedule|remind|follow up|publish|check|prepare|fix|post|share|complete|finish|deliver|submit|handle|resolve)';
  const hasActionWord = new RegExp(`\\b(?:need to|must|please|can you|could you|let's|we need|${actionVerbs})\\b`, 'i').test(lower);
  const hasDeadlineOrTime = /\b(?:today|tomorrow|tonight|next\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)|(?:by|before|due(?:\s+on)?)\s+(?:\d{1,2}(?::\d{2})?\s*(?:am|pm)?|monday|tuesday|wednesday|thursday|friday|saturday|sunday)|\d{1,2}:\d{2}\s*(?:am|pm)?)\b/i.test(lower);
  const hasRequest = /\b(?:please|can you|could you|need you to|we need|need to|must)\b/i.test(lower);
  const commitment = new RegExp(`\\b(?:i|we)\\s+(?:will|can|shall|'ll)\\s+${actionVerbs}\\b`, 'i').test(lower);
  const imperative = new RegExp(`^(?:please\\s+)?${actionVerbs}\\b`, 'i').test(text);

  if (commitment || imperative || (hasActionWord && (hasDeadlineOrTime || hasRequest))) {
    return {
      text,
      sender: message.sender,
      reason: 'Task-oriented wording with a clear follow-up or due date',
    };
  }

  return null;
}

function extractDeadline(message) {
  const text = message.content;
  const lower = text.toLowerCase();
  const dateMatch = text.match(/\b(?:today|tomorrow|tonight|next\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)|(?:by|before|due(?:\s+on)?)\s+(?:\d{1,2}(?::\d{2})?\s*(?:am|pm)?|monday|tuesday|wednesday|thursday|friday|saturday|sunday|(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2}(?:,?\s+\d{4})?|\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?)|\d{1,2}:\d{2}\s*(?:am|pm)|\d{4}-\d{2}-\d{2})\b/i);

  const hasTaskOrAction = /\b(?:need to|must|please|can you|could you|i will|we will|i'll|we'll|review|approve|send|schedule|finalize|update|launch|publish|deliver|remind|follow up|fix|complete|finish|submit|resolve)\b/i.test(lower);

  if (dateMatch && hasTaskOrAction) {
    return {
      text: dateMatch[0].trim(),
      sender: message.sender,
      task: message.content.trim(),
      reason: 'Time phrase connected to an action request',
    };
  }

  return null;
}

function extractDecision(message) {
  const text = message.content;
  const lower = text.toLowerCase();

  const decisionTrigger = /\b(?:we decided|we agreed|decision|approved|finalized|lets go with|we'll go with|the plan is|it is decided|we are moving forward|we chose|we will)\b/i.test(lower);

  if (decisionTrigger) {
    return {
      text: text,
      sender: message.sender,
      reason: 'Decision language was used in context',
    };
  }

  return null;
}

function extractMention(message) {
  const text = message.content;
  const lower = text.toLowerCase();
  const mentionPattern = /(?:@(?:[A-Za-z0-9_.-]+)|(?:[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?),\s*(?:can you|could you|please|need you to|check|review|confirm|remind|send))/g;
  const mentionMatch = text.match(mentionPattern);

  if (mentionMatch && /\b(?:please|can you|could you|need you to|check|review|confirm|remind|send)\b/i.test(lower)) {
    return {
      text: mentionMatch[0].trim(),
      sender: message.sender,
      reason: 'Direct mention or follow-up request detected',
    };
  }

  return null;
}

function buildSummary(analysis) {
  const sections = [];

  if (analysis.alerts.length) {
    sections.push(`${analysis.alerts.length} urgent or high-priority item${analysis.alerts.length > 1 ? 's' : ''}`);
  }

  if (analysis.actionItems.length) {
    sections.push(`${analysis.actionItems.length} action item${analysis.actionItems.length > 1 ? 's' : ''} to track`);
  }

  if (analysis.decisions.length) {
    sections.push(`${analysis.decisions.length} decision${analysis.decisions.length > 1 ? 's' : ''} made`);
  }

  if (analysis.deadlines.length) {
    sections.push(`${analysis.deadlines.length} date or deadline reference${analysis.deadlines.length > 1 ? 's' : ''}`);
  }

  if (!sections.length) {
    return 'The conversation looks mostly informational. No urgent tasks, deadlines, or decisions were clearly identified.';
  }

  const joined = sections.length === 1
    ? sections[0]
    : `${sections.slice(0, -1).join(', ')}, and ${sections[sections.length - 1]}`;

  return `This conversation includes ${joined}.`;
}

function analyzeConversation(rawText) {
  const messages = parseConversation(rawText);
  if (!messages.length) {
    return null;
  }

  const alerts = [];
  const actionItems = [];
  const deadlines = [];
  const decisions = [];
  const mentions = [];

  messages.forEach((message) => {
    const urgency = extractUrgency(message);
    if (urgency) {
      alerts.push({
        id: `alert-${message.id}`,
        sender: message.sender,
        priority: urgency.priority,
        reason: urgency.reason,
        message: message.content,
        reference: message.original,
      });
    }

    const actionItem = extractActionItem(message);
    if (actionItem) {
      actionItems.push({
        id: `task-${message.id}`,
        sender: actionItem.sender,
        text: actionItem.text,
        reason: actionItem.reason,
        original: message.original,
      });
    }

    const deadline = extractDeadline(message);
    if (deadline) {
      deadlines.push({
        id: `deadline-${message.id}`,
        sender: deadline.sender,
        text: deadline.text,
        task: deadline.task,
        reason: deadline.reason,
        original: message.original,
      });
    }

    const decision = extractDecision(message);
    if (decision) {
      decisions.push({
        id: `decision-${message.id}`,
        sender: decision.sender,
        text: decision.text,
        reason: decision.reason,
        original: message.original,
      });
    }

    const mention = extractMention(message);
    if (mention) {
      mentions.push({
        id: `mention-${message.id}`,
        sender: mention.sender,
        text: mention.text,
        reason: mention.reason,
        original: message.original,
      });
    }
  });

  return {
    summary: buildSummary({ alerts, actionItems, decisions, deadlines }),
    alerts: alerts.slice(0, 8),
    actionItems: actionItems.slice(0, 8),
    deadlines: deadlines.slice(0, 8),
    decisions: decisions.slice(0, 8),
    mentions: mentions.slice(0, 8),
  };
}

function createEmptyState(text) {
  const wrapper = document.createElement('div');
  wrapper.className = 'empty-text';
  wrapper.textContent = text;
  return wrapper;
}

function renderSummary(summaryText) {
  const icon = document.createElement('span');
  icon.className = 'summary-icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = '✳';

  const content = document.createElement('div');
  const title = document.createElement('h3');
  title.textContent = 'Quick summary';

  const paragraph = document.createElement('p');
  paragraph.textContent = summaryText;

  content.append(title, paragraph);
  elements.summaryCard.replaceChildren(icon, content);
  elements.summaryCard.classList.remove('empty-state');
}

function renderCounts(analysis) {
  elements.alertCount.textContent = String(analysis ? analysis.alerts.length : 0);
  elements.actionCount.textContent = String(analysis ? analysis.actionItems.length : 0);
  elements.deadlineCount.textContent = String(analysis ? analysis.deadlines.length : 0);
  elements.decisionCount.textContent = String(analysis ? analysis.decisions.length : 0);
}

function renderAlertCard(alert) {
  const card = document.createElement('article');
  card.className = 'insight-card';

  const top = document.createElement('div');
  top.className = 'card-header';

  const badge = document.createElement('span');
  badge.className = `priority-badge ${alert.priority.toLowerCase()}`;
  badge.textContent = `${alert.priority} priority`;

  const dismissButton = document.createElement('button');
  dismissButton.type = 'button';
  dismissButton.className = 'dismiss-btn';
  dismissButton.textContent = 'Dismiss';
  dismissButton.addEventListener('click', () => {
    state.dismissedAlerts.add(alert.id);
    renderResults();
  });

  const title = document.createElement('p');
  title.className = 'insight-title';
  title.textContent = alert.message;

  const message = document.createElement('p');
  message.className = 'insight-message';
  message.textContent = `Why it stands out: ${alert.reason}.`;

  const meta = document.createElement('div');
  meta.className = 'meta-row';

  const senderMeta = document.createElement('span');
  senderMeta.className = 'meta-pill';
  senderMeta.textContent = `Sender: ${alert.sender}`;

  const sourceMeta = document.createElement('span');
  sourceMeta.className = 'meta-pill';
  sourceMeta.textContent = `Original: ${alert.reference}`;

  top.append(badge, dismissButton);
  meta.append(senderMeta, sourceMeta);
  card.append(top, title, message, meta);
  return card;
}

function renderTaskCard(task) {
  const card = document.createElement('article');
  const completed = state.completedTasks.has(task.id);
  card.className = `insight-card task-card ${completed ? 'completed' : ''}`;

  const title = document.createElement('p');
  title.className = 'insight-title';
  title.textContent = task.text;

  const reason = document.createElement('p');
  reason.className = 'insight-message';
  reason.textContent = `${task.reason}.`;

  const meta = document.createElement('div');
  meta.className = 'meta-row';

  const senderMeta = document.createElement('span');
  senderMeta.className = 'meta-pill';
  senderMeta.textContent = `Sender: ${task.sender}`;

  const sourceMeta = document.createElement('span');
  sourceMeta.className = 'meta-pill';
  sourceMeta.textContent = `Original: ${task.original}`;

  const footer = document.createElement('div');
  footer.className = 'task-footer';

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'small-btn';
  button.textContent = completed ? 'Completed' : 'Mark complete';
  button.addEventListener('click', () => {
    if (state.completedTasks.has(task.id)) {
      state.completedTasks.delete(task.id);
    } else {
      state.completedTasks.add(task.id);
    }
    renderResults();
  });

  meta.append(senderMeta, sourceMeta);
  footer.append(button);
  card.append(title, reason, meta, footer);
  return card;
}

function renderDeadlinesCard(item) {
  const card = document.createElement('article');
  card.className = 'insight-card';

  const title = document.createElement('p');
  title.className = 'insight-title';
  title.textContent = `Deadline: ${item.text}`;

  const message = document.createElement('p');
  message.className = 'insight-message';
  message.textContent = `${item.reason}.`;

  const meta = document.createElement('div');
  meta.className = 'meta-row';

  const senderMeta = document.createElement('span');
  senderMeta.className = 'meta-pill';
  senderMeta.textContent = `Sender: ${item.sender}`;

  const taskMeta = document.createElement('span');
  taskMeta.className = 'meta-pill';
  taskMeta.textContent = `Task: ${item.task}`;

  meta.append(senderMeta, taskMeta);
  card.append(title, message, meta);
  return card;
}

function renderDecisionCard(item) {
  const card = document.createElement('article');
  card.className = 'insight-card';

  const title = document.createElement('p');
  title.className = 'insight-title';
  title.textContent = item.text;

  const reason = document.createElement('p');
  reason.className = 'insight-message';
  reason.textContent = `Why highlighted: ${item.reason}.`;

  const meta = document.createElement('div');
  meta.className = 'meta-row';

  const senderMeta = document.createElement('span');
  senderMeta.className = 'meta-pill';
  senderMeta.textContent = `Sender: ${item.sender}`;

  const sourceMeta = document.createElement('span');
  sourceMeta.className = 'meta-pill';
  sourceMeta.textContent = `Original: ${item.original}`;

  meta.append(senderMeta, sourceMeta);
  card.append(title, reason, meta);
  return card;
}

function renderMentionCard(item) {
  const card = document.createElement('article');
  card.className = 'insight-card';

  const title = document.createElement('p');
  title.className = 'insight-title';
  title.textContent = item.text;

  const reason = document.createElement('p');
  reason.className = 'insight-message';
  reason.textContent = `Why highlighted: ${item.reason}.`;

  const meta = document.createElement('div');
  meta.className = 'meta-row';

  const senderMeta = document.createElement('span');
  senderMeta.className = 'meta-pill';
  senderMeta.textContent = `Sender: ${item.sender}`;

  const sourceMeta = document.createElement('span');
  sourceMeta.className = 'meta-pill';
  sourceMeta.textContent = `Original: ${item.original}`;

  meta.append(senderMeta, sourceMeta);
  card.append(title, reason, meta);
  return card;
}

function renderSectionList(listElement, items, emptyText, renderer) {
  listElement.innerHTML = '';

  if (!items.length) {
    listElement.appendChild(createEmptyState(emptyText));
    return;
  }

  items.forEach((item) => listElement.appendChild(renderer(item)));
}

function renderResults() {
  renderCounts(state.analysis);

  if (!state.analysis) {
    const icon = document.createElement('span');
    icon.className = 'summary-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = '✳';

    const content = document.createElement('div');
    const title = document.createElement('h3');
    title.textContent = 'Quick summary';

    const paragraph = document.createElement('p');
    paragraph.textContent = 'No analysis yet. Paste or load a conversation to find the signal in the noise.';

    content.append(title, paragraph);
    elements.summaryCard.replaceChildren(icon, content);
    elements.summaryCard.classList.add('empty-state');
    renderSectionList(elements.alertsList, [], 'No urgent items identified.', renderAlertCard);
    renderSectionList(elements.actionItemsList, [], 'No action items detected.', renderTaskCard);
    renderSectionList(elements.deadlinesList, [], 'No deadlines detected.', renderDeadlinesCard);
    renderSectionList(elements.decisionsList, [], 'No decisions found in this conversation.', renderDecisionCard);
    renderSectionList(elements.mentionsList, [], 'No direct mentions or follow-ups detected.', renderMentionCard);
    return;
  }

  const visibleAlerts = state.analysis.alerts.filter((alert) => !state.dismissedAlerts.has(alert.id));
  renderSummary(state.analysis.summary);
  renderSectionList(elements.alertsList, visibleAlerts, 'No priority alerts were detected.', renderAlertCard);
  renderSectionList(elements.actionItemsList, state.analysis.actionItems, 'No action items detected.', renderTaskCard);
  renderSectionList(elements.deadlinesList, state.analysis.deadlines, 'No deadlines detected.', renderDeadlinesCard);
  renderSectionList(elements.decisionsList, state.analysis.decisions, 'No decisions found in this conversation.', renderDecisionCard);
  renderSectionList(elements.mentionsList, state.analysis.mentions, 'No direct mentions or follow-ups detected.', renderMentionCard);
}

function setLoading(isLoading) {
  elements.loadingIndicator.hidden = !isLoading;
  elements.analyzeButton.disabled = isLoading;
  elements.sampleButton.disabled = isLoading;
  elements.importFileButton.disabled = isLoading;
  elements.clearButton.disabled = isLoading;
  if (isLoading) {
    elements.analysisStatus.textContent = 'Analyzing conversation locally.';
  }
}

function setImportBusy(isBusy) {
  elements.importFileButton.disabled = isBusy;
  elements.importZipSelectionButton.disabled = isBusy;
  elements.cancelZipSelectionButton.disabled = isBusy;
  elements.analyzeButton.disabled = isBusy;
  elements.sampleButton.disabled = isBusy;
  elements.clearButton.disabled = isBusy;
}

function handleAnalyze() {
  const rawText = elements.input.value.trim();

  if (!rawText) {
    state.analysis = null;
    state.dismissedAlerts.clear();
    state.completedTasks.clear();
    renderResults();
    setValidation('Please paste a conversation before analyzing.', true);
    elements.analysisStatus.textContent = 'No conversation to analyze.';
    return;
  }

  setValidation('');
  setLoading(true);

  window.setTimeout(() => {
    try {
      const analysis = analyzeConversation(rawText);
      if (!analysis) {
        state.analysis = null;
        state.dismissedAlerts.clear();
        state.completedTasks.clear();
        renderResults();
        setValidation('I couldn’t find chat messages in this text. Paste messages with a sender and colon, such as “Priya: Please finish the report by 5 PM.”', true);
        elements.analysisStatus.textContent = 'No conversation messages were recognized.';
        setLoading(false);
        return;
      }

      state.analysis = analysis;
      renderResults();
      setLoading(false);
      const total = state.analysis.alerts.length
        + state.analysis.actionItems.length
        + state.analysis.deadlines.length
        + state.analysis.decisions.length
        + state.analysis.mentions.length;
      elements.analysisStatus.textContent = `Analysis complete. Found ${total} insights across five categories.`;
    } catch (error) {
      console.error('Analysis failed', error);
      setValidation('Something went wrong while analyzing the conversation. Please try again.', true);
      elements.analysisStatus.textContent = 'Analysis could not be completed.';
      setLoading(false);
    }
  }, 500);
}

function handleLoadSample() {
  elements.input.value = sampleConversation;
  state.importedText = null;
  state.pendingZipSelection = null;
  elements.zipChoicePanel.hidden = true;
  elements.fileImportStatus.textContent = '';
  setValidation('Sample conversation loaded.');
  handleAnalyze();
}

function handleClear() {
  elements.input.value = '';
  elements.chatFileInput.value = '';
  elements.fileImportStatus.textContent = '';
  elements.zipChoicePanel.hidden = true;
  state.analysis = null;
  state.dismissedAlerts.clear();
  state.completedTasks.clear();
  state.importedText = null;
  state.pendingZipSelection = null;
  setValidation('');
  renderResults();
  elements.analysisStatus.textContent = 'Conversation and results cleared.';
}

function init() {
  restoreTheme();
  elements.themeToggle.addEventListener('click', () => {
    const currentTheme = document.documentElement.dataset.theme;
    applyTheme(currentTheme === 'dark' ? 'light' : 'dark', true);
  });
  elements.analyzeButton.addEventListener('click', handleAnalyze);
  elements.sampleButton.addEventListener('click', handleLoadSample);
  elements.importFileButton.addEventListener('click', () => elements.chatFileInput.click());
  elements.chatFileInput.addEventListener('change', handleImportFile);
  elements.importZipSelectionButton.addEventListener('click', handleImportZipSelection);
  elements.cancelZipSelectionButton.addEventListener('click', cancelZipSelection);
  elements.input.addEventListener('input', () => {
    if (state.importedText !== null && elements.input.value !== state.importedText) {
      state.importedText = null;
      elements.fileImportStatus.textContent = '';
    }
    if (state.pendingZipSelection) {
      cancelZipSelection();
    }
  });
  elements.clearButton.addEventListener('click', handleClear);
  renderResults();
}

init();
