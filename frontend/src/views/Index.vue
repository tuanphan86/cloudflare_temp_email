<script setup>
import { defineAsyncComponent, onMounted, watch } from 'vue'
import { useScopedI18n } from '@/i18n/app'
import { useRoute } from 'vue-router'

import { useGlobalState } from '../store'
import { api } from '../api'
import { useIsMobile } from '../utils/composables'
import { FullscreenExitOutlined } from '@vicons/material'

import AddressBar from './index/AddressBar.vue'
import MailBox from '../components/MailBox.vue'
import SendBox from '../components/SendBox.vue'
import AutoReply from './index/AutoReply.vue'
import AccountSettings from './index/AccountSettings.vue'
import Appearance from './common/Appearance.vue'
import Webhook from './index/Webhook.vue'
import Attachment from './index/Attachment.vue'
import About from './common/About.vue'
import SimpleIndex from './index/SimpleIndex.vue'

const {
  loading,
  settings,
  openSettings,
  indexTab,
  globalTabplacement,
  useSimpleIndex
} = useGlobalState()

const message = useMessage()
const route = useRoute()
const isMobile = useIsMobile()

const SendMail = defineAsyncComponent(() => {
  loading.value = true

  return import('./index/SendMail.vue')
    .finally(() => loading.value = false)
})

const { t } = useScopedI18n('views.Index')

const fetchMailData = async (limit, offset) => {
  if (mailIdQuery.value > 0) {
    const singleMail = await api.fetch(`/api/mail/${mailIdQuery.value}`)

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
    `/api/mails?limit=${limit}&offset=${offset}`
  )
}

const deleteMail = async (curMailId) => {
  await api.fetch(
    `/api/mails/${curMailId}`,
    {
      method: 'DELETE'
    }
  )
}

const deleteSenboxMail = async (curMailId) => {
  await api.fetch(
    `/api/sendbox/${curMailId}`,
    {
      method: 'DELETE'
    }
  )
}

const fetchSenboxData = async (limit, offset) => {
  return await api.fetch(
    `/api/sendbox?limit=${limit}&offset=${offset}`
  )
}

const saveToS3 = async (mail_id, filename, blob) => {
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

    formData.append(filename, blob)

    await fetch(
      url,
      {
        method: 'PUT',
        body: formData
      }
    )

    message.success(
      t('saveToS3Success')
    )
  } catch (error) {
    console.error(error)

    message.error(
      error.message || 'save to s3 error'
    )
  }
}

const mailBoxKey = ref('')
const mailIdQuery = ref('')
const showMailIdQuery = ref(false)

const queryMail = () => {
  mailBoxKey.value = Date.now()
}

watch(route, () => {
  if (!route.query.mail_id) {
    showMailIdQuery.value = false
    mailIdQuery.value = ''
    queryMail()
  }
})

onMounted(() => {
  if (route.query.mail_id) {
    showMailIdQuery.value = true
    mailIdQuery.value = route.query.mail_id
    queryMail()
  }
})
</script>


<template>

  <!-- SIMPLE MODE -->
  <div v-if="useSimpleIndex">
    <SimpleIndex />
  </div>


  <!-- MAIL VIEWER MODE -->
  <div
    v-else
    class="mail-viewer-page"
  >

    <div class="mail-viewer-shell">


      <!-- ============================= -->
      <!-- HERO -->
      <!-- ============================= -->

      <header class="mail-viewer-hero">

        <h1>
          Mail Viewer
        </h1>

        <p>
          Enter email and click Load to view inbox
        </p>

      </header>


      <div class="mail-viewer-divider"></div>


      <!-- ============================= -->
      <!-- ADDRESS BAR -->
      <!-- ============================= -->

      <section class="mail-viewer-address">

        <AddressBar />

      </section>


      <!-- ============================= -->
      <!-- MAILBOX WORKSPACE -->
      <!-- ============================= -->

      <section
        v-if="settings.address"
        class="mail-viewer-workspace"
      >

        <n-tabs
          type="card"
          v-model:value="indexTab"
          :placement="globalTabplacement"
          class="mail-viewer-tabs"
        >


          <!-- SIMPLE MODE BUTTON -->

          <template
            #prefix
            v-if="!isMobile"
          >

            <n-button
              @click="useSimpleIndex = true"
              tertiary
              size="small"
            >

              <template #icon>

                <n-icon>

                  <FullscreenExitOutlined />

                </n-icon>

              </template>

              {{ t('enterSimpleMode') }}

            </n-button>

          </template>


          <!-- ============================= -->
          <!-- MAILBOX -->
          <!-- ============================= -->

          <n-tab-pane
            name="mailbox"
            :tab="t('mailbox')"
          >


            <!-- MAIL ID QUERY -->

            <div
              v-if="showMailIdQuery"
              class="mail-query"
            >

              <n-input-group>

                <n-input
                  v-model:value="mailIdQuery"
                />

                <n-button
                  @click="queryMail"
                  type="primary"
                  tertiary
                >

                  {{ t('query') }}

                </n-button>

              </n-input-group>

            </div>


            <!-- ACTUAL MAILBOX -->

            <MailBox
              :key="mailBoxKey"
              :showEMailTo="false"
              :showReply="openSettings.enableSendMail"
              :showSaveS3="openSettings.isS3Enabled"
              :saveToS3="saveToS3"
              :enableUserDeleteEmail="openSettings.enableUserDeleteEmail"
              :fetchMailData="fetchMailData"
              :deleteMail="deleteMail"
              :showFilterInput="true"
            />

          </n-tab-pane>


          <!-- ============================= -->
          <!-- SENT MAIL -->
          <!-- ============================= -->

          <n-tab-pane
            v-if="openSettings.enableSendMail"
            name="sendbox"
            :tab="t('sendbox')"
          >

            <SendBox
              :fetchMailData="fetchSenboxData"
              :enableUserDeleteEmail="openSettings.enableUserDeleteEmail"
              :deleteMail="deleteSenboxMail"
            />

          </n-tab-pane>


          <!-- ============================= -->
          <!-- SEND MAIL -->
          <!-- ============================= -->

          <n-tab-pane
            v-if="openSettings.enableSendMail"
            name="sendmail"
            :tab="t('sendmail')"
          >

            <SendMail />

          </n-tab-pane>


          <!-- ============================= -->
          <!-- MAILBOX SETTINGS -->
          <!-- ============================= -->

          <n-tab-pane
            name="accountSettings"
            :tab="t('accountSettings')"
          >

            <AccountSettings />

          </n-tab-pane>


          <!-- ============================= -->
          <!-- APPEARANCE -->
          <!-- ============================= -->

          <n-tab-pane
            name="appearance"
            :tab="t('appearance')"
          >

            <Appearance
              :showUseSimpleIndex="true"
            />

          </n-tab-pane>


          <!-- ============================= -->
          <!-- AUTO REPLY -->
          <!-- ============================= -->

          <n-tab-pane
            v-if="openSettings.enableAutoReply"
            name="auto_reply"
            :tab="t('auto_reply')"
          >

            <AutoReply />

          </n-tab-pane>


          <!-- ============================= -->
          <!-- WEBHOOK -->
          <!-- ============================= -->

          <n-tab-pane
            v-if="openSettings.enableWebhook"
            name="webhook"
            :tab="t('webhookSettings')"
          >

            <Webhook />

          </n-tab-pane>


          <!-- ============================= -->
          <!-- S3 ATTACHMENT -->
          <!-- ============================= -->

          <n-tab-pane
            v-if="openSettings.isS3Enabled"
            name="s3_attachment"
            :tab="t('s3Attachment')"
          >

            <Attachment />

          </n-tab-pane>


          <!-- ============================= -->
          <!-- ABOUT -->
          <!-- ============================= -->

          <n-tab-pane
            v-if="openSettings.enableIndexAbout"
            name="about"
            :tab="t('about')"
          >

            <About />

          </n-tab-pane>

        </n-tabs>

      </section>

    </div>

  </div>

</template>


<style scoped>

/* ========================================= */
/* PAGE */
/* ========================================= */

.mail-viewer-page {
  width: 100%;
  min-height: 100vh;

  box-sizing: border-box;

  padding:
    28px
    24px
    60px;

  background:
    #0c0f14;

  color:
    #e8edf5;
}


.mail-viewer-shell {
  width: 100%;

  max-width:
    1060px;

  margin:
    0 auto;
}


/* ========================================= */
/* HERO */
/* ========================================= */

.mail-viewer-hero {
  text-align:
    center;

  padding:
    0
    20px
    22px;
}


.mail-viewer-hero h1 {
  margin:
    0;

  color:
    #75e6d2;

  font-size:
    29px;

  line-height:
    1.25;

  font-weight:
    700;

  letter-spacing:
    -0.5px;
}


.mail-viewer-hero p {
  margin:
    10px
    0
    0;

  color:
    #aab3c5;

  font-size:
    14px;

  line-height:
    1.6;
}


.mail-viewer-divider {
  width:
    100%;

  height:
    1px;

  margin-bottom:
    24px;

  background:
    #2a303c;
}


/* ========================================= */
/* ADDRESS */
/* ========================================= */

.mail-viewer-address {
  width:
    100%;

  margin-bottom:
    20px;
}


/* ========================================= */
/* WORKSPACE */
/* ========================================= */

.mail-viewer-workspace {
  width:
    100%;
}


.mail-query {
  margin-bottom:
    10px;
}


/* ========================================= */
/* NAIVE UI DARK OVERRIDES */
/* ========================================= */

.mail-viewer-page :deep(.n-card) {
  background:
    #151922;

  color:
    #e8edf5;

  border-color:
    #2b3240;
}


.mail-viewer-page :deep(.n-alert) {
  background:
    #151922;

  color:
    #dce3ef;

  border:
    1px solid #2b3240;
}


.mail-viewer-page :deep(.n-tabs-tab) {
  color:
    #aeb7c8;
}


.mail-viewer-page :deep(.n-tab-pane) {
  color:
    #dce3ef;
}


.mail-viewer-page :deep(.n-list) {
  background:
    #151922;

  color:
    #e8edf5;
}


.mail-viewer-page :deep(.n-list-item) {
  color:
    #e8edf5;

  border-color:
    #2b3240;
}


.mail-viewer-page :deep(.n-thing) {
  color:
    #e8edf5;
}


.mail-viewer-page :deep(.n-thing-header__title) {
  color:
    #e8edf5;
}


/* INPUTS */

.mail-viewer-page :deep(.n-input) {
  --n-color:
    #0d1118;

  --n-color-focus:
    #0d1118;

  --n-border:
    1px solid #303847;

  --n-border-hover:
    1px solid #3d4758;

  --n-border-focus:
    1px solid #35d5be;

  --n-text-color:
    #e8edf5;

  --n-placeholder-color:
    #778195;
}


/* ========================================= */
/* RESPONSIVE */
/* ========================================= */

@media
(max-width: 768px) {

  .mail-viewer-page {
    padding:
      20px
      12px
      40px;
  }


  .mail-viewer-shell {
    max-width:
      100%;
  }


  .mail-viewer-hero {
    padding-bottom:
      18px;
  }


  .mail-viewer-hero h1 {
    font-size:
      25px;
  }


  .mail-viewer-hero p {
    font-size:
      13px;
  }


  .mail-viewer-divider {
    margin-bottom:
      18px;
  }

}

</style>
