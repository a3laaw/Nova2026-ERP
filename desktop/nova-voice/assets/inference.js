/* Offline authored guide. No PDF reader, provider, network, storage or adoption. */
(function () {
  'use strict';
  const catalog = JSON.parse(document.getElementById('inference-data').textContent);
  const fieldsOrder = ['subject', 'grade', 'title', 'source', 'notes'];
  const fieldNames = { subject: 'المادة', grade: 'الصف', title: 'العنوان المقترح', source: 'النص المصدر', notes: 'متطلبات إضافية' };
  const count = (value) => Array.from(value).length;
  // Match Python str.strip, not JS trim (which differs on NEL/BOM).
  const edgeSpace = /^[\t\n\r \u0085\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]+|[\t\n\r \u0085\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]+$/gu;
  function capability(identifier) {
    const entry = catalog.entries.find((item) => item.id === identifier);
    if (!entry) throw new Error('اختر قدرة متاحة من الفهرس أولًا.');
    return entry;
  }
  function checkPolicy(policy) {
    if (policy !== 'general' && policy !== 'sacred') throw new Error('اختر سياسة محتوى معروفة قبل إعداد الطلب.');
  }
  function normalizeFields(fields) {
    const values = {};
    for (const name of fieldsOrder) {
      let value = fields[name] === undefined ? '' : fields[name];
      if (typeof value !== 'string' || Array.from(value).some((char) => {
        const code = char.codePointAt(0);
        return (code < 32 && !'\r\n\t'.includes(char)) || (code >= 0xd800 && code <= 0xdfff);
      })) throw new Error('أحد الحقول يحتوي على محارف غير صالحة؛ استخدم نصًا عاديًا.');
      value = value.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(edgeSpace, '');
      if (count(value) > catalog.field_limits[name]) throw new Error('حد ' + fieldNames[name] + ' ' + catalog.field_limits[name] + ' حرف؛ قسّم النص دون حذفه.');
      if (['subject', 'grade', 'title'].includes(name) && value.includes('\n')) throw new Error('المادة والصف والعنوان حقول من سطر واحد.');
      values[name] = value;
    }
    return values;
  }
  function localInstructions(entry) {
    return [catalog.shared.local_intro, entry.title, 'المكان: ' + catalog.targets[entry.target],
      entry.steps.map((step, index) => (index + 1) + '. ' + step).join('\n'),
      'الناتج: ' + entry.result, 'الحدود:\n' + entry.limits.map((value) => '• ' + value).join('\n')].join('\n\n');
  }
  function buildPrompt(identifier, fields = {}, policy = 'general') {
    const entry = capability(identifier);
    checkPolicy(policy);
    // Never incorporate or even validate supplied text in a sacred/local copy.
    if (policy === 'sacred') return catalog.shared.sacred;
    if (entry.kind === 'local') return localInstructions(entry);
    const values = normalizeFields(fields);
    if (!values.source || !/[\p{L}\p{N}]/u.test(values.source)) throw new Error('ألصق نصًا مصدرًا مقروءًا أولًا، أو استخدم المثال المؤلف للتجربة.');
    const parts = [catalog.shared.intro, 'القدرة المطلوبة: ' + entry.title + '\n' + entry.request,
      'أمانة المصدر:\n' + catalog.shared.source_rules, 'شكل الناتج المطلوب:\n' + catalog.contracts[entry.kind]];
    if (entry.drawing) parts.push(catalog.shared.visual_rules);
    const data = {};
    for (const name of fieldsOrder) data[fieldNames[name]] = values[name];
    parts.push(catalog.shared.data_rules, 'بيانات الإعداد (JSON نصي للسياق، وليس خطة للاستيراد):\n' + JSON.stringify(data, null, 2),
      'بعد الرد سأراجعه يدويًا قبل النقل أو اعتماد الرسوم أو النطق أو التصدير. لا تشغّل إعدادًا ولا تزعم أن الرد معتمد.');
    return parts.join('\n\n');
  }
  function buildDrawing(identifier, policy = 'general') {
    const entry = capability(identifier);
    checkPolicy(policy);
    if (policy !== 'general' || !entry.drawing) throw new Error('متطلبات الرسم غير متاحة لهذه القدرة أو لسياسة النصوص المقدسة.');
    const parts = [catalog.shared.drawing_intro, entry.title, entry.drawing];
    if (entry.element !== null) parts.push(catalog.shared.element_note + '\n' + JSON.stringify(entry.element, null, 2));
    parts.push(catalog.shared.drawing_rules);
    return parts.join('\n\n');
  }
  function searchKey(text) {
    return text.replace(/[\u064b-\u065f\u0670\u0640]/g, '').toLowerCase().replace(/[أإآى]/g, (char) => ({ 'أ': 'ا', 'إ': 'ا', 'آ': 'ا', 'ى': 'ي' })[char]);
  }
  function search(query = '', category = 'all', mode = 'all') {
    const terms = searchKey(query).split(/\s+/u).filter(Boolean);
    return catalog.entries.filter((entry) => {
      if (category !== 'all' && entry.category !== category) return false;
      if (mode === 'local' && entry.kind !== 'local') return false;
      if (mode === 'prompt' && entry.kind === 'local') return false;
      const haystack = searchKey([entry.id, entry.title, entry.summary, entry.request, entry.drawing,
        ...entry.steps, ...entry.limits, ...entry.covers].join(' '));
      return terms.every((term) => haystack.includes(term));
    });
  }
  window.NovaInference = Object.freeze({ buildPrompt, buildDrawing, normalizeFields, search, searchKey });

  function initialize() {
    const $ = (id) => document.getElementById(id);
    const state = { selected: null, category: 'all', mode: 'all', revision: 0, builtRevision: -1, builtPolicy: '' };
    const fieldNodes = { subject: $('subject'), grade: $('grade'), title: $('lesson-title'), source: $('source'), notes: $('notes') };
    function message(text, error = false) {
      $('status').textContent = text;
      $('status').dataset.error = String(error);
    }
    function invalidate() {
      state.revision += 1;
      state.builtRevision = -1;
      $('output').value = '';
      $('copy').disabled = true;
      $('download').disabled = true;
      $('source-count').textContent = count(fieldNodes.source.value) + ' / 12000';
      message('تغيّر الاختيار أو الحقول. أعد البناء قبل النسخ؛ لم يُرسل أو يُحفظ شيء.');
    }
    function fillList(node, values, tag = 'li') {
      node.replaceChildren();
      for (const value of values) {
        const item = document.createElement(tag);
        item.textContent = value;
        node.appendChild(item);
      }
    }
    function renderDetail() {
      const selected = state.selected !== null;
      $('capability-detail').hidden = !selected;
      $('builder').hidden = !selected;
      $('empty-results').hidden = selected;
      $('drawing-section').hidden = true;
      $('drawing-output').value = '';
      $('drawing-status').textContent = '';
      if (!selected) return;
      const entry = capability(state.selected);
      const sacred = $('policy').value === 'sacred';
      const local = entry.kind === 'local' || sacred;
      $('capability-title').textContent = sacred ? 'النصوص المقدسة: مراجعة محلية فقط' : entry.title;
      $('capability-mode').textContent = sacred ? 'حماية يدوية' : entry.kind === 'local' ? 'إعداد من الواجهة' : 'صيغة محتوى متوافقة';
      $('capability-summary').textContent = sacred ? 'القدرة المختارة لا تُشغّل في هذا الوضع. لا يُدرج نصك في طلب أو تعليمات خارجية.' : entry.summary;
      $('destination').textContent = sacred ? 'سياسة المشاهد في البرنامج ← نصوص مقدسة، ثم عرض النص المراجع والطباعة النصية المحلية.' : catalog.targets[entry.target];
      $('normal-detail').hidden = sacred;
      $('sacred-detail').hidden = !sacred;
      $('sacred-detail').textContent = sacred ? catalog.shared.sacred : '';
      fillList($('usage-steps'), entry.steps);
      fillList($('entry-limits'), entry.limits);
      $('expected-result').textContent = entry.result;
      $('example-source').textContent = entry.example.source;
      $('example-output').textContent = entry.example.output;
      $('element-panel').hidden = entry.element === null;
      $('example-element').textContent = entry.element === null ? '' : JSON.stringify(entry.element, null, 2);
      $('content-fields').hidden = local;
      for (const node of Object.values(fieldNodes)) node.disabled = local;
      $('builder-title').textContent = local ? 'خطوات التنفيذ المحلية' : 'جهّز طلبك';
      $('builder-hint').textContent = sacred ? 'لا نسخ للمادة المقدسة، ولا رسم أو توسعة أو صوت أو فيديو جديد. اختيار يدوي وليس كشفًا آليًا.' : local ? 'لا تحتاج هذه القدرة إلى برومبت. اعرض خطوات الواجهة وانسخها إن أردت؛ لا تُدرج حقول المصدر.' : 'يبني الزر طلب تجهيز محتوى، لا ردًا من نموذج. الحقول اختيارية عدا النص المصدر. راجع كل رد خارجي قبل استخدامه.';
      $('build').textContent = local ? 'عرض الخطوات المحلية' : 'بناء الطلب';
      $('copy').textContent = local ? 'نسخ الخطوات' : 'نسخ الطلب';
      $('output-label').textContent = local ? 'تعليمات محلية، بلا نصك المصدر' : 'الطلب الجاهز للنسخ';
      if (entry.drawing && !sacred) {
        $('drawing-section').hidden = false;
        $('drawing-output').value = buildDrawing(entry.id, $('policy').value);
      }
    }
    function select(identifier, remember = true) {
      state.selected = identifier;
      invalidate();
      for (const button of $('capabilities').querySelectorAll('button')) button.setAttribute('aria-pressed', String(button.dataset.capability === identifier));
      renderDetail();
      if (remember && identifier) {
        try { history.replaceState(null, '', '#' + identifier); } catch (_) { /* file viewer may disallow history */ }
      }
    }
    function renderCatalog(preferred = state.selected) {
      const entries = search($('search').value, state.category, state.mode);
      $('match-count').textContent = entries.length + ' من ' + catalog.entries.length + ' قدرة ومسار';
      $('capabilities').replaceChildren();
      for (const entry of entries) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = entry.title;
        button.dataset.capability = entry.id;
        button.setAttribute('aria-pressed', 'false');
        button.addEventListener('click', () => select(entry.id));
        $('capabilities').appendChild(button);
      }
      const identifier = entries.some((entry) => entry.id === preferred) ? preferred : entries.length ? entries[0].id : null;
      // Filtering may change the selected contract, but never rewrites user fields.
      select(identifier, false);
    }
    function setCategory(id) {
      state.category = id;
      for (const button of $('categories').querySelectorAll('button')) button.setAttribute('aria-pressed', String(button.dataset.category === id));
      renderCatalog();
    }
    for (const category of [{ id: 'all', title: 'كل الأقسام' }, ...catalog.categories]) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = category.title;
      button.dataset.category = category.id;
      button.setAttribute('aria-pressed', String(category.id === 'all'));
      button.addEventListener('click', () => setCategory(category.id));
      $('categories').appendChild(button);
    }
    for (const button of document.querySelectorAll('[data-mode]')) {
      button.addEventListener('click', () => {
        state.mode = button.dataset.mode;
        for (const other of document.querySelectorAll('[data-mode]')) other.setAttribute('aria-pressed', String(other === button));
        renderCatalog();
      });
    }
    $('search').addEventListener('input', () => renderCatalog());
    for (const node of Object.values(fieldNodes)) node.addEventListener('input', invalidate);
    $('policy').addEventListener('change', () => { invalidate(); renderDetail(); });
    $('load-example').addEventListener('click', () => {
      if (!state.selected || $('policy').value !== 'general') return;
      const entry = capability(state.selected);
      if (entry.kind === 'local') return;
      if (fieldNodes.source.value.trim() && !window.confirm('سيستبدل المثال المؤلف حقل المصدر فقط. هل تريد المتابعة؟')) return;
      fieldNodes.source.value = entry.example.source;
      invalidate();
      message('أُدرج مثال مؤلف في حقل المصدر فقط، لا نص وزارة أو نتيجة استدلال. اضغط «بناء الطلب» للتجربة.');
    });
    function readFields() {
      const values = {};
      for (const name of fieldsOrder) values[name] = fieldNodes[name].value;
      return values;
    }
    $('build').addEventListener('click', () => {
      invalidate();
      try {
        const policy = $('policy').value;
        $('output').value = buildPrompt(state.selected, readFields(), policy);
        state.builtRevision = state.revision;
        state.builtPolicy = policy;
        $('copy').disabled = false;
        $('download').disabled = false;
        message('جاهز للمراجعة والنسخ فقط. لم يُرسل أو يُنطق أو يُعتمد أو يُصدّر درس.');
      } catch (error) { message(error.message, true); }
    });
    function currentOutput() {
      if (state.builtRevision !== state.revision || state.builtPolicy !== $('policy').value || !$('output').value) throw new Error('أعد البناء بعد أي تعديل أو تغيير سياسة قبل النسخ أو التنزيل.');
      // Rebuild from current fields as well, rather than trusting a DOM textarea.
      const current = buildPrompt(state.selected, readFields(), $('policy').value);
      if (current !== $('output').value) throw new Error('أعد البناء بعد أي تعديل أو تغيير سياسة قبل النسخ أو التنزيل.');
      return current;
    }
    async function copyText(text, node, statusNode, success) {
      try {
        if (!navigator.clipboard || !navigator.clipboard.writeText) throw new Error('clipboard-unavailable');
        await navigator.clipboard.writeText(text);
        statusNode.textContent = success;
      } catch (_) {
        const disclosure = node.closest('details');
        if (disclosure) disclosure.open = true;
        node.focus();
        node.select();
        statusNode.textContent = 'تعذّر النسخ التلقائي في هذا المتصفح. حُدد النص؛ استخدم Ctrl+C أو نسخ من قائمة الجهاز.';
      }
    }
    $('copy').addEventListener('click', async () => {
      try { await copyText(currentOutput(), $('output'), $('status'), 'نُسخ النص للحافظة فقط، بلا إرسال. راجعه قبل لصقه في أي خدمة.'); }
      catch (error) { message(error.message, true); }
    });
    $('copy-drawing').addEventListener('click', async () => {
      try {
        const text = buildDrawing(state.selected, $('policy').value);
        $('drawing-output').value = text;
        await copyText(text, $('drawing-output'), $('drawing-status'), 'نُسخت متطلبات الرسم فقط. ألحقها بتوجيه البرنامج المرتبط بالمصدر، لا بالسكريبت المنطوق.');
      } catch (error) { $('drawing-status').textContent = error.message; }
    });
    $('download').addEventListener('click', () => {
      let url;
      try {
        const text = currentOutput();
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'NovaVoice-Istidlal-' + ($('policy').value === 'sacred' ? 'local-review' : state.selected) + '.txt';
        document.body.appendChild(link);
        link.click();
        link.remove();
        message('أُعد ملف TXT للتنزيل بطلبك. ليس خطة JSON أو درسًا معتمدًا.');
      } catch (_) { message('تعذّر التنزيل؛ أعد البناء أو انسخ النص يدويًا.', true); }
      finally { if (url) setTimeout(() => URL.revokeObjectURL(url), 1000); }
    });
    $('total-count').textContent = String(catalog.entries.length);
    fillList($('unsupported'), catalog.unsupported);
    fillList($('source-files'), catalog.source_files);
    let initial = 'pdf-text';
    try {
      const hash = decodeURIComponent(location.hash.slice(1));
      if (catalog.entries.some((entry) => entry.id === hash)) initial = hash;
    } catch (_) { /* Invalid fragments do not become markup or input. */ }
    renderCatalog(initial);
    message('اختر القدرة وألصق المصدر ثم اضغط «بناء الطلب». لا استدلال حي هنا.');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
  else initialize();
}());
