import { fetchProductBySlug, saveDesign } from './supabase.js';

const PRODUCT_SLUG = 'custom-bottle';

const CAP_IMAGES = {
  '黒': '/images/caps/black.jpg',
  '金': '/images/caps/gold.jpg',
  '銀': '/images/caps/silver.jpg',
  '赤': '/images/caps/red.jpg',
  '青': '/images/caps/blue.jpg',
};

const BOTTLE_IMAGES = {
  '光沢 茶色': '/images/bottles/brown_g.jpg',
  '光沢 緑': '/images/bottles/green_g.jpg',
  '光沢 青': '/images/bottles/blue_g.jpg',
  'つや消し 青': '/images/bottles/blue_f.jpg',
  'つや消し 白': '/images/bottles/white_f.jpg',
  'つや消し 黒': '/images/bottles/black_f.jpg',
  'つや消し 緑': '/images/bottles/green_f.jpg',
};

const NECK_LABEL_IMAGES = {
  '手書き 赤文字': '/images/neck-labels/handwritten-red.png',
  '手書き 黒文字': '/images/neck-labels/handwritten-black.png',
};

const PHOTO_OPTIONS_BY_PART = { cap: CAP_IMAGES, bottle: BOTTLE_IMAGES, neck_label: NECK_LABEL_IMAGES };

const neckLabelPhotoEl = document.getElementById('part-neck_label-photo');

const state = {
  product: null,
  parts: [],
  selections: {}, // part.key -> option
  mainLabelText: 'MY LABEL',
  neckLabelText: 'NECK LABEL',
  designName: '',
  steps: [], // built after product loads: [{type:'part', part}, {type:'labels'}, {type:'name'}]
  stepIndex: 0,
};

const priceValueEl = document.getElementById('price-value');
const mainLabelTextEl = document.getElementById('main-label-text');
const neckLabelTextEl = document.getElementById('neck-label-text');
const stepProgressEl = document.getElementById('step-progress');
const stepTitleEl = document.getElementById('step-title');
const stepBodyEl = document.getElementById('step-body');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const saveResultEl = document.getElementById('save-result');

init();

async function init() {
  try {
    const { product, parts } = await fetchProductBySlug(PRODUCT_SLUG);
    state.product = product;
    state.parts = parts;

    parts.forEach((part) => {
      const defaultOption = part.part_options[0];
      if (defaultOption) state.selections[part.key] = defaultOption;
    });

    state.steps = [
      ...parts.map((part) => ({ type: 'part', part })),
      { type: 'labels' },
      { type: 'name' },
    ];

    applySelectionsToPreview();
    updatePrice();
    renderStep();
  } catch (err) {
    stepTitleEl.textContent = '読み込みに失敗しました';
    stepBodyEl.innerHTML = `<p class="loading">${escapeHtml(err.message || String(err))}</p>`;
    console.error(err);
  }
}

function renderStep() {
  const step = state.steps[state.stepIndex];
  renderProgress();

  if (step.type === 'part') {
    renderPartStep(step.part);
  } else if (step.type === 'labels') {
    renderLabelsStep();
  } else if (step.type === 'name') {
    renderNameStep();
  }

  prevBtn.disabled = state.stepIndex === 0;
  const isLast = state.stepIndex === state.steps.length - 1;
  nextBtn.textContent = isLast ? 'このデザインを保存する' : '次へ';
}

function renderProgress() {
  stepProgressEl.innerHTML = '';
  state.steps.forEach((_, i) => {
    const dot = document.createElement('span');
    dot.className = 'step-dot';
    if (i < state.stepIndex) dot.classList.add('done');
    if (i === state.stepIndex) dot.classList.add('active');
    stepProgressEl.appendChild(dot);
  });
}

function renderPartStep(part) {
  const stepNum = state.stepIndex + 1;
  stepTitleEl.textContent = `${stepNum}. ${part.label}をお選びください`;
  stepBodyEl.innerHTML = '';

  const swatches = document.createElement('div');
  swatches.className = 'swatches';

  part.part_options.forEach((option) => {
    const cell = document.createElement('div');
    cell.className = 'swatch-cell';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'swatch';
    const photoMap = PHOTO_OPTIONS_BY_PART[part.key];
    const photo = photoMap && photoMap[option.label];
    if (photo) {
      btn.classList.add('swatch-photo');
      btn.style.backgroundImage = `url(${photo})`;
    } else {
      btn.style.background = option.color_hex;
    }
    btn.setAttribute('aria-label', `${part.label}: ${option.label}`);
    if (state.selections[part.key]?.id === option.id) {
      btn.classList.add('selected');
    }
    btn.addEventListener('click', () => selectOption(part, option, swatches, btn));

    const label = document.createElement('span');
    label.className = 'swatch-label';
    label.textContent = option.label;

    cell.appendChild(btn);
    cell.appendChild(label);
    swatches.appendChild(cell);
  });

  stepBodyEl.appendChild(swatches);
}

function renderLabelsStep() {
  const stepNum = state.stepIndex + 1;
  stepTitleEl.textContent = `${stepNum}. ラベルの文字を入力してください`;
  stepBodyEl.innerHTML = '';

  const group1 = document.createElement('div');
  group1.className = 'option-group';
  const h1 = document.createElement('h2');
  h1.textContent = 'メインラベルの文字';
  const input1 = document.createElement('input');
  input1.type = 'text';
  input1.maxLength = 10;
  input1.value = state.mainLabelText;
  input1.addEventListener('input', () => {
    state.mainLabelText = input1.value;
    mainLabelTextEl.textContent = input1.value;
  });
  group1.append(h1, input1);

  const group2 = document.createElement('div');
  group2.className = 'option-group';
  const h2 = document.createElement('h2');
  h2.textContent = '首ラベルの文字';
  const input2 = document.createElement('input');
  input2.type = 'text';
  input2.maxLength = 8;
  input2.value = state.neckLabelText;
  input2.addEventListener('input', () => {
    state.neckLabelText = input2.value;
    neckLabelTextEl.textContent = input2.value;
  });
  group2.append(h2, input2);

  stepBodyEl.append(group1, group2);
}

function renderNameStep() {
  const stepNum = state.stepIndex + 1;
  stepTitleEl.textContent = `${stepNum}. デザイン名を付けて保存`;
  stepBodyEl.innerHTML = '';

  const group = document.createElement('div');
  group.className = 'option-group';
  const h2 = document.createElement('h2');
  h2.textContent = 'デザイン名（任意）';
  const input = document.createElement('input');
  input.type = 'text';
  input.maxLength = 40;
  input.placeholder = '例）父の日ギフト用';
  input.value = state.designName;
  input.addEventListener('input', () => {
    state.designName = input.value;
  });
  group.append(h2, input);
  stepBodyEl.append(group);
}

function selectOption(part, option, swatchesEl, btn) {
  const changed = state.selections[part.key]?.id !== option.id;
  state.selections[part.key] = option;
  [...swatchesEl.querySelectorAll('.swatch')].forEach((el) => el.classList.remove('selected'));
  btn.classList.add('selected');
  applySelectionsToPreview();
  updatePrice();
  if (changed) flashPart(part.key);
}

function applySelectionsToPreview() {
  Object.entries(state.selections).forEach(([key, option]) => {
    const el = document.getElementById(`part-${key}`);
    if (!el) return;
    const photoMap = PHOTO_OPTIONS_BY_PART[key];
    const photo = photoMap && photoMap[option.label];

    if (key === 'neck_label') {
      if (photo) {
        neckLabelPhotoEl.setAttribute('href', photo);
        neckLabelPhotoEl.style.display = '';
        neckLabelTextEl.style.display = 'none';
      } else {
        neckLabelPhotoEl.style.display = 'none';
        neckLabelTextEl.style.display = '';
        el.setAttribute('fill', option.color_hex);
      }
      return;
    }

    if (photo) {
      el.setAttribute('href', photo);
    } else {
      el.setAttribute('fill', option.color_hex);
    }
  });
}

function flashPart(key) {
  const el = key === 'neck_label' && neckLabelPhotoEl.style.display !== 'none'
    ? neckLabelPhotoEl
    : document.getElementById(`part-${key}`);
  if (!el) return;
  el.classList.remove('part-flash');
  void el.offsetWidth;
  el.classList.add('part-flash');
  el.addEventListener('animationend', () => el.classList.remove('part-flash'), { once: true });
}

function updatePrice() {
  const base = state.product?.base_price || 0;
  const extra = Object.values(state.selections).reduce((sum, opt) => sum + (opt.price_delta || 0), 0);
  priceValueEl.textContent = `¥${(base + extra).toLocaleString('ja-JP')}`;
}

prevBtn.addEventListener('click', () => {
  if (state.stepIndex === 0) return;
  state.stepIndex -= 1;
  renderStep();
});

nextBtn.addEventListener('click', () => {
  const isLast = state.stepIndex === state.steps.length - 1;
  if (!isLast) {
    state.stepIndex += 1;
    renderStep();
    return;
  }
  handleSave();
});

async function handleSave() {
  if (!state.product) return;
  nextBtn.disabled = true;
  saveResultEl.textContent = '';
  saveResultEl.className = 'save-result';

  const selectionIds = {};
  Object.entries(state.selections).forEach(([key, option]) => {
    selectionIds[key] = option.id;
  });
  selectionIds.mainLabelText = state.mainLabelText;
  selectionIds.neckLabelText = state.neckLabelText;

  try {
    const design = await saveDesign({
      productId: state.product.id,
      name: state.designName.trim(),
      selections: selectionIds,
    });
    saveResultEl.textContent = `保存しました！ デザインID: ${design.id}`;
    saveResultEl.className = 'save-result success';
  } catch (err) {
    saveResultEl.textContent = `保存に失敗しました: ${err.message || err}`;
    saveResultEl.className = 'save-result error';
    console.error(err);
  } finally {
    nextBtn.disabled = false;
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
