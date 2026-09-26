<script setup>
import { onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import { useGlobalState } from '../store'
import { api } from '../api'

import AddressBar from './index/AddressBar.vue'
import MailBox from '../components/MailBox.vue'

const {
  openSettings
} = useGlobalState()

const message = useMessage()
const route = useRoute()

/* =========================================================
   PUBLIC VIEWER STATE
   ========================================================= */

const viewerAddress = ref('')
const mailBoxKey = ref('')

const mailIdQuery = ref('')
const showMailIdQuery = ref(false)

const queryMail = () => {
  mailBoxKey.value = String(Date.now())
}

const loadPublicMailbox = (address) => {
  viewerAddress.value = String(address || '').trim().toLowerCase()
  mailIdQuery.value = ''
  showMailIdQuery.value = false
  queryMail()
}

/* =========================================================
   PUBLIC MAIL DATA — READ ONLY
   ========================================================= */

const fetchMailData = async (limit, offset) => {
  if (!viewerAddress.value) {
    return {
      results: [],
      count: 0
    }
  }

  const encodedAddress = encodeURIComponent(viewerAddress.value)

  if (mailIdQuery.value > 0) {
    const singleMail = await api.fetch(
      `/open_api/public_mail/${mailIdQuery.value}?address=${encodedAddress}`
    )

    if (singleMail) {
      return {
        results: [singleMail],
        count: 1
      }
    }

    return {
      results: [],
      count: 0
    }
  }

  return await api.fetch(
    `/open_api/public_mails?address=${encodedAddress}&limit=${limit}&offset=${offset}`
  )
}

/* =========================================================
   PUBLIC VIEWER MUTATIONS
   =========================================================
   Homepage public viewer is intentionally READ ONLY.
   Delete and read-status mutation remain protected by JWT.
   ========================================================= */

const deleteMail = async () => {
  message.warning('Public mailbox is read-only')
}

const updateMailReadStatus = async () => {
  // Intentionally disabled for the public viewer.
}

/* =========================================================
   S3 ATTACHMENT
   ========================================================= */

const saveToS3 = async (
  mail_id,
  filename,
  blob
) => {
  try {
    const { url } = await api.fetch(
      `/api/attachment/put_url`,
      {
        method: 'POST',
        body: JSON.stringify({
          key: `${mail_id}/${filename}`
        })
      }
    )

    const formData = new FormData()

    formData.append(
      filename,
      blob
    )

    await fetch(
      url,
      {
        method: 'PUT',
        body: formData
      }
    )

    message.success(
      'Saved successfully'
    )
  } catch (error) {
    console.error(error)

    message.error(
      error.message ||
      'Save to S3 error'
    )
  }
}

/* =========================================================
   ROUTE WATCH
   ========================================================= */

watch(
  () => route.query.mail_id,
  (mailId) => {
    if (mailId) {
      showMailIdQuery.value = true
      mailIdQuery.value = String(mailId)
      queryMail()
      return
    }

    showMailIdQuery.value = false
    mailIdQuery.value = ''
    queryMail()
  }
)

/* =========================================================
   INITIAL LOAD
   ========================================================= */

onMounted(() => {
  if (route.query.mail_id) {
    showMailIdQuery.value = true
    mailIdQuery.value = String(route.query.mail_id)
  }
})
</script>

<template>
  <main class="mail-viewer-page">
    <div class="mail-viewer-container">

      <header class="mail-viewer-hero">
        <h1>
          Mail Viewer
        </h1>

        <p>
          Enter email and click Load to view inbox
        </p>
      </header>

      <div class="mail-viewer-divider"></div>

      <section class="mail-viewer-address">
        <AddressBar @load="loadPublicMailbox" />
      </section>

      <section
        v-if="viewerAddress && showMailIdQuery"
        class="mail-query-card"
      >
        <n-input-group>
          <n-input
            v-model:value="mailIdQuery"
            placeholder="Mail ID"
          />

          <n-button
            type="primary"
            @click="queryMail"
          >
            Load
          </n-button>
        </n-input-group>
      </section>

      <section
        v-if="viewerAddress"
        class="mail-viewer-workspace"
      >
        <MailBox
          :key="mailBoxKey"
          :showEMailTo="false"
          :showReply="false"
          :showSaveS3="false"
          :saveToS3="saveToS3"
          :enableUserDeleteEmail="false"
          :fetchMailData="fetchMailData"
          :deleteMail="deleteMail"
          :showFilterInput="false"
          :enableMailReadStatus="false"
          :updateMailReadStatus="updateMailReadStatus"
        />
      </section>

      <section
        v-else
        class="mail-viewer-empty"
      >
        <div class="empty-mailbox-panel">
          <span>
            MailBox
          </span>
        </div>

        <div class="empty-content-panel">
          Email content will appear here.
        </div>
      </section>

    </div>
  </main>
</template>

<style scoped>

/* =========================================================
   PAGE
   ========================================================= */

.mail-viewer-page {
  width: 100%;

  min-height: 100vh;

  box-sizing: border-box;

  padding:
    30px
    24px
    60px;

  background:
    #0b0f14;

  color:
    #edf2f7;
}


/* =========================================================
   CONTAINER
   ========================================================= */

.mail-viewer-container {
  width: 100%;

  max-width:
    1060px;

  margin:
    0 auto;
}


/* =========================================================
   HERO
   ========================================================= */

.mail-viewer-hero {
  text-align:
    center;

  padding:
    0
    20px
    23px;
}


.mail-viewer-hero h1 {
  margin:
    0;

  color:
    #68ead4;

  font-size:
    30px;

  font-weight:
    700;

  line-height:
    1.2;

  letter-spacing:
    -0.6px;
}


.mail-viewer-hero p {
  margin:
    11px
    0
    0;

  color:
    #a7b0c0;

  font-size:
    14px;

  font-weight:
    400;

  line-height:
    1.5;
}


/* =========================================================
   DIVIDER
   ========================================================= */

.mail-viewer-divider {
  width:
    100%;

  height:
    1px;

  margin-bottom:
    24px;

  background:
    #29303c;
}


/* =========================================================
   ADDRESS
   ========================================================= */

.mail-viewer-address {
  width:
    100%;

  margin-bottom:
    20px;
}


/* =========================================================
   MAIL QUERY
   ========================================================= */

.mail-query-card {
  width:
    100%;

  box-sizing:
    border-box;

  margin-bottom:
    18px;

  padding:
    14px;

  background:
    #151a23;

  border:
    1px solid #2b3340;

  border-radius:
    10px;
}


/* =========================================================
   MAILBOX WORKSPACE
   ========================================================= */

.mail-viewer-workspace {
  width:
    100%;
}


/* =========================================================
   EMPTY MAILBOX PREVIEW
   ========================================================= */

.mail-viewer-empty {
  display:
    grid;

  grid-template-columns:
    minmax(280px, 0.9fr)
    minmax(0, 1.7fr);

  gap:
    18px;

  width:
    100%;
}


.empty-mailbox-panel,
.empty-content-panel {
  min-height:
    330px;

  box-sizing:
    border-box;

  background:
    #151a23;

  border:
    1px solid #2b3340;

  border-radius:
    10px;
}


.empty-mailbox-panel {
  padding:
    18px;
}


.empty-mailbox-panel span {
  color:
    #edf2f7;

  font-size:
    16px;

  font-weight:
    600;
}


.empty-content-panel {
  display:
    flex;

  align-items:
    center;

  justify-content:
    center;

  padding:
    24px;

  color:
    #7e899a;

  font-size:
    14px;
}


/* =========================================================
   NAIVE UI — DARK HOMEPAGE
   ========================================================= */

.mail-viewer-page :deep(.n-card) {
  background:
    #151a23;

  color:
    #edf2f7;

  border-color:
    #2b3340;
}


.mail-viewer-page :deep(.n-alert) {
  background:
    #151a23;

  color:
    #edf2f7;

  border:
    1px solid #2b3340;
}


.mail-viewer-page :deep(.n-list) {
  background:
    #151a23;

  color:
    #edf2f7;
}


.mail-viewer-page :deep(.n-list-item) {
  color:
    #edf2f7;

  border-color:
    #2b3340;
}


.mail-viewer-page :deep(.n-thing) {
  color:
    #edf2f7;
}


.mail-viewer-page :deep(
  .n-thing-header__title
) {
  color:
    #edf2f7;
}


/* =========================================================
   INPUT
   ========================================================= */

.mail-viewer-page :deep(.n-input) {
  --n-color:
    #0d1118;

  --n-color-focus:
    #0d1118;

  --n-border:
    1px solid #303847;

  --n-border-hover:
    1px solid #465164;

  --n-border-focus:
    1px solid #35d5be;

  --n-text-color:
    #edf2f7;

  --n-placeholder-color:
    #737f91;
}


/* =========================================================
   SELECT
   ========================================================= */

.mail-viewer-page
:deep(.n-base-selection) {

  --n-color:
    #0d1118;

  --n-color-active:
    #0d1118;

  --n-border:
    1px solid #303847;

  --n-border-active:
    1px solid #35d5be;

  --n-text-color:
    #edf2f7;
}


/* =========================================================
   RESPONSIVE
   ========================================================= */

@media
(max-width: 768px) {

  .mail-viewer-page {
    padding:
      22px
      12px
      40px;
  }


  .mail-viewer-container {
    max-width:
      100%;
  }


  .mail-viewer-hero {
    padding:
      0
      10px
      19px;
  }


  .mail-viewer-hero h1 {
    font-size:
      26px;
  }


  .mail-viewer-hero p {
    font-size:
      13px;
  }


  .mail-viewer-divider {
    margin-bottom:
      18px;
  }


  .mail-viewer-address {
    margin-bottom:
      16px;
  }


  .mail-viewer-empty {
    grid-template-columns:
      1fr;
  }


  .empty-mailbox-panel {
    min-height:
      180px;
  }


  .empty-content-panel {
    min-height:
      260px;
  }

}

</style>
