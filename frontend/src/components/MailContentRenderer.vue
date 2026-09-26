<script setup>
import { ref, computed, watch } from "vue";
import { useScopedI18n } from '@/i18n/app'
import { CloudDownloadRound, ReplyFilled, ForwardFilled, FullscreenRound, ImageRound } from '@vicons/material'
import ShadowHtmlComponent from "./ShadowHtmlComponent.vue";
import AiExtractInfo from "./AiExtractInfo.vue";
import { getDownloadEmlUrl } from '../utils/email-parser';
import { blockRemoteContent } from '../utils/remote-content-policy';
import { utcToLocalDate } from '../utils';
import { useGlobalState } from '../store';

const { preferShowTextMail, useIframeShowMail, useUTCDate, isDark, autoLoadRemoteImages } = useGlobalState();

const { t } = useScopedI18n('components.MailContentRenderer')

const props = defineProps({
  mail: {
    type: Object,
    required: true
  },
  showEMailTo: {
    type: Boolean,
    default: true
  },
  enableUserDeleteEmail: {
    type: Boolean,
    default: false
  },
  showReply: {
    type: Boolean,
    default: false
  },
  showSaveS3: {
    type: Boolean,
    default: false
  },
  enableMailReadStatus: {
    type: Boolean,
    default: false
  },
  onDelete: {
    type: Function,
    default: () => { }
  },
  onReply: {
    type: Function,
    default: () => { }
  },
  onForward: {
    type: Function,
    default: () => { }
  },
  onSaveToS3: {
    type: Function,
    default: () => { }
  },
  onUpdateMailReadStatus: {
    type: Function,
    default: () => { }
  }
});

const showTextMail = ref(preferShowTextMail.value);
const showAttachments = ref(false);
const curAttachments = ref([]);
const attachmentLoding = ref(false);
const readStatusUpdating = ref(false);
const showFullscreen = ref(false);

const showRemoteImages = ref(false);
watch(() => props.mail.id, () => {
  showRemoteImages.value = false;
});

const processedMail = computed(() => {
  if (autoLoadRemoteImages.value || showRemoteImages.value) {
    return { message: props.mail.message, blocked: 0 };
  }
  const { html, blocked } = blockRemoteContent(props.mail.message);
  return { message: html, blocked };
});

const handleLoadRemoteImages = () => {
  showRemoteImages.value = true;
};

const handleDelete = () => {
  props.onDelete();
};

const handleViewAttachments = () => {
  curAttachments.value = props.mail.attachments;
  showAttachments.value = true;
};

const handleReply = () => {
  props.onReply();
};

const handleForward = () => {
  props.onForward();
};

const handleUpdateMailReadStatus = async () => {
  readStatusUpdating.value = true;
  try {
    await props.onUpdateMailReadStatus();
  } finally {
    readStatusUpdating.value = false;
  }
};

const handleSaveToS3 = async (filename, blob) => {
  attachmentLoding.value = true;
  try {
    await props.onSaveToS3(filename, blob);
  } finally {
    attachmentLoding.value = false;
  }
};
</script>

<template>
  <div class="mail-content-renderer">

    <!-- EMAIL HEADER -->
    <header class="email-header">
      <h1 class="email-subject">
        {{ mail.subject || '(No subject)' }}
      </h1>

      <div class="email-meta">
        <div class="meta-row">
          <span class="meta-label">From:</span>
          <span class="meta-value">{{ mail.source }}</span>
        </div>

        <div v-if="showEMailTo" class="meta-row">
          <span class="meta-label">To:</span>
          <span class="meta-value">{{ mail.address }}</span>
        </div>

        <div class="meta-row">
          <span class="meta-label">Date:</span>
          <span class="meta-value">
            {{ utcToLocalDate(mail.created_at, useUTCDate.value) }}
          </span>
        </div>

        <div class="meta-row meta-id">
          <span class="meta-label">ID:</span>
          <span class="meta-value">{{ mail.id }}</span>
        </div>
      </div>
    </header>

    <!-- ACTION TOOLBAR -->
    <div class="email-toolbar">
      <n-button
        tag="a"
        target="_blank"
        text
        size="small"
        class="toolbar-button"
        :download="mail.id + '.eml'"
        :href="getDownloadEmlUrl(mail.raw)"
      >
        <template #icon>
          <n-icon :component="CloudDownloadRound" />
        </template>
        {{ t('downloadMail') }}
      </n-button>

      <n-button
        v-if="mail.attachments && mail.attachments.length > 0"
        text
        size="small"
        class="toolbar-button"
        @click="handleViewAttachments"
      >
        {{ t('attachments') }}
        <span class="attachment-count">{{ mail.attachments.length }}</span>
      </n-button>

      <n-button
        v-if="enableMailReadStatus"
        text
        size="small"
        class="toolbar-button"
        :loading="readStatusUpdating"
        @click="handleUpdateMailReadStatus"
      >
        {{ mail.is_unread === 1 ? t('markAsRead') : t('markAsUnread') }}
      </n-button>

      <n-button
        v-if="showReply"
        text
        size="small"
        class="toolbar-button"
        @click="handleReply"
      >
        <template #icon>
          <n-icon :component="ReplyFilled" />
        </template>
        {{ t('reply') }}
      </n-button>

      <n-button
        v-if="showReply"
        text
        size="small"
        class="toolbar-button"
        @click="handleForward"
      >
        <template #icon>
          <n-icon :component="ForwardFilled" />
        </template>
        {{ t('forward') }}
      </n-button>

      <n-button
        text
        size="small"
        class="toolbar-button"
        @click="showTextMail = !showTextMail"
      >
        {{ showTextMail ? t('showHtmlMail') : t('showTextMail') }}
      </n-button>

      <n-button
        text
        size="small"
        class="toolbar-button"
        @click="showFullscreen = true"
      >
        <template #icon>
          <n-icon :component="FullscreenRound" />
        </template>
        {{ t('fullscreen') }}
      </n-button>

      <n-popconfirm
        v-if="enableUserDeleteEmail"
        @positive-click="handleDelete"
      >
        <template #trigger>
          <n-button
            text
            size="small"
            class="toolbar-button delete-button"
          >
            {{ t('delete') }}
          </n-button>
        </template>
        {{ t('deleteMailTip') }}
      </n-popconfirm>
    </div>

    <!-- REMOTE IMAGE SECURITY -->
    <n-alert
      v-if="processedMail.blocked"
      type="warning"
      :show-icon="false"
      :bordered="false"
      class="remote-images-banner"
    >
      <n-space align="center" justify="space-between">
        <span>{{ t('remoteImagesBlocked', { count: processedMail.blocked }) }}</span>

        <n-button
          size="tiny"
          tertiary
          type="warning"
          @click="handleLoadRemoteImages"
        >
          <template #icon>
            <n-icon :component="ImageRound" />
          </template>
          {{ t('loadRemoteImages') }}
        </n-button>
      </n-space>
    </n-alert>

    <!-- AI EXTRACTED INFO -->
    <div class="ai-info">
      <AiExtractInfo :metadata="mail.metadata" />
    </div>

    <!-- EMAIL BODY -->
    <div class="mail-content" :class="{ 'dark-mode': isDark }">
      <pre v-if="showTextMail" class="mail-text">{{ mail.text }}</pre>

      <iframe
        v-else-if="useIframeShowMail"
        :srcdoc="processedMail.message"
        class="mail-iframe"
      >
      </iframe>

      <ShadowHtmlComponent
        v-else
        :key="mail.id"
        :htmlContent="processedMail.message"
        :isDark="isDark"
        class="mail-html"
      />
    </div>
  </div>

  <!-- FULLSCREEN -->
  <n-drawer
    v-model:show="showFullscreen"
    width="100%"
    placement="bottom"
    :trap-focus="false"
    :block-scroll="false"
    style="height: 100vh;"
  >
    <n-drawer-content :title="mail.subject" closable>
      <div class="fullscreen-meta">
        <div>
          <span class="fullscreen-label">From:</span>
          {{ mail.source }}
        </div>

        <div v-if="showEMailTo">
          <span class="fullscreen-label">To:</span>
          {{ mail.address }}
        </div>

        <div>
          <span class="fullscreen-label">Date:</span>
          {{ utcToLocalDate(mail.created_at, useUTCDate.value) }}
        </div>
      </div>

      <n-alert
        v-if="processedMail.blocked"
        type="warning"
        :show-icon="false"
        :bordered="false"
        class="remote-images-banner fullscreen-banner"
      >
        <n-space align="center" justify="space-between">
          <span>{{ t('remoteImagesBlocked', { count: processedMail.blocked }) }}</span>

          <n-button
            size="tiny"
            tertiary
            type="warning"
            @click="handleLoadRemoteImages"
          >
            <template #icon>
              <n-icon :component="ImageRound" />
            </template>
            {{ t('loadRemoteImages') }}
          </n-button>
        </n-space>
      </n-alert>

      <div class="fullscreen-mail-content" :class="{ 'dark-mode': isDark }">
        <pre v-if="showTextMail" class="mail-text">{{ mail.text }}</pre>

        <iframe
          v-else-if="useIframeShowMail"
          :srcdoc="processedMail.message"
          class="mail-iframe"
        >
        </iframe>

        <ShadowHtmlComponent
          v-else
          :key="mail.id"
          :htmlContent="processedMail.message"
          :isDark="isDark"
          class="mail-html"
        />
      </div>
    </n-drawer-content>
  </n-drawer>

  <!-- ATTACHMENTS -->
  <n-modal
    v-model:show="showAttachments"
    preset="dialog"
    :title="t('attachments')"
  >
    <n-spin v-model:show="attachmentLoding">
      <n-list hoverable clickable>
        <n-list-item
          v-for="row in curAttachments"
          :key="row.id"
        >
          <n-thing class="center" :title="row.filename">
            <template #description>
              <n-space>
                <n-tag type="info">
                  Size: {{ row.size }}
                </n-tag>

                <n-button
                  v-if="showSaveS3"
                  @click="handleSaveToS3(row.filename, row.blob)"
                  ghost
                  type="info"
                  size="small"
                >
                  {{ t('saveToS3') }}
                </n-button>
              </n-space>
            </template>
          </n-thing>

          <template #suffix>
            <n-button
              tag="a"
              target="_blank"
              tertiary
              type="info"
              size="small"
              :download="row.filename"
              :href="row.url"
            >
              <n-icon :component="CloudDownloadRound" />
            </n-button>
          </template>
        </n-list-item>
      </n-list>
    </n-spin>
  </n-modal>
</template>

<style scoped>
.mail-content-renderer {
  width: 100%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  color: #dce3ec;
}

/* =========================================================
   HEADER
   ========================================================= */

.email-header {
  padding: 2px 2px 16px;
  border-bottom: 1px solid #29313d;
}

.email-subject {
  margin: 0 0 13px;
  color: #f4f7fa;
  font-size: 20px;
  font-weight: 650;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.email-meta {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.meta-row {
  min-width: 0;
  display: flex;
  align-items: flex-start;
  gap: 7px;
  color: #9aa6b7;
  font-size: 12px;
  line-height: 1.45;
}

.meta-label {
  flex: 0 0 auto;
  color: #6f7b8d;
}

.meta-value {
  min-width: 0;
  color: #aeb8c6;
  overflow-wrap: anywhere;
}

.meta-id {
  opacity: 0.72;
}

/* =========================================================
   TOOLBAR
   ========================================================= */

.email-toolbar {
  min-height: 45px;
  padding: 7px 0;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 3px 15px;
  box-sizing: border-box;
  border-bottom: 1px solid #29313d;
}

.toolbar-button {
  color: #58dcca !important;
  font-size: 12px;
}

.toolbar-button:hover {
  color: #83eadb !important;
}

.delete-button {
  color: #ff6879 !important;
}

.delete-button:hover {
  color: #ff8995 !important;
}

.attachment-count {
  min-width: 17px;
  height: 17px;
  margin-left: 4px;
  padding: 0 5px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  color: #a7b1c0;
  background: #222a35;
  border-radius: 999px;
  font-size: 10px;
}

/* =========================================================
   REMOTE IMAGE WARNING
   ========================================================= */

.remote-images-banner {
  margin-top: 12px;
  border-radius: 6px;
}

.remote-images-banner :deep(.n-space) {
  width: 100%;
}

/* =========================================================
   AI INFO
   ========================================================= */

.ai-info {
  margin-top: 10px;
}

/* =========================================================
   BODY
   ========================================================= */

.mail-content {
  min-width: 0;
  min-height: 260px;
  padding: 20px 2px 10px;
  flex: 1 1 auto;
  box-sizing: border-box;
}

.mail-text {
  margin: 0;
  padding: 0;
  color: #dce3ec;
  font-family: inherit;
  font-size: 14px;
  line-height: 1.65;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  word-wrap: break-word;
}

.dark-mode .mail-text {
  color: #dce3ec;
}

.mail-iframe {
  width: 100%;
  min-height: 400px;
  height: 100%;
  background: #ffffff;
  border: 0;
  border-radius: 6px;
}

.dark-mode .mail-iframe {
  background-color: #ffffff;
}

.mail-html {
  width: 100%;
  min-height: 300px;
  height: 100%;
}

/* =========================================================
   FULLSCREEN
   ========================================================= */

.fullscreen-meta {
  margin-bottom: 14px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 5px;
  color: #9ba6b6;
  background: rgba(128, 128, 128, 0.08);
  border-radius: 7px;
  font-size: 12px;
  line-height: 1.45;
}

.fullscreen-label {
  margin-right: 6px;
  opacity: 0.65;
}

.fullscreen-banner {
  margin-bottom: 12px;
}

.fullscreen-mail-content {
  height: calc(100vh - 190px);
  overflow: auto;
}

.fullscreen-mail-content .mail-iframe {
  min-height: calc(100vh - 210px);
}

/* =========================================================
   ATTACHMENTS
   ========================================================= */

.center {
  text-align: center;
}

/* =========================================================
   RESPONSIVE
   ========================================================= */

@media (max-width: 768px) {
  .email-header {
    padding-bottom: 13px;
  }

  .email-subject {
    margin-bottom: 11px;
    font-size: 18px;
  }

  .email-toolbar {
    gap: 5px 12px;
  }

  .mail-content {
    padding-top: 16px;
  }
}
</style>
