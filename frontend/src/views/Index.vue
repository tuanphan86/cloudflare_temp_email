<script setup>
import { defineAsyncComponent, onMounted, watch } from 'vue'
import { useScopedI18n } from '@/i18n/app'
import { useRoute } from 'vue-router'

import { useGlobalState } from '../store'
import { api } from '../api'
import { useIsMobile } from '../utils/composables'
import { FullscreenExitOutlined } from '@vicons/material'

import AddressBar from './index/AddressBar.vue';
import MailBox from '../components/MailBox.vue';
import SendBox from '../components/SendBox.vue';
import AutoReply from './index/AutoReply.vue';
import AccountSettings from './index/AccountSettings.vue';
import Appearance from './common/Appearance.vue';
import Webhook from './index/Webhook.vue';
import Attachment from './index/Attachment.vue';
import About from './common/About.vue';
import SimpleIndex from './index/SimpleIndex.vue';

const { loading, settings, openSettings, indexTab, globalTabplacement, useSimpleIndex } = useGlobalState()
const message = useMessage()
const route = useRoute()
const isMobile = useIsMobile()

const SendMail = defineAsyncComponent(() => {
  loading.value = true;
  return import('./index/SendMail.vue')
    .finally(() => loading.value = false);
});

const { t } = useScopedI18n('views.Index')

const fetchMailData = async (limit, offset) => {
  if (mailIdQuery.value > 0) {
    const singleMail = await api.fetch(`/api/mail/${mailIdQuery.value}`);
    if (singleMail) return { results: [singleMail], count: 1 };
    return { results: [], count: 0 };
  }
  return await api.fetch(`/api/mails?limit=${limit}&offset=${offset}`);
};

const deleteMail = async (curMailId) => {
  await api.fetch(`/api/mails/${curMailId}`, { method: 'DELETE' });
};

const updateMailReadStatus = async (id, isUnread) => {
  await api.fetch(`/api/mails/${id}/read`, {
    method: 'PATCH',
    body: JSON.stringify({ isUnread }),
    showLoading: false
  })
}

const deleteSenboxMail = async (curMailId) => {
  await api.fetch(`/api/sendbox/${curMailId}`, { method: 'DELETE' });
};

const fetchSenboxData = async (limit, offset) => {
  return await api.fetch(`/api/sendbox?limit=${limit}&offset=${offset}`);
};

const saveToS3 = async (mail_id, filename, blob) => {
  try {
    const { url } = await api.fetch(`/api/attachment/put_url`, {
      method: 'POST',
      body: JSON.stringify({ key: `${mail_id}/${filename}` })
    });
    // upload to s3 by formdata
    const formData = new FormData();
    formData.append(filename, blob);
    await fetch(url, {
      method: 'PUT',
      body: formData
    });
    message.success(t('saveToS3Success'));
  } catch (error) {
    console.error(error);
    message.error(error.message || "save to s3 error");
  }
}

const mailBoxKey = ref("")
const mailIdQuery = ref("")
const showMailIdQuery = ref(false)

const queryMail = () => {
  mailBoxKey.value = Date.now();
}

watch(route, () => {
  if (!route.query.mail_id) {
    showMailIdQuery.value = false;
    mailIdQuery.value = "";
    queryMail();
  }
})

onMounted(() => {
  if (route.query.mail_id) {
    showMailIdQuery.value = true;
    mailIdQuery.value = route.query.mail_id;
    queryMail();
  }
})
</script>

<template>
  <div class="mail-viewer-page">
    <div class="mail-viewer-shell">

      <!-- HERO -->
      <header class="mail-viewer-hero">
        <h1>Mail Viewer</h1>
        <p>Enter email and click Load to view inbox</p>
      </header>

      <div class="mail-viewer-divider"></div>

      <!-- CURRENT ADDRESS / LOGIN -->
      <section class="mail-viewer-address">
        <AddressBar />
      </section>

      <!-- MAILBOX -->
      <section
        v-if="settings.address"
        class="mail-viewer-workspace"
      >
        <n-tabs
          v-model:value="indexTab"
          type="line"
          animated
          class="mail-viewer-tabs"
        >
          <n-tab-pane
            name="inbox"
            :tab="t('inbox')"
            display-directive="show"
          >
            <MailBox
              :fetchMailData="fetchMailData"
              :deleteMail="deleteMail"
              :enableUserDeleteEmail="openSettings.enableUserDeleteEmail"
              :showReply="openSettings.enableSendMail"
              :showSaveS3="openSettings.enableSaveToS3"
              :saveToS3="saveToS3"
              :showFilterInput="true"
              :enableMailReadStatus="openSettings.enableMailReadStatus"
              :updateMailReadStatus="updateMailReadStatus"
            />
          </n-tab-pane>

          <n-tab-pane
            v-if="openSettings.enableSendMail"
            name="sendbox"
            :tab="t('sendBox')"
            display-directive="show"
          >
            <SendBox
              :fetchMailData="fetchSendMailData"
            />
          </n-tab-pane>

          <n-tab-pane
            v-if="openSettings.enableSendMail"
            name="sendmail"
            :tab="t('sendMail')"
            display-directive="show"
          >
            <SendMail />
          </n-tab-pane>

          <n-tab-pane
            name="settings"
            :tab="t('mailboxSettings')"
            display-directive="show"
          >
            <AccountSettings />
          </n-tab-pane>

          <n-tab-pane
            name="appearance"
            :tab="t('appearance')"
            display-directive="show"
          >
            <Appearance />
          </n-tab-pane>

          <n-tab-pane
            v-if="openSettings.enableAutoReply"
            name="autoReply"
            :tab="t('autoReply')"
            display-directive="show"
          >
            <AutoReply />
          </n-tab-pane>

          <n-tab-pane
            v-if="openSettings.enableWebhook"
            name="webhook"
            :tab="t('webhook')"
            display-directive="show"
          >
            <Webhook />
          </n-tab-pane>

          <n-tab-pane
            v-if="openSettings.enableSaveToS3"
            name="attachment"
            :tab="t('attachment')"
            display-directive="show"
          >
            <Attachment />
          </n-tab-pane>

          <n-tab-pane
            name="about"
            :tab="t('about')"
            display-directive="show"
          >
            <About />
          </n-tab-pane>
        </n-tabs>
      </section>

    </div>
  </div>
</template>

<style scoped>
.mail-viewer-page {
  min-height: 100vh;
  width: 100%;
  background: #0c0f14;
  color: #e8edf5;
  padding: 28px 24px 60px;
  box-sizing: border-box;
}

.mail-viewer-shell {
  width: 100%;
  max-width: 1060px;
  margin: 0 auto;
}

/* HERO */

.mail-viewer-hero {
  text-align: center;
  padding: 0 20px 22px;
}

.mail-viewer-hero h1 {
  margin: 0;
  color: #75e6d2;
  font-size: 29px;
  line-height: 1.25;
  font-weight: 700;
  letter-spacing: -0.5px;
}

.mail-viewer-hero p {
  margin: 10px 0 0;
  color: #aab3c5;
  font-size: 14px;
  line-height: 1.6;
}

.mail-viewer-divider {
  width: 100%;
  height: 1px;
  background: #2a303c;
  margin-bottom: 24px;
}

/* ADDRESS AREA */

.mail-viewer-address {
  width: 100%;
  margin-bottom: 20px;
}

/* WORKSPACE */

.mail-viewer-workspace {
  width: 100%;
}

.mail-viewer-tabs {
  color: #dce3ef;
}

/* Force dark appearance inside homepage */

.mail-viewer-page :deep(.n-card) {
  background: #151922;
  color: #e8edf5;
  border-color: #2b3240;
}

.mail-viewer-page :deep(.n-alert) {
  background: #151922;
  border: 1px solid #2b3240;
  color: #dce3ef;
}

.mail-viewer-page :deep(.n-tabs-nav) {
  color: #aeb7c8;
}

.mail-viewer-page :deep(.n-tab-pane) {
  color: #dce3ef;
}

.mail-viewer-page :deep(.n-list) {
  background: #151922;
  color: #e8edf5;
}

.mail-viewer-page :deep(.n-list-item) {
  color: #e8edf5;
  border-color: #2b3240;
}

.mail-viewer-page :deep(.n-thing) {
  color: #e8edf5;
}

.mail-viewer-page :deep(.n-thing-header__title) {
  color: #e8edf5;
}

@media (max-width: 768px) {
  .mail-viewer-page {
    padding: 20px 12px 40px;
  }

  .mail-viewer-shell {
    max-width: 100%;
  }

  .mail-viewer-hero {
    padding-bottom: 18px;
  }

  .mail-viewer-hero h1 {
    font-size: 25px;
  }

  .mail-viewer-hero p {
    font-size: 13px;
  }

  .mail-viewer-divider {
    margin-bottom: 18px;
  }
}
</style>
