<template>
  <div class="quota-history-page">
    <el-card class="quota-history-card">
      <template #header>
        <div class="page-header">
          <h3>我的申请</h3>
        </div>
      </template>

        <div v-if="loadError && !loading" class="state-panel" role="alert">
          <span class="state-icon is-warning"><el-icon><Warning /></el-icon></span>
          <h3>申请记录加载失败</h3>
          <p>{{ loadError }}</p>
          <el-button type="primary" plain @click="loadRequests">重新加载</el-button>
        </div>

        <div v-else>
          <el-table
            v-loading="loading"
            class="request-table app-data-table"
            scrollbar-always-on
            :data="requests"
            row-key="id"
            table-layout="fixed"
            stripe
            size="large"
          >
            <el-table-column label="申请编号" prop="id" min-width="164" show-overflow-tooltip>
              <template #default="{ row }">
                <el-link
                  class="request-id"
                  type="primary"
                  :underline="false"
                  @click.stop="openDetail(row)"
                >
                  {{ row.id }}
                </el-link>
              </template>
            </el-table-column>

            <el-table-column label="经典计算" width="100">
              <template #default="{ row }">
                <span class="amount-cell"><strong>{{ row.amounts.classic }}</strong><small>次</small></span>
              </template>
            </el-table-column>

            <el-table-column label="量子芯片模拟" width="124">
              <template #default="{ row }">
                <span class="amount-cell"><strong>{{ row.amounts.quantum }}</strong><small>次</small></span>
              </template>
            </el-table-column>

            <el-table-column label="申请原因" prop="reason" min-width="160" show-overflow-tooltip />

            <el-table-column label="状态" width="96">
              <template #default="{ row }">
                <el-tag
                  class="status-tag"
                  :type="getStatusType(row.status)"
                  effect="light"
                  size="small"
                >
                  {{ getStatusLabel(row.status) }}
                </el-tag>
              </template>
            </el-table-column>

            <el-table-column label="审批备注" min-width="160" show-overflow-tooltip>
              <template #default="{ row }">
                <span :class="['note-cell', { 'is-empty': !row.adminNote }]">
                  {{ row.adminNote || getEmptyNote(row.status) }}
                </span>
              </template>
            </el-table-column>

            <el-table-column label="提交时间" width="176">
              <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
            </el-table-column>

            <el-table-column label="操作" width="88" align="center" fixed="right" class-name="table-actions">
              <template #default="{ row }">
                <el-button
                  type="primary"
                  size="small"
                  @click.stop="openDetail(row)"
                >
                  查看
                </el-button>
              </template>
            </el-table-column>

            <template #empty>暂无申请</template>
          </el-table>

          <div class="pagination-container" data-testid="quota-history-pagination">
            <el-pagination
              v-model:current-page="page"
              v-model:page-size="pageSize"
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
      v-model="detailVisible"
      class="quota-history-detail-dialog"
      title="申请详情"
      width="620px"
      align-center
      append-to-body
      destroy-on-close
      :close-on-click-modal="false"
      @closed="selectedRequest = null"
    >
      <div v-if="selectedRequest" class="dialog-body">
        <div class="detail-identity">
          <div>
            <span>申请编号</span>
            <strong>{{ selectedRequest.id }}</strong>
          </div>
          <el-tag
            class="status-tag"
            :type="getStatusType(selectedRequest.status)"
            effect="light"
            size="small"
          >
            {{ getStatusLabel(selectedRequest.status) }}
          </el-tag>
        </div>
        <div class="detail-amounts">
          <div>
            <span>经典计算额度</span>
            <strong>{{ selectedRequest.amounts.classic }}<small> 次</small></strong>
          </div>
          <div>
            <span>量子芯片模拟计算额度</span>
            <strong>{{ selectedRequest.amounts.quantum }}<small> 次</small></strong>
          </div>
        </div>

        <section class="detail-section">
          <h4>申请原因</h4>
          <p>{{ selectedRequest.reason }}</p>
        </section>

        <section class="detail-section" :class="{ 'is-empty': !selectedRequest.adminNote }">
          <h4>审批备注</h4>
          <p>{{ selectedRequest.adminNote || getEmptyNote(selectedRequest.status) }}</p>
        </section>

        <dl class="timeline-meta">
          <div><dt>提交时间</dt><dd>{{ formatDate(selectedRequest.createdAt) }}</dd></div>
          <div v-if="selectedRequest.status !== 'pending'">
            <dt>审批时间</dt>
            <dd>{{ formatDate(selectedRequest.reviewedAt) }}</dd>
          </div>
        </dl>
      </div>

      <template #footer>
        <el-button @click="detailVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { Warning } from "@element-plus/icons-vue";
import type { TagProps } from "element-plus";
import { getQuotaRequestHistory } from "../api";
import type { QuotaRequestItem, QuotaRequestStatus } from "../types/api";

const requests = ref<QuotaRequestItem[]>([]);
const loading = ref(false);
const loadError = ref("");
const page = ref(1);
const pageSize = ref(10);
const total = ref(0);
const detailVisible = ref(false);
const selectedRequest = ref<QuotaRequestItem | null>(null);
let historyRequestId = 0;

const statusLabels: Record<QuotaRequestStatus, string> = {
  pending: "待审批",
  approved: "已通过",
  rejected: "已驳回",
};

const statusTypes: Record<QuotaRequestStatus, TagProps["type"]> = {
  pending: "warning",
  approved: "success",
  rejected: "danger",
};

const getStatusLabel = (status: QuotaRequestStatus) => statusLabels[status];
const getStatusType = (status: QuotaRequestStatus) => statusTypes[status];

const getEmptyNote = (status: QuotaRequestStatus) => {
  if (status === "pending") return "等待管理员审批";
  return "未填写审批备注";
};

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

const loadRequests = async () => {
  const requestId = ++historyRequestId;
  loading.value = true;
  loadError.value = "";
  try {
    const response = await getQuotaRequestHistory({
      page: page.value,
      pageSize: pageSize.value,
    });
    if (requestId !== historyRequestId) return;
    if (!response.data) throw new Error(response.message || "申请记录响应缺少数据");
    requests.value = response.data.items;
    total.value = response.data.total;
    page.value = response.data.page;
    pageSize.value = response.data.pageSize;
    detailVisible.value = false;
    selectedRequest.value = null;
  } catch (error) {
    if (requestId !== historyRequestId) return;
    requests.value = [];
    total.value = 0;
    loadError.value = error instanceof Error && error.message
      ? error.message
      : "获取申请记录失败，请稍后重试";
  } finally {
    if (requestId === historyRequestId) loading.value = false;
  }
};

const openDetail = (item: QuotaRequestItem) => {
  selectedRequest.value = item;
  detailVisible.value = true;
};

const handlePageChange = (nextPage: number) => {
  page.value = nextPage;
  loadRequests();
};

const handlePageSizeChange = (nextPageSize: number) => {
  pageSize.value = nextPageSize;
  page.value = 1;
  loadRequests();
};

onMounted(loadRequests);
</script>

<style scoped>
.quota-history-page {
  height: 100%;
  overflow: auto;
  overflow-x: hidden;
}

.quota-history-card {
  background: #ffffff;
  border: 1px solid #e6eaf5;
  border-radius: 20px;
  box-shadow: 0 10px 20px rgba(9, 30, 66, 0.04);
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.page-header h3 {
  margin: 0;
  color: #292929;
  font-weight: 600;
}

.request-table {
  width: 100%;
}

.request-id {
  display: inline-block;
  width: 100%;
  overflow: hidden;
  color: var(--el-color-primary);
  font-variant-numeric: tabular-nums;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.request-id:hover,
.request-id:focus {
  color: var(--el-color-primary);
}

.amount-cell { white-space: nowrap; }
.amount-cell strong { color: #292929; font-variant-numeric: tabular-nums; }
.amount-cell small { margin-left: 4px; color: #8c8fa3; font-size: 12px; }
.note-cell.is-empty { color: #a1a8b4; }

.status-tag {
  display: inline-flex;
  height: 24px;
  align-items: center;
  gap: 4px;
  padding: 0 8px;
  border-radius: 4px;
  font-size: 12px;
  line-height: 22px;
  animation: none !important;
  transition: none !important;
}

.pagination-container {
  display: flex;
  justify-content: center;
  min-height: 72px;
  box-sizing: border-box;
  padding: 20px 0;
}

.state-panel { display: flex; min-height: 340px; box-sizing: border-box; flex-direction: column; align-items: center; justify-content: center; border: 1px solid #edf0f4; border-radius: 10px; background: #fbfcfe; text-align: center; }
.state-icon { display: flex; width: 44px; height: 44px; align-items: center; justify-content: center; border-radius: 50%; background: var(--app-accent-soft); color: var(--el-color-primary); font-size: 22px; }
.state-icon.is-warning { background: #fff7e8; color: #e6a23c; }
.state-panel h3 { margin: 15px 0 0; color: #20232d; font-size: 15px; }
.state-panel p { margin: 7px 0 18px; color: #8b91a1; font-size: 13px; line-height: 1.6; }

:global(.el-dialog.quota-history-detail-dialog) {
  overflow: hidden;
  border: 0;
  border-radius: 14px;
  background: #ffffff;
  box-shadow: 0 18px 54px rgba(31, 42, 68, 0.18);
}
:global(.quota-history-detail-dialog .el-dialog__header) {
  margin-right: 0;
  padding: 20px 24px 16px;
  border-bottom: 1px solid #edf1f6;
}
:global(.quota-history-detail-dialog .el-dialog__title) {
  color: #202737;
  font-size: 18px;
  font-weight: 600;
  letter-spacing: 0.02em;
}
:global(.quota-history-detail-dialog .el-dialog__headerbtn) {
  top: 12px;
  right: 14px;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  transition: background-color 160ms ease;
}
:global(.quota-history-detail-dialog .el-dialog__headerbtn:hover) { background: #f3f6fa; }
:global(.quota-history-detail-dialog .el-dialog__headerbtn .el-dialog__close) { color: #7a8798; font-size: 17px; }
:global(.quota-history-detail-dialog .el-dialog__body) { padding: 18px 24px 6px; }
:global(.quota-history-detail-dialog .el-dialog__footer) {
  padding: 12px 24px 16px;
  border-top: 0;
  background: #ffffff;
}
.dialog-body { display: flex; flex-direction: column; }
.detail-identity { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 3px 0 14px; border-bottom: 1px solid #eef1f5; }
.detail-identity > div { min-width: 0; }
.detail-identity > div > span { display: block; color: #7c8494; font-size: 12px; line-height: 18px; }
.detail-identity strong { display: block; overflow: hidden; margin-top: 3px; color: var(--app-accent); font-size: 14px; font-weight: 500; line-height: 20px; text-overflow: ellipsis; white-space: nowrap; }
.detail-amounts { display: grid; overflow: hidden; grid-template-columns: repeat(2, minmax(0, 1fr)); margin: 16px 0 20px; border-radius: 8px; background: #f8fafc; }
.detail-amounts > div { padding: 15px 16px; }
.detail-amounts > div + div { border-left: 1px solid #e8edf4; }
.detail-amounts span { display: block; color: #7c8494; font-size: 12px; }
.detail-amounts strong { display: block; margin-top: 7px; color: #303746; font-size: 22px; font-variant-numeric: tabular-nums; line-height: 1.2; }
.detail-amounts small { margin-left: 2px; color: #8992a3; font-size: 12px; font-weight: 500; }
.detail-section { margin: 0 0 18px; padding: 0 0 16px; border: 0; border-bottom: 1px solid #eef1f5; border-radius: 0; background: transparent; }
.detail-section.is-empty p { color: #9298a7; }
.detail-section h4 { position: relative; display: inline-flex; margin: 0; padding-bottom: 8px; color: #202737; font-size: 14px; font-weight: 600; }
.detail-section h4::after { position: absolute; right: 0; bottom: 0; left: 0; height: 2px; border-radius: 999px; background: var(--el-color-primary); content: ""; }
.detail-section p { margin: 10px 0 0; color: #303746; font-size: 14px; line-height: 1.65; white-space: pre-wrap; word-break: break-word; }
.timeline-meta { margin: -2px 0 0; padding: 0; }
.timeline-meta div { display: flex; align-items: center; justify-content: space-between; min-height: 22px; padding: 10px 0; border-bottom: 1px solid #eef1f5; }
.timeline-meta div:last-child { border-bottom: 0; }
.timeline-meta dt { color: #7c8494; font-size: 13px; }
.timeline-meta dd { margin: 0; color: #596273; font-size: 13px; font-variant-numeric: tabular-nums; }
:global(.quota-history-detail-dialog .el-dialog__footer .el-button) { min-width: 60px; border-radius: 7px; }

@media (max-width: 920px) {
  .pagination-container { overflow-x: auto; justify-content: flex-start; }
}
@media (max-width: 720px) {
  :global(.el-dialog.quota-history-detail-dialog) { width: calc(100vw - 32px) !important; margin-top: 7vh; }
  :global(.quota-history-detail-dialog .el-dialog__header),
  :global(.quota-history-detail-dialog .el-dialog__body),
  :global(.quota-history-detail-dialog .el-dialog__footer) { padding-right: 20px; padding-left: 20px; }
  .detail-amounts { grid-template-columns: 1fr; }
  .detail-amounts > div + div { border-top: 1px solid #e8edf4; border-left: 0; }
  .timeline-meta div { align-items: flex-start; flex-direction: column; gap: 4px; }
}
</style>
