<script setup>
import { onMounted, ref } from 'vue'
import { Copy } from '@vicons/fa'

const emit = defineEmits(['load'])

const DOMAIN = 'jpanti.world'
const STORAGE_KEY = 'publicViewerAddress'

const address = ref('')
const loading = ref(false)

const normalizeAddress = (value) => {
  const raw = String(value || '').trim().toLowerCase()

  if (!raw) return ''

  // Convenience: entering only "abc" becomes "abc@jpanti.world".
  if (!raw.includes('@')) {
    return `${raw}@${DOMAIN}`
  }

  return raw
}

const isValidViewerAddress = (value) => {
  const normalized = normalizeAddress(value)

  return /^[a-z0-9][a-z0-9._+-]*@jpanti\.world$/i.test(normalized)
}

const loadMailbox = () => {
  const normalized = normalizeAddress(address.value)

  if (!isValidViewerAddress(normalized)) {
    window.alert(`Please enter a valid @${DOMAIN} address`)
    return
  }

  address.value = normalized
  localStorage.setItem(STORAGE_KEY, normalized)
  emit('load', normalized)
}

const randomLocalPart = (length = 10) => {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)

  return Array.from(
    bytes,
    (byte) => chars[byte % chars.length]
  ).join('')
}

const randomAddress = () => {
  loading.value = true

  try {
    address.value = `${randomLocalPart()}@${DOMAIN}`
    loadMailbox()
  } finally {
    loading.value = false
  }
}

const copyAddress = async () => {
  const normalized = normalizeAddress(address.value)

  if (!isValidViewerAddress(normalized)) return

  address.value = normalized

  try {
    await navigator.clipboard.writeText(normalized)
  } catch (error) {
    console.error('Copy failed', error)
  }
}

const onEnter = () => {
  loadMailbox()
}

onMounted(() => {
  const savedAddress = localStorage.getItem(STORAGE_KEY)

  if (savedAddress && isValidViewerAddress(savedAddress)) {
    address.value = normalizeAddress(savedAddress)
    emit('load', address.value)
    return
  }

  randomAddress()
})
</script>

<template>
  <div class="viewer-address-root">
    <div class="viewer-control-card">
      <div class="viewer-control-row">

        <div class="viewer-address-input">
          <n-input
            v-model:value="address"
            placeholder="Enter email address"
            clearable
            @keyup.enter="onEnter"
          />
        </div>

        <n-button
          class="viewer-button viewer-load-button"
          @click="loadMailbox"
        >
          Load
        </n-button>

        <n-button
          class="viewer-button"
          :loading="loading"
          @click="randomAddress"
        >
          Random
        </n-button>

        <n-button
          class="viewer-button"
          @click="copyAddress"
        >
          <template #icon>
            <n-icon :component="Copy" />
          </template>
          Copy
        </n-button>

      </div>
    </div>
  </div>
</template>

<style scoped>
.viewer-address-root {
  width: 100%;
}

.viewer-control-card {
  width: 100%;
  box-sizing: border-box;
  padding: 20px 24px;
  background: #151922;
  border: 1px solid #2c3442;
  border-radius: 12px;
  box-shadow: 0 18px 45px rgba(0, 0, 0, 0.18);
}

.viewer-control-row {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
}

.viewer-address-input {
  flex: 1 1 auto;
  min-width: 0;
}

.viewer-address-input :deep(.n-input) {
  min-height: 44px;
  background: #0c1017 !important;
  border-radius: 8px;
}

.viewer-address-input :deep(.n-input-wrapper) {
  min-height: 44px;
}

.viewer-address-input :deep(.n-input__input-el) {
  color: #dce5f2 !important;
}

.viewer-address-input :deep(.n-input__placeholder) {
  color: #798499 !important;
}

.viewer-button {
  height: 44px;
  min-width: 88px;
  padding: 0 20px;
  border-radius: 8px;
  font-weight: 600;
  color: #e6edf7;
  background: #1c2230;
  border: 1px solid #2b3445;
}

.viewer-button:hover {
  color: #ffffff;
  background: #252d3c;
  border-color: #3a4559;
}

.viewer-load-button {
  color: #071512 !important;
  background: #10d6bd !important;
  border-color: #10d6bd !important;
}

.viewer-load-button:hover {
  background: #20e3c9 !important;
  border-color: #20e3c9 !important;
}

@media (max-width: 720px) {
  .viewer-control-card {
    padding: 14px;
  }

  .viewer-control-row {
    flex-wrap: wrap;
  }

  .viewer-address-input {
    flex: 1 1 100%;
    width: 100%;
  }

  .viewer-button {
    flex: 1 1 0;
    min-width: 0;
    padding: 0 10px;
  }
}

@media (max-width: 420px) {
  .viewer-button {
    font-size: 12px;
  }
}
</style>
