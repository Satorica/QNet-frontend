<template>
  <div class="history-page">
    <el-card class="history-card">
      <template #header>
        <div class="history-header">
          <h3>我的反馈</h3>
          <el-button class="new-feedback-button" type="primary" @click="goToFeedback">
            <el-icon><EditPen /></el-icon>
            提交新反馈
          </el-button>
        </div>
      </template>

      <div v-if="loadError && !loading" class="load-error" role="alert">
        <el-icon><Warning /></el-icon>
        <p>{{ loadError }}</p>
        <el-button type="primary" plain @click="loadFeedbacks">重新加载</el-button>
      </div>

      <div v-else>
        <el-table
          v-loading="loading"
          class="feedback-table"
          :data="feedbacks"
          row-key="id"
          table-layout="fixed"
          stripe
          size="large"
        >
          <el-table-column label="反馈类型" prop="category" min-width="120">
            <template #default="{ row }">{{ getCategoryLabel(row.category) }}</template>
          </el-table-column>
          <el-table-column label="反馈内容" prop="content" min-width="280" show-overflow-tooltip />
          <el-table-column label="状态" prop="status" min-width="110">
            <template #default="{ row }">
              <el-tag class="status-tag" :type="getStatusType(row.status)" effect="light" size="small">
                {{ getStatusLabel(row.status) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="管理员回复" min-width="240" show-overflow-tooltip>
            <template #default="{ row }">
              <span :class="{ 'reply-placeholder': !row.adminReply }">
                {{ row.adminReply || '暂无回复' }}
              </span>
            </template>
          </el-table-column>
          <el-table-column label="提交时间" prop="createdAt" min-width="170">
            <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="110" align="center">
            <template #default="{ row }">
              <el-button type="primary" size="small" @click.stop="openFeedbackDetail(row)">
                查看
              </el-button>
            </template>
          </el-table-column>
          <template #empty>暂无反馈</template>
        </el-table>

        <div class="pagination-container">
          <el-pagination
            :current-page="page"
            :page-size="pageSize"
            :page-sizes="[10, 20, 30]"
            :total="total"
            :disabled="loading"
            :hide-on-single-page="false"
            layout="total, sizes, prev, pager, next, jumper"
            @size-change="handlePageSizeChange"
            @current-change="handlePageChange"
          />
        </div>
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
const loadError = ref("");
const page = ref(1);
const pageSize = ref(10);
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

const loadFeedbacks = async () => {
  const requestId = ++historyRequestId;
  loading.value = true;
  loadError.value = "";
  try {
    const response = await getFeedbackHistory({ page: page.value, pageSize: pageSize.value });
    if (requestId !== historyRequestId) return;
    const data = response.data;
    if (!data) throw new Error(response.message || "反馈记录响应缺少数据");
    feedbacks.value = data.feedbacks;
    total.value = data.total;
    page.value = data.page;
    pageSize.value = data.pageSize;
    detailDialogVisible.value = false;
    selectedFeedback.value = null;
  } catch (error) {
    if (requestId !== historyRequestId) return;
    feedbacks.value = [];
    total.value = 0;
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

const handlePageSizeChange = (nextPageSize: number) => {
  pageSize.value = nextPageSize;
  page.value = 1;
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
  background: #ffffff;
  border: 1px solid #e6eaf5;
  border-radius: 20px;
  box-shadow: 0 10px 20px rgba(9, 30, 66, 0.04);
}

.history-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.history-header h3 {
  margin: 0;
  color: #292929;
  font-weight: 600;
}

.new-feedback-button .el-icon {
  margin-right: 4px;
}

.feedback-table {
  width: 100%;
}

.reply-placeholder {
  color: #a1a8b4;
}

.status-tag {
  animation: none !important;
  transition: none !important;
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
  justify-content: center;
  min-height: 72px;
  box-sizing: border-box;
  padding: 20px 0;
}

@media (max-width: 920px) {
  .pagination-container {
    overflow-x: auto;
    justify-content: flex-start;
  }
}

@media (max-width: 820px) {
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
