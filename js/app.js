import { fetchProductBySlug, saveDesign } from './supabase.js';

const PRODUCT_SLUG = 'original-jersey';

const state = {
  product: null,
  parts: [],
  selections: {}, // part.key -> option
};

const partsContainer = document.getElementById('parts-container');
const priceValueEl = document.getElementById('price-value');
const numberInput = document.getElementById('custom-number');
const numberText = document.getElementById('jersey-number');
const nameInput = document.getElementById('design-name');
const saveBtn = document.getElementById('save-btn');
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

    renderSidebar();
    applySelectionsToPreview();
    updatePrice();
  } catch (err) {
    partsContainer.innerHTML = `<p class="loading">読み込みに失敗しました。${escapeHtml(err.message || String(err))}</p>`;
    console.error(err);
  }
}

function renderSidebar() {
  partsContainer.innerHTML = '';
  state.parts.forEach((part) => {
    const group = document.createElement('div');
    group.className = 'option-group';

    const heading = document.createElement('h2');
    heading.textContent = part.label;
    group.appendChild(heading);

    const swatches = document.createElement('div');
    swatches.className = 'swatches';

    part.part_options.forEach((option) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'swatch';
      btn.style.background = option.color_hex;
      btn.title = option.label;
      btn.setAttribute('aria-label', `${part.label}: ${option.label}`);
      if (state.selections[part.key]?.id === option.id) {
        btn.classList.add('selected');
      }
      btn.addEventListener('click', () => selectOption(part, option, swatches, btn));
      swatches.appendChild(btn);
    });

    group.appendChild(swatches);
    partsContainer.appendChild(group);
  });
}

function selectOption(part, option, swatchesEl, btn) {
  state.selections[part.key] = option;
  [...swatchesEl.children].forEach((el) => el.classList.remove('selected'));
  btn.classList.add('selected');
  applySelectionsToPreview();
  updatePrice();
}

function applySelectionsToPreview() {
  Object.entries(state.selections).forEach(([key, option]) => {
    const el = document.getElementById(`part-${key}`);
    if (el) el.setAttribute('fill', option.color_hex);
  });
}

function updatePrice() {
  const base = state.product?.base_price || 0;
  const extra = Object.values(state.selections).reduce((sum, opt) => sum + (opt.price_delta || 0), 0);
  priceValueEl.textContent = `¥${(base + extra).toLocaleString('ja-JP')}`;
}

numberInput.addEventListener('input', () => {
  const digitsOnly = numberInput.value.replace(/[^0-9]/g, '').slice(0, 2);
  numberInput.value = digitsOnly;
  numberText.textContent = digitsOnly || '';
});

saveBtn.addEventListener('click', async () => {
  if (!state.product) return;
  saveBtn.disabled = true;
  saveResultEl.textContent = '';
  saveResultEl.className = 'save-result';

  const selectionIds = {};
  Object.entries(state.selections).forEach(([key, option]) => {
    selectionIds[key] = option.id;
  });

  try {
    const design = await saveDesign({
      productId: state.product.id,
      name: nameInput.value.trim(),
      selections: selectionIds,
      customText: numberInput.value,
    });
    saveResultEl.textContent = `保存しました！ デザインID: ${design.id}`;
    saveResultEl.className = 'save-result success';
  } catch (err) {
    saveResultEl.textContent = `保存に失敗しました: ${err.message || err}`;
    saveResultEl.className = 'save-result error';
    console.error(err);
  } finally {
    saveBtn.disabled = false;
  }
});

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
