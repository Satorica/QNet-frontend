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
                <button
                  class="feedback-summary"
                  type="button"
                  :aria-label="`查看${getCategoryLabel(item.category)}反馈详情`"
                  @click="openFeedbackDetail(item)"
                >
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
                    <span class="detail-action">
                      查看详情
                      <el-icon><ArrowRight /></el-icon>
                    </span>
                  </div>
                </button>
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
            <p>提交于 {{ formatDate(selectedFeedback.createdAt) }}</p>
          </div>
          <el-tag class="status-tag" :type="getStatusType(selectedFeedback.status)" effect="light" round>
            {{ getStatusLabel(selectedFeedback.status) }}
          </el-tag>
        </div>
      </template>

      <div v-if="selectedFeedback" class="dialog-body">
        <section class="dialog-content-card">
          <div class="dialog-content-header">
            <div class="dialog-content-label">反馈内容</div>
            <span class="dialog-category-label">
              {{ getCategoryLabel(selectedFeedback.category) }}
            </span>
          </div>
          <p>{{ selectedFeedback.content }}</p>
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
import { ArrowRight, ChatDotRound, EditPen, Warning } from "@element-plus/icons-vue";
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
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 18px 20px;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.feedback-summary:focus-visible {
  border-radius: 11px;
  outline: 2px solid #4050f8;
  outline-offset: -2px;
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
  color: #337ecc;
  font-size: 12px;
  white-space: nowrap;
}

.detail-action .el-icon {
  transition: transform 0.18s ease;
}

.feedback-summary:hover .detail-action .el-icon {
  transform: translateX(2px);
}

:global(.feedback-detail-dialog) {
  overflow: hidden;
  border-radius: 14px;
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.18);
}

:global(.feedback-detail-dialog .el-dialog__header) {
  margin: 0;
  padding: 22px 26px 18px;
  border-bottom: 1px solid #edf0f4;
}

:global(.feedback-detail-dialog .el-dialog__body) {
  padding: 22px 26px 6px;
}

:global(.feedback-detail-dialog .el-dialog__footer) {
  padding: 18px 26px 22px;
}

.dialog-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding-right: 14px;
}

.dialog-heading h3 {
  margin: 0;
  color: #20242d;
  font-size: 18px;
  line-height: 1.4;
}

.dialog-heading p {
  margin: 5px 0 0;
  color: #9298a7;
  font-size: 12px;
}

.dialog-content-card {
  min-height: 172px;
  box-sizing: border-box;
  padding: 18px 20px 22px;
  border: 1px solid #e7ebf0;
  border-radius: 10px;
  background: #fbfcfe;
}

.dialog-content-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding-bottom: 14px;
  border-bottom: 1px solid #edf0f4;
}

.dialog-content-label {
  color: #596273;
  font-size: 13px;
  font-weight: 600;
}

.dialog-category-label {
  padding: 3px 8px;
  border-radius: 5px;
  background: #edf6ff;
  color: #337ecc;
  font-size: 12px;
  font-weight: 600;
}

.dialog-content-card p {
  margin: 16px 0 0;
  color: #303746;
  font-size: 14px;
  line-height: 1.75;
  white-space: pre-wrap;
  word-break: break-word;
}

.dialog-close-button {
  min-width: 80px;
  height: 32px;
  border-radius: 6px;
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
  }

}
</style>
