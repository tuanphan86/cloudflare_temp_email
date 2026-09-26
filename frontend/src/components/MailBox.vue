<script setup>
import { watch, onMounted, ref, onBeforeUnmount, computed } from "vue";
import { useMessage } from 'naive-ui'
import { useScopedI18n } from '@/i18n/app'
import { useGlobalState } from '../store'
import { CloudDownloadRound, ArrowBackIosNewFilled, ArrowForwardIosFilled, InboxRound } from '@vicons/material'
import { useIsMobile } from '../utils/composables'
import { processItem } from '../utils/email-parser'
import { utcToLocalDate } from '../utils';
import { buildReplyModel, buildForwardModel } from '../utils/mail-actions'
import MailContentRenderer from "./MailContentRenderer.vue";
import AiExtractInfo from "./AiExtractInfo.vue";

const message = useMessage()
const isMobile = useIsMobile()

const props = defineProps({
  enableUserDeleteEmail: {
    type: Boolean,
    default: false,
    required: false
  },
  showEMailTo: {
    type: Boolean,
    default: true,
    required: false
  },
  fetchMailData: {
    type: Function,
    default: () => { },
    required: true
  },
  deleteMail: {
    type: Function,
    default: () => { },
    required: false
  },
  showReply: {
    type: Boolean,
    default: false,
    required: false
  },
  showSaveS3: {
    type: Boolean,
    default: false,
    required: false
  },
  saveToS3: {
    type: Function,
    default: (mail_id, filename, blob) => { },
    required: false
  },
  showFilterInput: {
    type: Boolean,
    default: false,
    required: false
  },
  enableMailReadStatus: {
    type: Boolean,
    default: false
  },
  updateMailReadStatus: {
    type: Function,
    default: () => { }
  },
})

const localFilterKeyword = ref('')

const {
  isDark, mailboxSplitSize, mailListView, mailListPreviewLineClamp, indexTab, loading, useUTCDate,
  autoRefresh, configAutoRefreshInterval, sendMailModel
} = useGlobalState()
const autoRefreshInterval = ref(configAutoRefreshInterval.value)
const rawData = ref([])
const timer = ref(null)

const count = ref(0)
const page = ref(1)
const pageSize = ref(20)

const mailListPreviewLineClampValue = computed(() => {
  const value = Number(mailListPreviewLineClamp.value)
  if (!Number.isFinite(value)) return 0
  return Math.min(5, Math.max(0, Math.round(value)))
})

// Computed property for filtered data (only filter current page)
const data = computed(() => {
  if (!localFilterKeyword.value || localFilterKeyword.value.trim() === '') {
    return rawData.value;
  }
  const keyword = localFilterKeyword.value.toLowerCase();
  return rawData.value.filter(mail => {
    // Search in subject, text, message fields
    const searchFields = [
      mail.subject || '',
      mail.text || '',
      mail.message || ''
    ].map(field => field.toLowerCase());
    return searchFields.some(field => field.includes(keyword));
  });
})

const openMail = (mail) => {
  curMail.value = mail
  if (mail?.is_unread !== 1 || !props.enableMailReadStatus) return
  mail.is_unread = 0
  void props.updateMailReadStatus(mail.id, false).catch(() => {
    mail.is_unread = 1
  })
}

const toggleCurrentMailUnread = async () => {
  if (!curMail.value || !props.enableMailReadStatus) return
  const mail = curMail.value
  const previousValue = mail.is_unread
  const isUnread = previousValue !== 1
  mail.is_unread = isUnread ? 1 : 0
  try {
    await props.updateMailReadStatus(mail.id, isUnread)
    message.success(t("success"))
  } catch {
    mail.is_unread = previousValue
  }
}

const canGoPrevMail = computed(() => {
  if (!curMail.value) return false
  const currentIndex = data.value.findIndex(mail => mail.id === curMail.value.id)
  return currentIndex > 0 || page.value > 1
})

const canGoNextMail = computed(() => {
  if (!curMail.value) return false
  const currentIndex = data.value.findIndex(mail => mail.id === curMail.value.id)
  return currentIndex < data.value.length - 1 || count.value > page.value * pageSize.value
})

const prevMail = async () => {
  if (!canGoPrevMail.value) return
  const currentIndex = data.value.findIndex(mail => mail.id === curMail.value.id)

  if (currentIndex > 0) {
    openMail(data.value[currentIndex - 1])
  } else if (page.value > 1) {
    page.value--
    await refresh()
    if (data.value.length > 0) {
      openMail(data.value[data.value.length - 1])
    }
  }
}

const nextMail = async () => {
  if (!canGoNextMail.value) return
  const currentIndex = data.value.findIndex(mail => mail.id === curMail.value.id)

  if (currentIndex < data.value.length - 1) {
    openMail(data.value[currentIndex + 1])
  } else if (count.value > page.value * pageSize.value) {
    page.value++
    await refresh()
    if (data.value.length > 0) {
      openMail(data.value[0])
    }
  }
}

const curMail = ref(null);

const multiActionMode = ref(false)
const showMultiActionDownload = ref(false)
const showMultiActionDelete = ref(false)
const multiActionDownloadZip = ref({})
const multiActionDeleteProgress = ref({ percentage: 0, tip: '0/0' })

const { t } = useScopedI18n('components.MailBox')

const setupAutoRefresh = async (autoRefresh) => {
  // auto refresh every configAutoRefreshInterval seconds
  autoRefreshInterval.value = configAutoRefreshInterval.value;
  if (autoRefresh) {
    clearInterval(timer.value);
    timer.value = setInterval(async () => {
      if (loading.value) return;
      autoRefreshInterval.value--;
      if (autoRefreshInterval.value <= 0) {
        autoRefreshInterval.value = configAutoRefreshInterval.value;
        await backFirstPageAndRefresh();
      }
    }, 1000)
  } else {
    clearInterval(timer.value)
    timer.value = null
  }
}

watch(autoRefresh, async (autoRefresh, old) => {
  setupAutoRefresh(autoRefresh)
}, { immediate: true })

watch([page, pageSize], async ([page, pageSize], [oldPage, oldPageSize]) => {
  if (page !== oldPage || pageSize !== oldPageSize) {
    await refresh();
  }
})

const refresh = async () => {
  try {
    const { results, count: totalCount } = await props.fetchMailData(
      pageSize.value, (page.value - 1) * pageSize.value
    );
    loading.value = true;
    rawData.value = await Promise.all(results.map(async (item) => {
      item.checked = false;
      return await processItem(item);
    }));
    if (totalCount > 0) {
      count.value = totalCount;
    }
    curMail.value = null;
    if (!isMobile.value && !mailListView.value && data.value.length > 0) {
      curMail.value = data.value[0];
    }
  } catch (error) {
    message.error(error.message || "error");
    console.error(error);
  } finally {
    loading.value = false;
  }
};

const backFirstPageAndRefresh = async () => {
  page.value = 1;
  await refresh();
}

const clickRow = (row) => {
  if (multiActionMode.value) {
    row.checked = !row.checked;
    curMail.value = row;
    return;
  }
  if (mailListView.value && curMail.value?.id === row.id) {
    curMail.value = null;
    return;
  }
  openMail(row);
};


const mailItemClass = (row) => {
  return curMail.value && row.id == curMail.value.id ? (isDark.value ? 'overlay overlay-dark-backgroud' : 'overlay overlay-light-backgroud') : '';
};

const deleteMail = async () => {
  try {
    await props.deleteMail(curMail.value.id);
    message.success(t("success"));
    curMail.value = null;
    await refresh();
  } catch (error) {
    message.error(error.message || "error");
  }
};

const replyMail = async () => {
  Object.assign(sendMailModel.value, buildReplyModel(curMail.value, t('reply')));
  indexTab.value = 'sendmail';
};

const forwardMail = async () => {
  Object.assign(sendMailModel.value, buildForwardModel(curMail.value, t('forwardMail')));
  indexTab.value = 'sendmail';
};

const onSpiltSizeChange = (size) => {
  mailboxSplitSize.value = size;
}

const saveToS3Proxy = async (filename, blob) => {
  await props.saveToS3(curMail.value.id, filename, blob);
}

const multiActionModeClick = (enableMulti) => {
  if (enableMulti) {
    data.value.forEach((item) => {
      item.checked = false;
    });
    multiActionMode.value = true;
  } else {
    multiActionMode.value = false;
    data.value.forEach((item) => {
      item.checked = false;
    });
  }
}

const multiActionSelectAll = (checked) => {
  data.value.forEach((item) => {
    item.checked = checked;
  });
}

const multiActionDeleteMail = async () => {
  try {
    loading.value = true;
    const selectedMails = data.value.filter((item) => item.checked);
    if (selectedMails.length === 0) {
      message.error(t('pleaseSelectMail'));
      return;
    }
    multiActionDeleteProgress.value = {
      percentage: 0,
      tip: `0/${selectedMails.length}`
    };
    for (const [index, mail] of selectedMails.entries()) {
      await props.deleteMail(mail.id);
      showMultiActionDelete.value = true;
      multiActionDeleteProgress.value = {
        percentage: Math.floor((index + 1) / selectedMails.length * 100),
        tip: `${index + 1}/${selectedMails.length}`
      };
    }
    message.success(t("success"));
    await refresh();
  } catch (error) {
    message.error(error.message || "error");
  } finally {
    loading.value = false;
    showMultiActionDelete.value = true;
  }
}

const multiActionDownload = async () => {
  try {
    loading.value = true;
    const selectedMails = data.value.filter((item) => item.checked);
    if (selectedMails.length === 0) {
      message.error(t('pleaseSelectMail'));
      return;
    }
    const JSZipModlue = await import('jszip');
    const JSZip = JSZipModlue.default;
    const zip = new JSZip();
    for (const mail of selectedMails) {
      zip.file(`${mail.id}.eml`, mail.raw);
    }
    multiActionDownloadZip.value = {
      url: URL.createObjectURL(await zip.generateAsync({ type: "blob" })),
      filename: `mails-${new Date().toISOString().replace(/:/g, '-')}.zip`
    }
    showMultiActionDownload.value = true;
  } catch (error) {
    message.error(error.message || "error");
  } finally {
    loading.value = false;
  }
}


const deleteAllVisibleMails = async () => {
  if (data.value.length === 0) return
  multiActionSelectAll(true)
  await multiActionDeleteMail()
  multiActionMode.value = false
}

onMounted(async () => {
  await refresh();
});

onBeforeUnmount(() => {
  clearInterval(timer.value)
})
</script>

<template>
  <div class="mailbox-v1">

    <!-- DESKTOP -->
    <div v-if="!isMobile" class="mailbox-grid">

      <!-- LEFT: MAILBOX LIST -->
      <section class="mail-panel mailbox-list-panel">
        <header class="panel-header">
          <div class="panel-title-wrap">
            <h2 class="panel-title">MailBox</h2>
            <span v-if="count > 0" class="mail-count">{{ count }}</span>
          </div>

          <div class="panel-header-actions">
            <n-button
              size="small"
              text
              class="refresh-btn"
              @click="backFirstPageAndRefresh"
            >
              {{ t('refresh') }}
            </n-button>

            <n-popconfirm
              v-if="data.length > 0"
              @positive-click="deleteAllVisibleMails"
            >
              <template #trigger>
                <n-button size="small" class="delete-all-btn">
                  Xóa tất cả
                </n-button>
              </template>
              Xóa tất cả email đang hiển thị trên trang này?
            </n-popconfirm>
          </div>
        </header>

        <!-- Optional local filter: only appears when parent enables it -->
        <div v-if="showFilterInput" class="mail-filter">
          <n-input
            v-model:value="localFilterKeyword"
            :placeholder="t('keywordQueryTip')"
            size="small"
            clearable
          />
        </div>

        <!-- Multi-action mode retained, but visually secondary -->
        <div v-if="multiActionMode" class="multi-action-bar">
          <n-button size="small" @click="multiActionModeClick(false)" tertiary>
            {{ t('cancelMultiAction') }}
          </n-button>
          <n-button size="small" @click="multiActionSelectAll(true)" tertiary>
            {{ t('selectAll') }}
          </n-button>
          <n-button size="small" @click="multiActionSelectAll(false)" tertiary>
            {{ t('unselectAll') }}
          </n-button>

          <n-popconfirm
            v-if="enableUserDeleteEmail"
            @positive-click="multiActionDeleteMail"
          >
            <template #trigger>
              <n-button size="small" tertiary type="error">
                {{ t('delete') }}
              </n-button>
            </template>
            {{ t('deleteMailTip') }}
          </n-popconfirm>

          <n-button size="small" @click="multiActionDownload" tertiary type="info">
            <template #icon>
              <n-icon :component="CloudDownloadRound" />
            </template>
            {{ t('downloadMail') }}
          </n-button>
        </div>

        <!-- Empty inbox -->
        <div v-if="data.length === 0" class="mail-list-empty">
          <n-icon :component="InboxRound" :size="42" />
          <span>{{ t('emptyInbox') }}</span>
        </div>

        <!-- Mail list -->
        <div v-else class="mail-list">
          <button
            v-for="row in data"
            :key="row.id"
            type="button"
            class="mail-row"
            :class="{
              active: curMail && row.id === curMail.id,
              unread: enableMailReadStatus && row.is_unread === 1
            }"
            @click="clickRow(row)"
          >
            <div v-if="multiActionMode" class="mail-check" @click.stop>
              <n-checkbox v-model:checked="row.checked" />
            </div>

            <div class="mail-row-main">
              <div class="mail-subject">
                <span
                  v-if="enableMailReadStatus && row.is_unread === 1"
                  class="unread-dot"
                />
                <span class="mail-subject-text">{{ row.subject || '(No subject)' }}</span>
              </div>

              <div class="mail-sender">
                {{ showEMailTo ? 'FROM: ' + row.source : row.source }}
              </div>

              <div class="mail-meta">
                <span>{{ utcToLocalDate(row.created_at, useUTCDate) }}</span>
                <span class="mail-id">ID: {{ row.id }}</span>
              </div>

              <AiExtractInfo :metadata="row.metadata" compact />
            </div>
          </button>
        </div>

        <!-- Pagination stays functional, but compact -->
        <footer v-if="count > pageSize" class="mail-pagination">
          <n-pagination
            v-model:page="page"
            v-model:page-size="pageSize"
            :item-count="count"
            :page-sizes="[20, 50, 100]"
            simple
            size="small"
          />
        </footer>
      </section>

      <!-- RIGHT: EMAIL CONTENT -->
      <section class="mail-panel mail-content-panel">
        <template v-if="curMail">
          <header class="content-nav">
            <n-button
              @click="prevMail"
              :disabled="!canGoPrevMail"
              text
              size="small"
              class="nav-btn"
            >
              <template #icon>
                <n-icon :component="ArrowBackIosNewFilled" />
              </template>
              {{ t('prevMail') }}
            </n-button>

            <n-button
              @click="nextMail"
              :disabled="!canGoNextMail"
              text
              size="small"
              icon-placement="right"
              class="nav-btn"
            >
              <template #icon>
                <n-icon :component="ArrowForwardIosFilled" />
              </template>
              {{ t('nextMail') }}
            </n-button>
          </header>

          <div class="mail-content-scroll">
            <MailContentRenderer
              :mail="curMail"
              :showEMailTo="showEMailTo"
              :enableUserDeleteEmail="enableUserDeleteEmail"
              :showReply="showReply"
              :showSaveS3="showSaveS3"
              :enableMailReadStatus="enableMailReadStatus"
              :onUpdateMailReadStatus="toggleCurrentMailUnread"
              :onDelete="deleteMail"
              :onReply="replyMail"
              :onForward="forwardMail"
              :onSaveToS3="saveToS3Proxy"
            />
          </div>
        </template>

        <div v-else class="content-empty">
          <n-icon :component="InboxRound" :size="46" />
          <span>Email content will appear here.</span>
        </div>
      </section>
    </div>

    <!-- MOBILE -->
    <div v-else class="mobile-mailbox">
      <section class="mail-panel mailbox-list-panel">
        <header class="panel-header">
          <div class="panel-title-wrap">
            <h2 class="panel-title">MailBox</h2>
            <span v-if="count > 0" class="mail-count">{{ count }}</span>
          </div>

          <div class="panel-header-actions">
            <n-button
              size="small"
              text
              class="refresh-btn"
              @click="backFirstPageAndRefresh"
            >
              {{ t('refresh') }}
            </n-button>

            <n-popconfirm
              v-if="data.length > 0"
              @positive-click="deleteAllVisibleMails"
            >
              <template #trigger>
                <n-button size="small" class="delete-all-btn">
                  Xóa tất cả
                </n-button>
              </template>
              Xóa tất cả email đang hiển thị trên trang này?
            </n-popconfirm>
          </div>
        </header>

        <div v-if="showFilterInput" class="mail-filter">
          <n-input
            v-model:value="localFilterKeyword"
            :placeholder="t('keywordQueryTip')"
            size="small"
            clearable
          />
        </div>

        <div v-if="data.length === 0" class="mail-list-empty">
          <n-icon :component="InboxRound" :size="42" />
          <span>{{ t('emptyInbox') }}</span>
        </div>

        <div v-else class="mail-list">
          <button
            v-for="row in data"
            :key="row.id"
            type="button"
            class="mail-row"
            :class="{ unread: enableMailReadStatus && row.is_unread === 1 }"
            @click="clickRow(row)"
          >
            <div class="mail-row-main">
              <div class="mail-subject">
                <span
                  v-if="enableMailReadStatus && row.is_unread === 1"
                  class="unread-dot"
                />
                <span class="mail-subject-text">{{ row.subject || '(No subject)' }}</span>
              </div>

              <div class="mail-sender">
                {{ showEMailTo ? 'FROM: ' + row.source : row.source }}
              </div>

              <div class="mail-meta">
                <span>{{ utcToLocalDate(row.created_at, useUTCDate) }}</span>
                <span class="mail-id">ID: {{ row.id }}</span>
              </div>

              <AiExtractInfo :metadata="row.metadata" compact />
            </div>
          </button>
        </div>

        <footer v-if="count > pageSize" class="mail-pagination">
          <n-pagination
            v-model:page="page"
            v-model:page-size="pageSize"
            :item-count="count"
            simple
            size="small"
          />
        </footer>
      </section>

      <n-drawer
        v-model:show="curMail"
        width="100%"
        placement="bottom"
        :trap-focus="false"
        :block-scroll="false"
        style="height: 85vh;"
      >
        <n-drawer-content :title="curMail ? curMail.subject : ''" closable>
          <div class="mobile-content">
            <div v-if="curMail" class="mobile-content-nav">
              <n-button
                @click="prevMail"
                :disabled="!canGoPrevMail"
                text
                size="small"
              >
                <template #icon>
                  <n-icon :component="ArrowBackIosNewFilled" />
                </template>
                {{ t('prevMail') }}
              </n-button>

              <n-button
                @click="nextMail"
                :disabled="!canGoNextMail"
                text
                size="small"
                icon-placement="right"
              >
                <template #icon>
                  <n-icon :component="ArrowForwardIosFilled" />
                </template>
                {{ t('nextMail') }}
              </n-button>
            </div>

            <MailContentRenderer
              v-if="curMail"
              :mail="curMail"
              :showEMailTo="showEMailTo"
              :enableUserDeleteEmail="enableUserDeleteEmail"
              :showReply="showReply"
              :showSaveS3="showSaveS3"
              :enableMailReadStatus="enableMailReadStatus"
              :onUpdateMailReadStatus="toggleCurrentMailUnread"
              :useUTCDate="useUTCDate"
              :onDelete="deleteMail"
              :onReply="replyMail"
              :onForward="forwardMail"
              :onSaveToS3="saveToS3Proxy"
            />
          </div>
        </n-drawer-content>
      </n-drawer>
    </div>

    <!-- Existing download modal retained -->
    <n-modal
      v-model:show="showMultiActionDownload"
      preset="dialog"
      :title="t('downloadMail')"
    >
      <n-tag type="info">
        {{ multiActionDownloadZip.filename }}
      </n-tag>

      <n-button
        tag="a"
        target="_blank"
        tertiary
        type="info"
        size="small"
        :download="multiActionDownloadZip.filename"
        :href="multiActionDownloadZip.url"
      >
        <n-icon :component="CloudDownloadRound" />
        {{ t('downloadMail') + ' zip' }}
      </n-button>
    </n-modal>

    <!-- Existing delete progress modal retained -->
    <n-modal
      v-model:show="showMultiActionDelete"
      preset="dialog"
      :title="t('delete') + t('success')"
      negative-text="OK"
    >
      <n-space justify="center">
        <n-progress
          type="circle"
          status="error"
          :percentage="multiActionDeleteProgress.percentage"
        >
          <span style="text-align: center">
            {{ multiActionDeleteProgress.tip }}
          </span>
        </n-progress>
      </n-space>
    </n-modal>
  </div>
</template>

<style scoped>
.mailbox-v1 {
  width: 100%;
  text-align: left;
}

.mailbox-grid {
  display: grid;
  grid-template-columns: minmax(285px, 0.82fr) minmax(0, 1.78fr);
  gap: 18px;
  width: 100%;
  align-items: stretch;
}

.mail-panel {
  min-width: 0;
  min-height: 430px;
  overflow: hidden;
  background: #151a23;
  border: 1px solid #2b3340;
  border-radius: 10px;
  box-sizing: border-box;
}

.mailbox-list-panel {
  position: relative;
}

.panel-header {
  min-height: 58px;
  padding: 13px 15px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border-bottom: 1px solid #282f3b;
  box-sizing: border-box;
}

.panel-title-wrap {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.panel-title {
  margin: 0;
  color: #f1f4f8;
  font-size: 16px;
  line-height: 1.2;
  font-weight: 650;
}

.mail-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  color: #8d98aa;
  background: #202733;
  border: 1px solid #303947;
  border-radius: 999px;
  box-sizing: border-box;
  font-size: 11px;
}

.panel-header-actions {
  display: flex;
  align-items: center;
  gap: 9px;
}

.refresh-btn {
  color: #62ddca !important;
  font-size: 12px;
}

.delete-all-btn {
  min-height: 30px;
  padding: 0 10px !important;
  color: #ff6677 !important;
  background: transparent !important;
  border: 1px solid #d94c5e !important;
  border-radius: 6px !important;
  font-size: 12px;
}

.delete-all-btn:hover {
  color: #ff8794 !important;
  border-color: #ff6677 !important;
}

.mail-filter {
  padding: 10px 12px;
  border-bottom: 1px solid #252c37;
}

.multi-action-bar {
  padding: 10px 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  border-bottom: 1px solid #252c37;
}

.mail-list {
  max-height: 560px;
  overflow-x: hidden;
  overflow-y: auto;
}

.mail-row {
  width: 100%;
  min-width: 0;
  padding: 14px 15px;
  display: flex;
  gap: 10px;
  box-sizing: border-box;
  color: #dbe2ec;
  background: transparent;
  border: 0;
  border-bottom: 1px solid #242b35;
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.15s ease, box-shadow 0.15s ease;
}

.mail-row:hover {
  background: #1a202a;
}

.mail-row.active {
  background: #202733;
  box-shadow: inset 3px 0 0 #42d9c4;
}

.mail-check {
  flex: 0 0 auto;
  padding-top: 1px;
}

.mail-row-main {
  min-width: 0;
  flex: 1 1 auto;
}

.mail-subject {
  min-width: 0;
  display: flex;
  align-items: center;
  color: #edf2f7;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.4;
}

.mail-row.unread .mail-subject {
  color: #ffffff;
  font-weight: 700;
}

.mail-subject-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.unread-dot {
  width: 7px;
  height: 7px;
  margin-right: 8px;
  flex: 0 0 auto;
  background: #42d9c4;
  border-radius: 50%;
}

.mail-sender {
  margin-top: 6px;
  overflow: hidden;
  color: #9ba6b8;
  font-size: 12px;
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mail-meta {
  margin-top: 5px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  color: #697588;
  font-size: 11px;
  line-height: 1.4;
}

.mail-id {
  opacity: 0.78;
}

.mail-list-empty {
  min-height: 330px;
  padding: 28px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  box-sizing: border-box;
  color: #687487;
  font-size: 13px;
  text-align: center;
}

.mail-pagination {
  padding: 11px 12px;
  display: flex;
  justify-content: center;
  border-top: 1px solid #282f3b;
}

.mail-content-panel {
  display: flex;
  flex-direction: column;
}

.content-nav {
  min-height: 46px;
  padding: 8px 13px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-sizing: border-box;
  border-bottom: 1px solid #282f3b;
}

.nav-btn {
  color: #9da8b8 !important;
}

.mail-content-scroll {
  min-height: 382px;
  max-height: 650px;
  padding: 16px;
  overflow: auto;
  box-sizing: border-box;
}

.content-empty {
  min-height: 428px;
  padding: 30px;
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  box-sizing: border-box;
  color: #747f90;
  font-size: 14px;
  text-align: center;
}

.mobile-mailbox {
  width: 100%;
}

.mobile-content {
  min-width: 0;
}

.mobile-content-nav {
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

/* Integrate the existing renderer with the dark card. */
.mail-content-scroll :deep(.n-card),
.mobile-content :deep(.n-card) {
  background: transparent;
  color: #e8edf5;
  border-color: #2b3340;
}

.mail-content-scroll :deep(.n-divider),
.mobile-content :deep(.n-divider) {
  border-color: #2b3340;
}

.mail-content-scroll :deep(pre),
.mobile-content :deep(pre) {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

/* Scrollbars */
.mail-list::-webkit-scrollbar,
.mail-content-scroll::-webkit-scrollbar {
  width: 6px;
}

.mail-list::-webkit-scrollbar-thumb,
.mail-content-scroll::-webkit-scrollbar-thumb {
  background: #343d4b;
  border-radius: 10px;
}

@media (max-width: 900px) {
  .mailbox-grid {
    grid-template-columns: minmax(250px, 0.9fr) minmax(0, 1.45fr);
    gap: 12px;
  }
}

@media (max-width: 768px) {
  .mail-panel {
    min-height: 0;
  }

  .panel-header {
    min-height: 54px;
    padding: 11px 13px;
  }

  .panel-header-actions {
    gap: 6px;
  }

  .mail-list {
    max-height: none;
  }

  .mail-row {
    padding: 13px;
  }
}
</style>
