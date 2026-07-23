<template>
  <div class="history-page">
    <el-card class="history-card" shadow="never">
      <div class="history-workspace">
        <section class="history-main">
          <header class="history-header">
            <div>
              <h2>我的反馈</h2>
              <p>查看已经提交的内容和当前处理状态。</p>
            </div>
            <div class="history-header-actions">
              <span v-if="loaded" class="history-total">共 {{ total }} 条</span>
              <el-button class="new-feedback-button" type="primary" @click="goToFeedback">
                <el-icon><EditPen /></el-icon>
                提交新反馈
              </el-button>
            </div>
          </header>

          <div class="history-divider"></div>

          <div v-loading="loading" class="history-content">
            <div v-if="loadError && !loading" class="load-error" role="alert">
              <el-icon><Warning /></el-icon>
              <p>{{ loadError }}</p>
              <el-button type="primary" plain @click="loadFeedbacks">重新加载</el-button>
            </div>

            <div v-else-if="loaded && !feedbacks.length" class="history-empty">
              <div class="empty-icon">
                <el-icon><ChatDotRound /></el-icon>
              </div>
              <h3>还没有反馈记录</h3>
              <p>遇到问题或有改进建议，提交后可在这里持续查看处理状态。</p>
              <el-button type="primary" @click="goToFeedback">提交反馈</el-button>
            </div>

            <div v-else class="feedback-list">
              <article v-for="item in feedbacks" :key="item.id" class="feedback-item">
                <div class="feedback-summary">
                  <div class="feedback-summary-main">
                    <div class="feedback-meta">
                      <span class="category-label">{{ getCategoryLabel(item.category) }}</span>
                      <span class="feedback-time">{{ formatDate(item.createdAt) }}</span>
                    </div>
                    <p class="feedback-preview">{{ buildPreview(item.content) }}</p>
                  </div>
                  <div class="feedback-summary-state">
                    <el-tag class="status-tag" :type="getStatusType(item.status)" effect="light" round>
                      {{ getStatusLabel(item.status) }}
                    </el-tag>
                    <button
                      class="detail-action"
                      type="button"
                      :aria-label="`查看${getCategoryLabel(item.category)}反馈详情`"
                      @click="openFeedbackDetail(item)"
                    >
                      查看详情
                      <el-icon><ArrowRight /></el-icon>
                    </button>
                  </div>
                </div>
              </article>
            </div>
          </div>

          <div v-if="total > pageSize" class="pagination-container">
            <el-pagination
              :current-page="page"
              :page-size="pageSize"
              :total="total"
              :disabled="loading"
              layout="total, prev, pager, next"
              @current-change="handlePageChange"
            />
          </div>
        </section>

      </div>
    </el-card>

    <el-dialog
      v-model="detailDialogVisible"
      class="feedback-detail-dialog"
      width="600px"
      align-center
      append-to-body
      destroy-on-close
      @closed="handleDetailDialogClosed"
    >
      <template #header>
        <div v-if="selectedFeedback" class="dialog-heading">
          <div>
            <h3>反馈详情</h3>
            <div class="dialog-meta">
              <span class="dialog-category-label">
                {{ getCategoryLabel(selectedFeedback.category) }}
              </span>
              <span>提交于 {{ formatDate(selectedFeedback.createdAt) }}</span>
            </div>
          </div>
          <el-tag class="status-tag" :type="getStatusType(selectedFeedback.status)" effect="light" round>
            {{ getStatusLabel(selectedFeedback.status) }}
          </el-tag>
        </div>
      </template>

      <div v-if="selectedFeedback" class="dialog-body">
        <section class="dialog-message-section">
          <header class="dialog-message-heading">
            <span class="dialog-message-icon is-user" aria-hidden="true">
              <el-icon><User /></el-icon>
            </span>
            <div>
              <h4>用户反馈</h4>
            </div>
          </header>
          <div class="dialog-message-card is-user">
            <p>{{ selectedFeedback.content }}</p>
          </div>
        </section>

        <section class="dialog-message-section">
          <header class="dialog-message-heading">
            <span class="dialog-message-icon is-admin" aria-hidden="true">
              <el-icon><Service /></el-icon>
            </span>
            <div>
              <h4>管理员回复</h4>
              <span v-if="selectedFeedback.adminReply && selectedFeedback.updatedAt">
                更新于 {{ formatDate(selectedFeedback.updatedAt) }}
              </span>
              <span v-else-if="selectedFeedback.adminReply">管理员已回复</span>
            </div>
          </header>
          <div
            class="dialog-message-card is-admin"
            :class="{ 'is-empty': !selectedFeedback.adminReply }"
          >
            <p v-if="selectedFeedback.adminReply">{{ selectedFeedback.adminReply }}</p>
            <div v-else class="dialog-reply-empty">
              <span class="reply-waiting-dot" aria-hidden="true"></span>
              <span>暂无管理员回复，请耐心等待</span>
            </div>
          </div>
        </section>
      </div>

      <template #footer>
        <el-button class="dialog-close-button" @click="detailDialogVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import {
  ArrowRight,
  ChatDotRound,
  EditPen,
  Service,
  User,
  Warning,
} from "@element-plus/icons-vue";
import type { TagProps } from "element-plus";
import { getFeedbackHistory } from "../api/feedback";
import type { FeedbackCategory, FeedbackHistoryItem } from "../types/api";

const router = useRouter();
const feedbacks = ref<FeedbackHistoryItem[]>([]);
const loading = ref(false);
const loaded = ref(false);
const loadError = ref("");
const page = ref(1);
const pageSize = 10;
const total = ref(0);
const detailDialogVisible = ref(false);
const selectedFeedback = ref<FeedbackHistoryItem | null>(null);
let historyRequestId = 0;

const categoryLabels: Record<FeedbackCategory, string> = {
  task: "任务问题",
  quota: "额度问题",
  account: "账号问题",
  suggestion: "体验建议",
  other: "其他",
};

const statusLabels: Record<number, string> = {
  0: "待处理",
  1: "跟进中",
  2: "已处理",
};

const statusTypes: Record<number, TagProps["type"]> = {
  0: "warning",
  1: "primary",
  2: "success",
};

const getCategoryLabel = (category: FeedbackCategory) => categoryLabels[category] || "其他";
const getStatusLabel = (status: number) => statusLabels[status] || "待处理";
const getStatusType = (status: number) => statusTypes[status] || "warning";

const formatDate = (value?: string | null) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date).replaceAll("/", "-");
};

const buildPreview = (content: string) => {
  const normalized = content.replace(/\s+/g, " ").trim();
  return normalized.length > 72 ? `${normalized.slice(0, 72)}...` : normalized;
};

const loadFeedbacks = async () => {
  const requestId = ++historyRequestId;
  loading.value = true;
  loadError.value = "";
  try {
    const response = await getFeedbackHistory({ page: page.value, pageSize });
    if (requestId !== historyRequestId) return;
    const data = response.data;
    if (!data) throw new Error(response.message || "反馈记录响应缺少数据");
    feedbacks.value = data.feedbacks;
    total.value = data.total;
    detailDialogVisible.value = false;
    selectedFeedback.value = null;
    loaded.value = true;
  } catch (error) {
    if (requestId !== historyRequestId) return;
    feedbacks.value = [];
    total.value = 0;
    loaded.value = true;
    loadError.value = error instanceof Error && error.message
      ? error.message
      : "获取反馈历史失败，请稍后重试";
  } finally {
    if (requestId === historyRequestId) loading.value = false;
  }
};

const openFeedbackDetail = (item: FeedbackHistoryItem) => {
  selectedFeedback.value = item;
  detailDialogVisible.value = true;
};

const handleDetailDialogClosed = () => {
  selectedFeedback.value = null;
};

const handlePageChange = (nextPage: number) => {
  page.value = nextPage;
  loadFeedbacks();
};

const goToFeedback = () => router.push("/feedback");

onMounted(loadFeedbacks);
</script>

<style scoped>
.history-page {
  height: 100%;
  overflow: auto;
  overflow-x: hidden;
}

.history-card {
  width: 100%;
  min-height: 100%;
  box-sizing: border-box;
  margin: 0 auto;
  border: 1px solid #e6eaf0;
  border-radius: 12px;
  box-shadow: 0 2px 10px rgba(15, 23, 42, 0.04);
}

.history-card :deep(.el-card__body) {
  min-height: 100%;
  box-sizing: border-box;
  padding: 0;
}

.history-workspace {
  min-height: 100%;
}

.history-main {
  max-width: 1120px;
  min-width: 0;
  margin: 0;
  padding: 28px 32px 32px;
}

.history-header,
.history-header-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
}

.history-header h2 {
  margin: 0;
  color: #20232d;
  font-size: 20px;
  line-height: 1.35;
}

.history-header p {
  margin: 6px 0 0;
  color: #8c8fa3;
  font-size: 13px;
  line-height: 1.6;
}

.history-divider {
  height: 1px;
  margin-top: 20px;
  background: #edf0f4;
}

.history-total {
  padding: 4px 9px;
  border-radius: 999px;
  background: #f3f5f8;
  color: #8c8fa3;
  font-size: 12px;
}

.new-feedback-button {
  height: 32px;
  padding: 0 14px;
  border-radius: 6px;
  font-size: 13px;
}

.history-content {
  min-height: 340px;
  padding-top: 20px;
}

.history-empty {
  display: flex;
  min-height: 280px;
  box-sizing: border-box;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border: 1px solid #edf0f4;
  border-radius: 10px;
  background: #fbfcfe;
  text-align: center;
}

.empty-icon {
  display: flex;
  width: 44px;
  height: 44px;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: #eef6ff;
  color: #409eff;
  font-size: 22px;
}

.history-empty h3 {
  margin: 16px 0 0;
  color: #20232d;
  font-size: 16px;
  font-weight: 600;
}

.history-empty p {
  max-width: 340px;
  margin: 8px 0 18px;
  color: #8b91a1;
  font-size: 13px;
  line-height: 1.6;
}

.history-empty .el-button {
  min-width: 96px;
  height: 34px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
}

.feedback-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.feedback-item {
  overflow: hidden;
  border: 1px solid #e4e9f0;
  border-radius: 10px;
  background: #ffffff;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.025);
  transition: border-color 0.18s ease, box-shadow 0.18s ease;
}

.feedback-item:hover {
  border-color: #bfd5ec;
  box-shadow: 0 5px 16px rgba(51, 126, 204, 0.06);
}

.feedback-summary {
  display: flex;
  width: 100%;
  box-sizing: border-box;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 18px 20px;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
}

.feedback-summary-main {
  min-width: 0;
  flex: 1;
}

.feedback-meta {
  display: flex;
  align-items: center;
  gap: 12px;
}

.category-label {
  padding: 3px 8px;
  border-radius: 5px;
  background: #edf6ff;
  color: #337ecc;
  font-size: 12px;
  font-weight: 600;
}

.feedback-time {
  color: #a0a5b4;
  font-size: 12px;
}

.feedback-preview {
  overflow: hidden;
  margin: 10px 0 0;
  color: #3f4654;
  font-size: 14px;
  font-weight: 400;
  line-height: 1.65;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.feedback-summary-state {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 14px;
}

.status-tag {
  animation: none !important;
  transition: none !important;
}

.detail-action {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 2px;
  border: 0;
  background: transparent;
  color: #337ecc;
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  white-space: nowrap;
}

.detail-action:focus-visible {
  border-radius: 4px;
  outline: 2px solid #4050f8;
  outline-offset: 2px;
}

.detail-action .el-icon {
  transition: transform 0.18s ease;
}

.detail-action:hover .el-icon {
  transform: translateX(2px);
}

:global(.feedback-detail-dialog) {
  display: flex;
  max-height: calc(100vh - 48px);
  flex-direction: column;
  overflow: hidden;
  border-radius: 14px;
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.18);
}

:global(.feedback-detail-dialog .el-dialog__header) {
  position: relative;
  flex-shrink: 0;
  margin: 0;
  padding: 20px 26px 16px;
  border-bottom: 0;
}

:global(.feedback-detail-dialog .el-dialog__header::after) {
  position: absolute;
  right: 26px;
  bottom: 0;
  left: 26px;
  height: 1px;
  background: #edf0f4;
  content: "";
}

:global(.feedback-detail-dialog .el-dialog__headerbtn) {
  top: -2px;
  right: -2px;
  width: 32px;
  height: 32px;
  border-radius: 7px;
  transition: background-color 0.18s ease, color 0.18s ease;
}

:global(.feedback-detail-dialog .el-dialog__headerbtn:hover) {
  background: #f5f7fa;
  color: #337ecc;
}

:global(.feedback-detail-dialog .el-dialog__body) {
  width: 100%;
  box-sizing: border-box;
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 18px 26px 6px;
}

:global(.feedback-detail-dialog .el-dialog__footer) {
  flex-shrink: 0;
  margin-top: 0;
  padding: 14px 26px 18px;
}

.dialog-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding-right: 0;
}

.dialog-heading h3 {
  margin: 0;
  color: #20242d;
  font-size: 18px;
  line-height: 1.4;
}

.dialog-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 7px;
  color: #9298a7;
  font-size: 12px;
}

.dialog-body {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.dialog-message-section {
  min-width: 0;
}

.dialog-message-heading {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 11px;
}

.dialog-message-icon {
  display: inline-flex;
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  font-size: 16px;
}

.dialog-message-icon.is-user {
  background: #edf6ff;
  color: #337ecc;
}

.dialog-message-icon.is-admin {
  background: #f2f0ff;
  color: #5b5bd6;
}

.dialog-message-heading h4 {
  margin: 0;
  color: #303746;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.35;
}

.dialog-message-heading > div > span {
  display: block;
  margin-top: 3px;
  color: #a0a5b4;
  font-size: 12px;
  line-height: 1.4;
}

.dialog-message-card {
  box-sizing: border-box;
  border: 1px solid #e3e9f0;
  border-radius: 10px;
}

.dialog-message-card.is-user {
  min-height: 96px;
  max-height: 180px;
  overflow-y: auto;
  padding: 16px 18px;
  background: #fbfcfe;
}

.dialog-message-card.is-admin {
  display: flex;
  min-height: 64px;
  max-height: 156px;
  overflow-y: auto;
  align-items: flex-start;
  padding: 14px 18px;
  border-color: #e5e3f6;
  background: #fafaff;
}

.dialog-message-card::-webkit-scrollbar,
:global(.feedback-detail-dialog .el-dialog__body::-webkit-scrollbar) {
  width: 6px;
}

.dialog-message-card::-webkit-scrollbar-thumb,
:global(.feedback-detail-dialog .el-dialog__body::-webkit-scrollbar-thumb) {
  border-radius: 999px;
  background: #d9dee8;
}

.dialog-message-card::-webkit-scrollbar-track,
:global(.feedback-detail-dialog .el-dialog__body::-webkit-scrollbar-track) {
  background: transparent;
}

.dialog-message-card.is-empty {
  align-items: center;
  overflow: hidden;
  border-style: solid;
}

.dialog-category-label {
  padding: 3px 8px;
  border-radius: 5px;
  background: #edf6ff;
  color: #337ecc;
  font-size: 12px;
  font-weight: 600;
}

.dialog-message-card p {
  margin: 0;
  color: #303746;
  font-size: 14px;
  line-height: 1.75;
  white-space: pre-wrap;
  word-break: break-word;
}

.dialog-reply-empty {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #9298a7;
  font-size: 13px;
}

.reply-waiting-dot {
  width: 8px;
  height: 8px;
  flex-shrink: 0;
  border-radius: 50%;
  background: #9b9be8;
}

.dialog-close-button {
  min-width: 80px;
  height: 32px;
  border-radius: 6px;
  transition: border-color 0.18s ease, background-color 0.18s ease, color 0.18s ease;
}

.dialog-close-button:hover {
  border-color: #9bc6ee;
  background: #f7faff;
  color: #337ecc;
}

.dialog-close-button:focus-visible {
  outline: 2px solid rgba(64, 158, 255, 0.26);
  outline-offset: 2px;
}

.load-error {
  display: flex;
  min-height: 280px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border: 1px solid #edf0f4;
  border-radius: 10px;
  background: #fbfcfe;
  color: #8c8fa3;
  text-align: center;
}

.load-error > .el-icon {
  color: #e6a23c;
  font-size: 38px;
}

.load-error p {
  margin: 14px 0 20px;
  font-size: 14px;
}

.pagination-container {
  display: flex;
  justify-content: flex-end;
  margin-top: 24px;
  padding-top: 18px;
  border-top: 1px solid #eef0f5;
}

@media (max-width: 820px) {
  .history-header {
    align-items: flex-start;
  }

  .history-header-actions {
    flex-direction: column;
    align-items: flex-end;
    gap: 8px;
  }

  .feedback-summary {
    align-items: flex-start;
    gap: 16px;
  }

  .feedback-summary-state {
    flex-direction: column;
    align-items: flex-end;
    gap: 8px;
  }

  .history-main {
    padding: 24px 20px 28px;
  }

  :global(.feedback-detail-dialog) {
    width: calc(100vw - 32px) !important;
    max-height: calc(100vh - 32px);
  }

  :global(.feedback-detail-dialog .el-dialog__header) {
    padding: 18px 20px 15px;
  }

  :global(.feedback-detail-dialog .el-dialog__headerbtn) {
    top: -14px;
  }

  :global(.feedback-detail-dialog .el-dialog__header::after) {
    right: 20px;
    left: 20px;
  }

  :global(.feedback-detail-dialog .el-dialog__body) {
    width: 100%;
    padding: 16px 20px 6px;
  }

  :global(.feedback-detail-dialog .el-dialog__footer) {
    padding: 14px 20px 18px;
  }

  .dialog-heading {
    align-items: flex-start;
  }

  .dialog-meta {
    flex-wrap: wrap;
  }

  .dialog-body {
    gap: 18px;
  }

  .dialog-message-card.is-user {
    max-height: 160px;
  }

}
</style>
